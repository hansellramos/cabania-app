/**
 * In-app assistant for the team: answers questions about bookings, money,
 * chats, commissions and settings with tools that apply the signed-in user's
 * permissions, and can open a screen of the app for them (navigate).
 *
 * It can also propose changes (payments, expenses, recurring expenses,
 * notifications): those never run when the model calls them. The reply carries
 * a signed confirmation card, and the change runs only when the user presses
 * Confirmar (POST /api/assistant/confirm).
 *
 * POST /api/assistant/chat { messages: [{ role, content }], context: { path } }
 *   -> { reply, actions: [{ type: 'navigate', path, label } | { type: 'confirm', token, title, lines, note }] }
 * POST /api/assistant/confirm { token } -> { ok, reply }
 */

const crypto = require('crypto');
const {
  ASSISTANT_TOOLS, ASSISTANT_CHANGE_TOOLS, DEFINITIONS, asFunctions, createAgentTools, TIMEZONE, todayIso, isoDay, dayLabel
} = require('./agent-tools');

const MAX_TOOL_ROUNDS = 6;
// A confirmation card is valid for this long after the assistant proposes it.
const CHANGE_TTL_MS = 30 * 60 * 1000;

// Screens the assistant can open, with the URL filters each one understands.
const ROUTES = `
- /next?venues=<id,id> — próximos alquileres (tarjetas por fecha)
- /business/accommodations?view=calendar|list — hospedajes en calendario o lista
- /business/accommodations/<id>?tab=resumen|pagos|deposito|contrato|comisiones|mensajes — detalle de un alquiler
- /business/payments?status=verified|pending&method=<texto>&from=YYYY-MM-DD&to=YYYY-MM-DD&q=<texto>&basis=cash|accrual — ingresos
- /business/payments/online?view=open|review|paid|closed|all&from=&to=&q= — pagos en línea (Bold)
- /business/expenses?venue_id=&category_id=&from=&to=&q= — egresos
- /business/deposits?status=pending|refunded|claimed&venue_id=&q= — depósitos
- /business/estimates?status=pending|converted&venue_id=&q= — cotizaciones
- /business/commissions/payments?agent_id=&status=pending|paid&venue_id=&q= — pagos a comisionistas
- /business/commissions/agents — comisionistas
- /business/contacts y /business/contacts/<id> — contactos
- /business/venues/<id>?tab=informacion|ubicacion|galeria — detalle de una cabaña; /business/venues/<id>/edit — configuración (anticipo, avisos, seguimiento)
- /business/venues/<id>/plans — planes y precios; /business/venues/<id>/payment-methods — métodos de pago
- /venues/<id>/chat?channel=all|whatsapp|instagram|web&q=&conversation_id=<id> — chat de la cabaña
- /business/pending-tasks, /business/maintenance, /business/inventory — tareas, mantenimiento, inventario
- /dashboard — análisis de hospedajes; /analytics — análisis financiero; /settings — configuración personal`;

// Query params each screen understands (anything else is dropped from navigate).
const ROUTE_PARAMS = [
  [/^\/next$/, ['venues']],
  [/^\/business\/accommodations$/, ['view']],
  [/^\/business\/accommodations\/[0-9a-f-]{36}$/, ['tab']],
  [/^\/business\/payments$/, ['status', 'method', 'from', 'to', 'q', 'basis']],
  [/^\/business\/payments\/online$/, ['view', 'from', 'to', 'q']],
  [/^\/business\/expenses$/, ['venue_id', 'category_id', 'from', 'to', 'q']],
  [/^\/business\/deposits$/, ['status', 'venue_id', 'q']],
  [/^\/business\/estimates$/, ['status', 'venue_id', 'q']],
  [/^\/business\/commissions\/payments$/, ['agent_id', 'status', 'venue_id', 'q']],
  [/^\/business\/venues\/[0-9a-f-]{36}$/, ['tab']],
  [/^\/venues\/[0-9a-f-]{36}\/chat$/, ['channel', 'q', 'conversation_id']],
  [/^\/(business\/(commissions\/agents|contacts(\/[0-9a-f-]{36})?|estimates\/[0-9a-f-]{36}|venues\/[0-9a-f-]{36}\/(edit|plans|payment-methods)|pending-tasks|maintenance|inventory)|dashboard|analytics|settings)$/, []]
];

