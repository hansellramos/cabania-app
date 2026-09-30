/**
 * API for external AI agents (Claude, ChatGPT, …).
 *
 * A user creates a key in Configuración → Agentes de IA. The key acts as that
 * user: same permissions and organizations as in the app. Only its SHA-256 is
 * stored; the key itself is shown once. Keys that do not allow changes only get
 * the read tools.
 *
 *   GET  /api/agent                discovery: what this is, how to authenticate, the tools
 *   GET  /api/agent/openapi.json   OpenAPI 3.1 (e.g. for ChatGPT GPT actions)
 *   *    /api/agent/v1/...         REST, one endpoint per tool (see agent-tools.js)
 *   POST /api/agent/mcp            MCP (streamable HTTP, stateless JSON responses)
 *
 * Key management for the signed-in user (session auth):
 *   GET /api/agent-keys, POST /api/agent-keys, DELETE /api/agent-keys/:id
 */

const crypto = require('crypto');
const { DEFINITIONS, createAgentTools } = require('./agent-tools');

const KEY_PREFIX = 'cab_';
const MAX_KEYS_PER_USER = 10;
const RATE_LIMIT_PER_MINUTE = 120;
const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');
const newKey = () => KEY_PREFIX + crypto.randomBytes(24).toString('base64url');

const appUrl = () => (process.env.APP_URL || 'https://cabania.app').replace(/\/$/, '');

/** The app's screens use hash routes: /business/x -> https://cabania.app/#/business/x */
function absoluteLinks(value) {
  if (Array.isArray(value)) return value.map(absoluteLinks);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = (k === 'link' || k === 'edit_link') && typeof v === 'string' && v.startsWith('/')
        ? `${appUrl()}/#${v}`
        : absoluteLinks(v);
    }
    return out;
  }
  return value;
}

const toolsFor = (key) => DEFINITIONS.filter(t => !t.write || key?.can_write);