/** A known screen with only the filters it supports, or null. */
function cleanRoute(raw) {
  const [pathname, search = ''] = String(raw || '').split('?');
  const known = ROUTE_PARAMS.find(([re]) => re.test(pathname));
  if (!known) return null;
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) if (known[1].includes(key) && value) kept.set(key, value);
  const query = kept.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const TOOLS = [
  ...ASSISTANT_TOOLS,
  ...asFunctions(DEFINITIONS.filter(t => ASSISTANT_CHANGE_TOOLS.includes(t.name))),
  ...asFunctions([
    {
      name: 'navigate',
      description: 'Muestra un botón para ir a una pantalla de la app (ver la lista de rutas del sistema). Con open=true la app además la abre de inmediato.',
      properties: {
        path: { type: 'string', description: 'Ruta de la app con sus filtros, ej: /business/payments?status=pending&from=2026-10-01' },
        label: { type: 'string', description: 'Texto corto del botón, ej: "Ver ingresos pendientes"' },
        open: { type: 'boolean', description: 'true solo si el usuario pidió ver, abrir o ir a esa pantalla. false para ofrecerla como botón.' }
      },
      required: ['path', 'label']
    }
  ])
];

// ==================== Confirmation cards ====================
// The proposed change travels to the browser and back signed, so what runs is
// exactly what the user saw, for that user only, once, and not after it expires.

const secret = () => process.env.SESSION_SECRET || 'cabania-dev-secret';
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