/** The text the user pastes into their agent. */
function agentPrompt({ key, venues, canWrite }) {
  const names = venues.map(v => v.name);
  const what = names.length === 1 ? `la cabaña ${names[0]}` : names.length ? `las cabañas ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : 'mis cabañas';
  return `Esta es CabanIA, la aplicación con la que gestiono ${what} (alquileres, pagos, clientes, cotizaciones y chats).

Descubre lo que puedes hacer aquí: ${appUrl()}/api/agent
Especificación OpenAPI: ${appUrl()}/api/agent/openapi.json
Servidor MCP (si tu cliente lo soporta): ${appUrl()}/api/agent/mcp

Autentícate en cada llamada con el header:
Authorization: Bearer ${key}

La key actúa con mis permisos. ${canWrite ? 'Puedes consultar y también crear cotizaciones, crear y corregir alquileres (horario, comisionista, personas, precio), registrar pagos, marcar no asistencia y cancelar alquileres: antes de cambiar algo, confírmamelo.' : 'Solo puede consultar información, no cambiar nada.'} Empieza llamando a GET ${appUrl()}/api/agent/v1/context para saber qué día es hoy y cuáles son mis cabañas.`;
}

module.exports = function registerAgentApi(app, deps) {
  const { prisma, isAuthenticated, getUserPermissions } = deps;
  const { tools, userScope } = createAgentTools(deps);

  // ==================== Key management (signed-in user) ====================

  const sessionUserId = (req) => String(req.user.claims?.sub || req.user.id);
  const publicKey = (k) => ({
    id: k.id, name: k.name, prefix: k.prefix, can_write: k.can_write,
    last_used_at: k.last_used_at, created_at: k.created_at
  });

  app.get('/api/agent-keys', isAuthenticated, async (req, res) => {
    try {
      const keys = await prisma.api_keys.findMany({
        where: { user_id: sessionUserId(req), revoked_at: null },
        orderBy: { created_at: 'desc' }
      });
      res.json(keys.map(publicKey));
    } catch (error) {
      console.error('[agent-api] List keys failed', error);
      res.status(500).json({ error: 'No se pudieron cargar las keys' });
    }
  });

  app.post('/api/agent-keys', isAuthenticated, async (req, res) => {
    try {
      const userId = sessionUserId(req);
      const name = String(req.body?.name || '').trim().slice(0, 100);
      if (!name) return res.status(400).json({ error: 'Ponle un nombre a la key (ej: "Claude de mi computador")' });
      const active = await prisma.api_keys.count({ where: { user_id: userId, revoked_at: null } });
      if (active >= MAX_KEYS_PER_USER) return res.status(400).json({ error: `Máximo ${MAX_KEYS_PER_USER} keys activas: revoca alguna primero` });
      const key = newKey();
      const created = await prisma.api_keys.create({
        data: {
          user_id: userId,
          name,
          prefix: key.slice(0, 12),
          key_hash: hashKey(key),
          can_write: req.body?.can_write === true
        }
      });
      const scope = await userScope({ userId, perms: await getUserPermissions(userId) });
      res.status(201).json({
        ...publicKey(created),
        key, // shown only now
        prompt: agentPrompt({ key, venues: scope.venues, canWrite: created.can_write }),
        urls: { discovery: `${appUrl()}/api/agent`, openapi: `${appUrl()}/api/agent/openapi.json`, mcp: `${appUrl()}/api/agent/mcp` }
      });
    } catch (error) {
      console.error('[agent-api] Create key failed', error);
      res.status(500).json({ error: 'No se pudo crear la key' });
    }
  });

  app.delete('/api/agent-keys/:id', isAuthenticated, async (req, res) => {
    try {
      const { count } = await prisma.api_keys.updateMany({
        where: { id: req.params.id, user_id: sessionUserId(req), revoked_at: null },
        data: { revoked_at: new Date() }
      });
      if (!count) return res.status(404).json({ error: 'Key no encontrada' });
      res.json({ ok: true });
    } catch (error) {
      console.error('[agent-api] Revoke key failed', error);
      res.status(500).json({ error: 'No se pudo revocar la key' });
    }
  });

  // ==================== Authentication with a key ====================

  const hits = new Map(); // key id -> { windowStart, count }
  function rateLimited(keyId) {
    const now = Date.now();
    const entry = hits.get(keyId);
    if (!entry || now - entry.windowStart > 60000) {
      hits.set(keyId, { windowStart: now, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT_PER_MINUTE;
  }

  function bearer(req) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(\S+)$/i);
    return match ? match[1] : (req.headers['x-api-key'] ? String(req.headers['x-api-key']) : null);
  }

  /** Resolves the key to its user and scope: req.agent = { key, scope }. */
  async function resolveAgent(req) {
    const raw = bearer(req);
    if (!raw || !raw.startsWith(KEY_PREFIX)) return { status: 401, error: 'Falta la API key: header Authorization: Bearer cab_…' };
    const key = await prisma.api_keys.findUnique({
      where: { key_hash: hashKey(raw) },
      include: { user: { select: { id: true, is_locked: true } } }
    });
    if (!key || key.revoked_at) return { status: 401, error: 'API key no válida o revocada' };
    if (key.user?.is_locked) return { status: 403, error: 'El usuario de esta key está bloqueado' };
    if (rateLimited(key.id)) return { status: 429, error: `Demasiadas peticiones: máximo ${RATE_LIMIT_PER_MINUTE} por minuto` };
    if (!key.last_used_at || Date.now() - key.last_used_at.getTime() > 60000) {
      prisma.api_keys.update({ where: { id: key.id }, data: { last_used_at: new Date() } }).catch(() => {});
    }
    const scope = await userScope({ userId: key.user_id, perms: await getUserPermissions(key.user_id) });
    scope.agentKeyName = key.name;
    return { key, scope };
  }

  const requireAgent = async (req, res, next) => {
    try {
      const agent = await resolveAgent(req);
      if (agent.error) {
        if (agent.status === 401) res.set('WWW-Authenticate', 'Bearer realm="cabania"');
        return res.status(agent.status).json({ error: agent.error });
      }
      req.agent = agent;
      next();
    } catch (error) {
      console.error('[agent-api] Auth failed', error);
      res.status(500).json({ error: 'No se pudo validar la key' });
    }
  };

  /** Runs a tool as the key's user. */
  async function runTool(name, args, agent) {
    const def = DEFINITIONS.find(t => t.name === name);
    if (!def || !tools[name]) return { status: 404, result: { error: `Herramienta desconocida: ${name}` } };
    if (def.write && !agent.key.can_write) {
      return { status: 403, result: { error: 'Esta key solo puede consultar. Crea una key que permita cambios en Configuración → Agentes de IA.' } };
    }
    try {
      const result = await tools[name](args || {}, agent.scope);
      if (def.write && result?.ok) {
        console.log('[agent-api] Change', { tool: name, key: agent.key.prefix, user: agent.scope.userId });
      }
      return { status: result?.error ? 400 : 200, result: absoluteLinks(result) };
    } catch (error) {
      console.error('[agent-api] Tool failed', { tool: name, error: error.message });
      return { status: 500, result: { error: 'No se pudo completar en este momento' } };
    }
  }

  // ==================== Discovery and OpenAPI ====================

  app.get('/api/agent', async (req, res) => {
    let agent = null;
    if (bearer(req)) {
      agent = await resolveAgent(req).catch(() => null);
      if (agent?.error) agent = null;
    }
    const base = `${appUrl()}/api/agent`;
    res.json({
      name: 'CabanIA',
      description: 'API de CabanIA, una aplicación para administrar cabañas de alquiler (pasadías, eventos y hospedaje): alquileres, disponibilidad, pagos, clientes, cotizaciones, comisionistas y chats con clientes. Los montos están en pesos colombianos (COP) y las fechas en hora de Colombia.',
      authentication: {
        type: 'bearer',
        header: 'Authorization: Bearer cab_…',
        how_to_get_a_key: 'El usuario la crea en la app: Configuración → Agentes de IA. La key actúa con los permisos de ese usuario.',
        authenticated: !!agent,
        ...(agent && { key_name: agent.key.name, can_write: agent.key.can_write })
      },
      openapi: `${base}/openapi.json`,
      mcp: { url: `${base}/mcp`, transport: 'streamable-http', auth: 'Authorization: Bearer cab_…' },
      base_url: `${base}/v1`,
      start_with: `GET ${base}/v1/context`,
      guidelines: [
        'Llama primero a /v1/context: da la fecha de hoy, los próximos días con su día de la semana y las cabañas (ids) del usuario.',
        'Usa los ids que devuelven las consultas; no los inventes.',
        'Antes de crear o cambiar algo, confirma con el usuario los datos exactos.',
        'Los pagos registrados quedan sin verificar hasta que alguien del equipo los revise en la app.',
        'Los campos link son URLs de la app para abrir ese registro.'
      ],
      endpoints: toolsFor(agent?.key).map(t => ({
        name: t.name,
        method: t.http.method,
        url: `${base}/v1${t.http.path}`,
        description: t.description,
        changes_data: !!t.write,
        parameters: Object.fromEntries(Object.entries(t.properties).map(([k, v]) => [k, `${v.type}${(t.required || []).includes(k) ? ' (requerido)' : ''} — ${v.description || ''}`]))
      })),
      ...(!agent && { note: 'Envía tu key para ver también las herramientas que permite (las de cambios solo aparecen con una key que las permita).' })
    });
  });

  app.get('/api/agent/openapi.json', (req, res) => {
    const paths = {};
    for (const t of DEFINITIONS) {
      const pathParams = [...t.http.path.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      const rest = Object.entries(t.properties).filter(([k]) => !pathParams.includes(k));
      const required = t.required || [];
      const op = {
        operationId: t.name,
        summary: t.description.split('. ')[0].slice(0, 120),
        description: t.description + (t.write ? ' Cambia datos: requiere una key que permita cambios; confirma con el usuario antes de llamarlo.' : ''),
        parameters: pathParams.map(name => ({
          name, in: 'path', required: true, schema: { type: 'string' }, description: t.properties[name]?.description
        })),
        responses: {
          200: { description: 'Resultado', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          400: { description: 'Datos no válidos o sin permiso (campo error)' },
          401: { description: 'Falta la key o no es válida' },
          403: { description: 'La key no permite cambios' },
          429: { description: 'Demasiadas peticiones' }
        }
      };
      if (t.http.method === 'GET') {
        for (const [name, schema] of rest) {
          op.parameters.push({
            name, in: 'query', required: required.includes(name),
            description: schema.description + (schema.type === 'array' ? ' (separadas por coma)' : ''),
            schema: schema.type === 'array' ? { type: 'string' } : { type: schema.type, ...(schema.enum && { enum: schema.enum }) }
          });
        }
      } else if (rest.length) {
        op.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(rest),
                required: required.filter(r => !pathParams.includes(r))
              }
            }
          }
        };
      }
      if (!op.parameters.length) delete op.parameters;
      paths[t.http.path] = { ...(paths[t.http.path] || {}), [t.http.method.toLowerCase()]: op };
    }
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'CabanIA',
        version: '1.0.0',
        description: 'Administración de cabañas de alquiler: alquileres, disponibilidad, pagos, clientes, cotizaciones y chats. Montos en COP. Empieza con getContext (GET /context). La API key actúa con los permisos del usuario que la creó.'
      },
      servers: [{ url: `${appUrl()}/api/agent/v1` }],
      components: { securitySchemes: { apiKey: { type: 'http', scheme: 'bearer', description: 'API key cab_… creada en Configuración → Agentes de IA' } } },
      security: [{ apiKey: [] }],
      paths
    });
  });

  // ==================== REST: one endpoint per tool ====================

  for (const t of DEFINITIONS) {
    const route = `/api/agent/v1${t.http.path.replace(/\{(\w+)\}/g, ':$1')}`;
    app[t.http.method.toLowerCase()](route, requireAgent, async (req, res) => {
      const args = { ...(t.http.method === 'GET' ? req.query : req.body), ...req.params };
      for (const [name, schema] of Object.entries(t.properties)) {
        if (schema.type === 'array' && typeof args[name] === 'string') args[name] = args[name].split(',').map(s => s.trim()).filter(Boolean);
      }
      const { status, result } = await runTool(t.name, args, req.agent);
      res.status(status).json(result);
    });
  }

  // ==================== MCP (streamable HTTP, stateless) ====================

  const mcpTool = (t) => ({
    name: t.name,
    description: t.description,
    inputSchema: { type: 'object', properties: t.properties, ...(t.required && { required: t.required }) },
    annotations: { readOnlyHint: !t.write, destructiveHint: false, openWorldHint: false }
  });

  async function mcpMessage(msg, agent) {
    const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(-32600, 'Invalid Request');
    const isNotification = msg.id === undefined || msg.id === null;

    switch (msg.method) {
      case 'initialize': {
        const asked = msg.params?.protocolVersion;
        return reply({
          protocolVersion: MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'cabania', title: 'CabanIA', version: '1.0.0' },
          instructions: `CabanIA administra cabañas de alquiler de ${agent.scope.venues.map(v => v.name).join(', ') || 'este usuario'}. Llama primero a get_context (fecha de hoy y cabañas). Montos en COP. Antes de crear o cambiar algo, confirma con el usuario.`
        });
      }
      case 'ping':
        return isNotification ? null : reply({});
      case 'tools/list':
        return reply({ tools: toolsFor(agent.key).map(mcpTool) });
      case 'tools/call': {
        const name = msg.params?.name;
        const { status, result } = await runTool(name, msg.params?.arguments, agent);
        if (status === 404) return fail(-32602, `Unknown tool: ${name}`);
        return reply({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: status !== 200
        });
      }
      default:
        if (isNotification) return null; // notifications/initialized, cancelled…
        return fail(-32601, `Method not found: ${msg.method}`);
    }
  }

  app.post('/api/agent/mcp', requireAgent, async (req, res) => {
    try {
      const body = req.body;
      const batch = Array.isArray(body);
      const replies = (await Promise.all((batch ? body : [body]).map(m => mcpMessage(m, req.agent)))).filter(Boolean);
      if (!replies.length) return res.status(202).end();
      res.json(batch ? replies : replies[0]);
    } catch (error) {
      console.error('[agent-api] MCP failed', error);
      res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } });
    }
  });

  // No server-initiated stream and no sessions in this stateless server.
  app.get('/api/agent/mcp', (req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Usa POST (MCP streamable HTTP)' }));
  app.delete('/api/agent/mcp', (req, res) => res.status(405).set('Allow', 'POST').end());
};