function changeToken(userId, tool, args) {
  const payload = Buffer.from(JSON.stringify({
    u: String(userId), t: tool, a: args, e: Date.now() + CHANGE_TTL_MS, n: crypto.randomBytes(8).toString('hex')
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readChangeToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

// Cards already used (by nonce) until they expire: a double click runs the change once.
const usedChanges = new Map();
function claimChange(nonce, expires) {
  const now = Date.now();
  for (const [key, until] of usedChanges) if (until < now) usedChanges.delete(key);
  if (usedChanges.has(nonce)) return false;
  usedChanges.set(nonce, expires);
  return true;
}

/** Which record a proposed change is about: two cards with the same key are the same change. */
function changeKey(tool, a) {
  const text = (v) => String(v ?? '').trim().toLowerCase();
  const target = {
    record_payment: [a.booking_id, a.amount],
    record_expense: [a.booking_id || a.venue_id, a.amount, text(a.description)],
    update_expense: [a.expense_id],
    create_recurring_expense: a.from_expense_id ? [a.from_expense_id] : [a.venue_id, a.start_date, a.frequency],
    update_recurring_expense: [a.recurring_expense_id],
    mark_notifications_read: []
  }[tool] || [JSON.stringify(a)];
  return target.map(text).join('|');
}

/** What the change left, in a sentence, from the tool's result. */
function changeDone(done, result) {
  const parts = [`Listo: ${done.charAt(0).toLowerCase()}${done.slice(1)}.`];
  if (result.profit?.profit) parts.push(`La ganancia del alquiler queda en ${result.profit.profit}.`);
  if (result.note) parts.push(result.note);
  if (result.unread !== undefined) parts.push(`Te quedan ${result.unread} sin leer.`);
  return parts.join(' ');
}

module.exports = function registerAssistantRoutes(app, deps) {
  const { prisma, llmService, isAuthenticated, logAICall } = deps;
  const { tools, userScope: scopeFor, previewChange } = createAgentTools(deps);

  const userScope = (req) => scopeFor({
    userId: req.user.claims?.sub || req.user.id,
    perms: req.userPermissions,
    viewAll: req.body?.view_all === true
  });

  function systemPrompt(scope, req, context) {
    const now = new Date().toLocaleString('es-CO', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const user = req.assistantUser;
    return `Eres el asistente interno de CabanIA, una app para administrar cabañas de alquiler (pasadías, eventos, hospedaje). Hablas con ${user?.display_name || user?.email || 'un usuario'} (perfil: ${user?.profile?.name || (user?.is_super_admin ? 'superadmin' : 'sin perfil')}), del equipo que administra las cabañas. No es un huésped.

Ahora: ${now} (hora de Colombia). Hoy es ${todayIso()}.
Próximos días: ${Array.from({ length: 10 }, (_, i) => { const d = isoDay(new Date(Date.now() + i * 86400000 - 5 * 3600000)); return `${dayLabel(d)} = ${d}`; }).join('; ')}.
Días recientes: ${Array.from({ length: 7 }, (_, i) => { const d = isoDay(new Date(Date.now() - (i + 1) * 86400000 - 5 * 3600000)); return `${dayLabel(d)} = ${d}`; }).join('; ')}.
Pantalla donde está el usuario: ${context?.path || 'desconocida'}.
Cabañas a las que tiene acceso (nombre → id):
${scope.venues.map(v => `- ${v.name} → ${v.id}`).join('\n') || '- ninguna'}
${scope.ownBookingsOnly ? '\nEste usuario solo ve sus propios alquileres (o los que vendió como comisionista).' : ''}

CÓMO RESPONDER:
- Usa las herramientas para cualquier dato; nunca inventes cifras, fechas ni nombres. Si una herramienta dice que no hay permiso, díselo sin rodeos.
- Responde en español, tratando al usuario de tú ("recibiste", "tienes"), breve y al grano: primero la respuesta, luego el detalle en una lista corta. Montos como $1.234.567.
- Para fechas usa date_label (o las fechas ya escritas que devuelven las herramientas) tal cual: no calcules el día de la semana por tu cuenta.
- Resuelve fechas relativas ("este fin de semana", "el mes pasado") con la fecha de hoy.
- Si el usuario pide ver, abrir o ir a algo, llama navigate con open=true (la app lo lleva ahí).
- Si tu respuesta resume una lista o un alquiler, llama navigate con open=false para dejarle el botón a la pantalla completa (con los filtros que correspondan).
- Los botones SOLO existen si llamas navigate: nunca escribas links, rutas ni frases como "ver aquí:" o "ver lista completa:" en el texto.
- Usa solo las rutas y filtros de la lista. Si ninguna pantalla filtra lo que pidió (ej. "reservas con saldo"), responde con la lista en el texto y no llames navigate.
- Siempre responde con texto: navigate complementa tu respuesta, no la reemplaza.
- Si está dentro de un alquiler (/business/accommodations/<id>) y pregunta por "este alquiler", usa ese id.

CAMBIOS:
- Puedes registrar pagos (record_payment), registrar y corregir egresos, también de un alquiler (record_expense, update_expense), configurar egresos recurrentes o dejar de tratarlos como recurrentes (create_recurring_expense, update_recurring_expense) y marcar notificaciones como leídas (mark_notifications_read).
- Un pago o un gasto ya ocurrió: "el sábado" o "el martes" es el más reciente que ya pasó (ver días recientes), nunca uno futuro.
- No le hables al usuario de herramientas, ids ni llamadas: habla de lo que vas a registrar.
- Antes de proponer un cambio, ten los datos: busca el alquiler o el egreso con las herramientas de consulta y pregunta lo que falte (monto, método de pago, categoría, descripción). No inventes montos ni categorías.
- La tarjeta SOLO aparece si llamas la herramienta del cambio (ej. record_expense) en esta misma respuesta. Nunca digas que hay una tarjeta sin haberla llamado.
- Al llamar una de esas herramientas NO se guarda nada: el usuario ve una tarjeta con el resumen y los botones Confirmar y Cancelar. Dile en una frase qué vas a registrar y que lo confirme en la tarjeta. Nunca digas que ya quedó registrado.
- Si son varios cambios (ej. tres gastos del mismo alquiler), propón cada uno con su propia llamada: el usuario confirma cada tarjeta.
- Para volver recurrente un gasto que ya está registrado (ej. "a partir del pago de octubre"), búscalo con list_expenses y usa from_expense_id: así ese pago queda contado. Dale siempre un nombre corto (ej. "Sueldo cuidandero").
- Otros cambios (crear, mover o cancelar alquileres, verificar pagos, contratos) se hacen en la app: explica dónde y abre esa pantalla con navigate.

PANTALLAS QUE PUEDES ABRIR (navigate):${ROUTES}`;
  }

  // POST /api/assistant/chat
  app.post('/api/assistant/chat', isAuthenticated, async (req, res) => {
    const started = Date.now();
    try {
      const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const history = incoming
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
        // A confirmed change adds a second assistant message in a row: join them.
        .reduce((list, m) => {
          const last = list[list.length - 1];
          if (last?.role === m.role) last.content += `\n\n${m.content}`;
          else list.push(m);
          return list;
        }, []);
      if (!history.length || history[history.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'Falta el mensaje del usuario' });
      }
      const scope = await userScope(req);
      req.assistantUser = await prisma.users.findUnique({
        where: { id: scope.userId },
        select: { display_name: true, email: true, is_super_admin: true, profile: { select: { name: true } } }
      });

      const setting = await prisma.ai_settings.findUnique({ where: { setting_key: 'internal_assistant' } })
        || await prisma.ai_settings.findUnique({ where: { setting_key: 'customer_chat' } });
      const providerCode = setting?.provider_code || 'anthropic_claude';
      const config = llmService.getModelConfig(providerCode);
      if (!config) return res.status(500).json({ error: 'Modelo de IA no configurado' });
      const isAnthropic = config.provider === 'anthropic';

      const system = systemPrompt(scope, req, req.body?.context);
      const messages = [{ role: 'system', content: system }, ...history];
      const actions = [];
      const call = () => llmService.callLLMByCode(providerCode, messages, {
        model: setting?.model || undefined, tools: TOOLS, maxTokens: 1500, temperature: 0.3
      });

      let response = await call();
      let inputTokens = response.usage?.prompt_tokens || response.usage?.input_tokens || 0;
      let outputTokens = response.usage?.completion_tokens || response.usage?.output_tokens || 0;
      const toolsUsed = [];
      const proposed = new Set(); // changes already shown as a card in this reply
      async function runToolCalls(toolCalls) {
        const results = [];
        for (const tc of toolCalls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep {} */ }
          let result;
          if (tc.function.name === 'navigate') {
            const path = cleanRoute(args.path);
            if (path) {
              actions.push({ type: 'navigate', path, label: String(args.label || 'Abrir').slice(0, 60), open: args.open === true });
              result = { ok: true, path, note: path !== args.path ? 'Se quitaron filtros que esa pantalla no soporta.' : undefined };
            } else {
              result = { error: 'Esa pantalla no existe: usa solo las rutas de la lista del sistema.' };
            }
          } else if (ASSISTANT_CHANGE_TOOLS.includes(tc.function.name)) {
            const preview = await previewChange(tc.function.name, args, scope).catch(err => {
              console.error('[assistant] Preview failed', { tool: tc.function.name, error: err.message });
              return { error: 'No se pudo preparar ese cambio.' };
            });
            if (preview.error) {
              result = { error: preview.error };
            } else {
              // The same change proposed again in this reply (usually refined): keep only the last card.
              const key = `${tc.function.name}|${preview.key || changeKey(tc.function.name, args)}`;
              const earlier = actions.findIndex(a => a.type === 'confirm' && a.key === key);
              if (earlier >= 0) actions.splice(earlier, 1);
              const { done, key: _key, ...card } = preview;
              actions.push({ type: 'confirm', key, token: changeToken(scope.userId, tc.function.name, args), ...card });
              result = {
                pending_confirmation: true,
                note: earlier >= 0
                  ? 'Reemplazó la tarjeta anterior del mismo cambio. No se ha guardado nada.'
                  : 'No se ha guardado nada: el usuario ve la tarjeta con Confirmar y Cancelar.'
              };
            }
          } else if (tools[tc.function.name]) {
            try {
              result = await tools[tc.function.name](args, scope);
            } catch (err) {
              console.error('[assistant] Tool failed', { tool: tc.function.name, error: err.message });
              result = { error: 'No se pudo consultar ese dato en este momento.' };
            }
          } else {
            result = { error: 'Herramienta desconocida' };
          }
          toolsUsed.push(tc.function.name);
          results.push({ tc, args, content: JSON.stringify(result) });
        }
        return results;
      }

      function pushToolResults(response, results) {
        if (isAnthropic) {
          messages.push({
            role: 'assistant',
            content: [
              ...(response.content ? [{ type: 'text', text: response.content }] : []),
              ...results.map(r => ({ type: 'tool_use', id: r.tc.id, name: r.tc.function.name, input: r.args }))
            ]
          });
          messages.push({ role: 'user', content: results.map(r => ({ type: 'tool_result', tool_use_id: r.tc.id, content: r.content })) });
        } else {
          messages.push({ role: 'assistant', content: response.content || null, tool_calls: response.tool_calls });
          for (const r of results) messages.push({ role: 'tool', tool_call_id: r.tc.id, content: r.content });
        }
      }

      for (let round = 0; response.tool_calls?.length && round < MAX_TOOL_ROUNDS; round++) {
        const results = await runToolCalls(response.tool_calls);
        pushToolResults(response, results);
        response = await call();
        inputTokens += response.usage?.prompt_tokens || response.usage?.input_tokens || 0;
        outputTokens += response.usage?.completion_tokens || response.usage?.output_tokens || 0;
      }

      // The model sometimes promises a confirmation card without calling the tool:
      // ask it to make the call, once.
      const promisesCard = /tarjeta|confirm/i.test(response.content || '');
      if (promisesCard && !actions.some(a => a.type === 'confirm') && !toolsUsed.some(t => ASSISTANT_CHANGE_TOOLS.includes(t))) {
        messages.push({ role: 'assistant', content: response.content || '' });
        messages.push({ role: 'user', content: '[Sistema] No llamaste la herramienta del cambio, así que no hay tarjeta. Llámala ahora con los datos que ya tienes y luego responde en una frase.' });
        response = await call();
        for (let round = 0; response.tool_calls?.length && round < 2; round++) {
          pushToolResults(response, await runToolCalls(response.tool_calls));
          response = await call();
        }
      }

      // The model sometimes answers only with a navigate: ask for the words too.
      if (!(response.content || '').trim() && toolsUsed.some(t => t !== 'navigate')) {
        messages.push({ role: 'user', content: '[Sistema] Responde ahora al usuario con texto, usando los datos que ya consultaste.' });
        response = await llmService.callLLMByCode(providerCode, messages, { model: setting?.model || undefined, maxTokens: 1500, temperature: 0.3 });
      }
      const reply = (response.content || '').trim()
        || (actions.some(a => a.open) ? 'Listo, te lo abrí.' : 'No pude armar una respuesta. ¿Me lo preguntas de otra forma?');
      logAICall({
        feature: 'internal_assistant',
        provider_code: providerCode,
        model: response.model || setting?.model || providerCode,
        system_prompt: system,
        user_prompt: history[history.length - 1].content,
        response_content: reply,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        response_time_ms: Date.now() - started,
        user_id: scope.userId,
        metadata: { tools_used: toolsUsed, path: req.body?.context?.path || null }
      });
      res.json({ reply, actions });
    } catch (error) {
      console.error('[assistant] Chat failed', error);
      res.status(500).json({ error: 'El asistente no está disponible en este momento' });
    }
  });
  // POST /api/assistant/confirm { token } — runs a change the user confirmed on its card.
  app.post('/api/assistant/confirm', isAuthenticated, async (req, res) => {
    try {
      const change = readChangeToken(req.body?.token);
      const userId = String(req.user.claims?.sub || req.user.id);
      if (!change || change.u !== userId || !ASSISTANT_CHANGE_TOOLS.includes(change.t)) {
        return res.status(400).json({ error: 'Este cambio no es válido. Pídeselo de nuevo al asistente.' });
      }
      if (change.e < Date.now()) return res.status(400).json({ error: 'Este cambio venció. Pídeselo de nuevo al asistente.' });
      if (!claimChange(change.n, change.e)) return res.status(409).json({ error: 'Este cambio ya se aplicó.' });

      // Permissions are checked again now, by the tool itself.
      const scope = await userScope(req);
      const preview = await previewChange(change.t, change.a, scope);
      const result = await tools[change.t](change.a || {}, scope);
      if (result?.error) {
        usedChanges.delete(change.n); // fixable: the user can retry after correcting it in the app
        return res.json({ ok: false, reply: `No se pudo: ${result.error}` });
      }
      console.log('[assistant] Change', { tool: change.t, user: userId });
      res.json({ ok: true, reply: changeDone(preview.done || 'cambio aplicado', result) });
    } catch (error) {
      console.error('[assistant] Confirm failed', error);
      res.status(500).json({ error: 'No se pudo aplicar el cambio en este momento' });
    }
  });
};
