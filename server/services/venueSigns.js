// Printed signs with a QR for a venue: banners on the road, table signs, the WiFi
// card. Except for WiFi (the QR joins the network directly), the QR points at
// /q/<code>: we count the scan and redirect to the sign's current destination,
// so the host can change where it goes without reprinting.

const crypto = require('crypto');

const KINDS = ['public_page', 'whatsapp', 'instagram', 'url', 'wifi'];
const SIZES = ['letter', 'half_letter', 'a3', 'banner_3x1'];
const STYLES = ['gradient', 'light'];
// No 0/o, 1/l/i: the code is also printed under the QR and may be typed by hand.
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
// Link previews and crawlers fetch the URL too; they are not people scanning.
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|headless/i;

function newCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function deviceOf(userAgent) {
  const ua = String(userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** Digits of the venue's WhatsApp with the Colombian prefix when it has 10 digits. */
function waNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 10 ? `57${digits}` : digits;
}

/**
 * Where a sign sends people, or null when the venue lacks what it needs (not
 * public, no WhatsApp...). Public page links carry UTM tags so visits and bookings
 * can be traced back to the sign.
 */
function signDestination(sign, venue, baseUrl) {
  switch (sign.kind) {
    case 'public_page':
      if (!venue.is_public || !venue.slug) return null;
      return `${baseUrl}/p/${venue.slug}?utm_source=qr&utm_medium=aviso&utm_campaign=${sign.code}`;
    case 'whatsapp': {
      const number = waNumber(venue.whatsapp);
      if (!number) return null;
      const text = sign.target || `Hola, vi su aviso de ${venue.name || 'la cabaña'} y quiero información.`;
      return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }
    case 'instagram': {
      const handle = instagramHandle(venue.instagram);
      return handle ? `https://www.instagram.com/${handle}/` : null;
    }
    case 'url':
      return /^https?:\/\/\S+$/i.test(sign.target || '') ? sign.target : null;
    default:
      return null;
  }
}

/** The text a WiFi QR encodes (phones join the network when they scan it). */
function wifiPayload(ssid, password) {
  const esc = (v) => String(v || '').replace(/([\\;,:"])/g, '\\$1');
  return password
    ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;`
    : `WIFI:T:nopass;S:${esc(ssid)};;`;
}

/** The sign fields sent by the form, checked. Throws a 400 when something is wrong. */
function signFields(body, { partial = false } = {}) {
  const out = {};
  const bad = (message) => Object.assign(new Error(message), { statusCode: 400 });
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw bad('Ponle un nombre al aviso (por ejemplo "Pasacalles vía principal").');
    out.name = name.slice(0, 100);
  }
  if (!partial || body.kind !== undefined) {
    if (!KINDS.includes(body.kind)) throw bad('El destino del aviso no es válido.');
    out.kind = body.kind;
  }
  if (!partial || body.size !== undefined) {
    const size = body.size || 'letter';
    if (!SIZES.includes(size)) throw bad('El tamaño del aviso no es válido.');
    out.size = size;
  }
  if (!partial || body.style !== undefined) {
    const style = body.style || 'gradient';
    if (!STYLES.includes(style)) throw bad('El estilo del aviso no es válido.');
    out.style = style;
  }
  if (body.powered_by !== undefined) out.powered_by = body.powered_by !== false && body.powered_by !== 'false';
  if (body.headline !== undefined) out.headline = String(body.headline || '').trim().slice(0, 80) || null;
  if (body.body !== undefined) {
    const text = String(body.body || '').replace(/\r/g, '').split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length > 300) throw bad('El texto adicional es muy largo: máximo 300 caracteres.');
    out.body = text || null;
  }
  if (body.target !== undefined) {
    const target = String(body.target || '').trim() || null;
    if (body.kind === 'url' && !/^https?:\/\/\S+$/i.test(target || '')) throw bad('Escribe una dirección completa, que empiece por https://');
    out.target = target ? target.slice(0, 1000) : null;
  }
  return out;
}

/** "@handle" from whatever the venue saved as its Instagram, or null. */
function instagramHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** The venue's WhatsApp as people read it: "300 123 4567". */
function displayPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const local = digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : `+${digits}`;
}

/** Prompt for the AI that writes a sign's headline and free text. */
function signCopyPrompt({ venue, kind, size, idea, headline, body }) {
  const kinds = {
    public_page: 'lleva a la página web de la cabaña, donde se ven planes, precios y disponibilidad y se reserva',
    whatsapp: 'abre un chat de WhatsApp con la cabaña',
    instagram: 'abre el perfil de Instagram de la cabaña',
    url: 'abre un enlace',
    wifi: 'conecta el celular a la red WiFi de la cabaña (es para los huéspedes que ya están adentro)',
  };
  const sizes = {
    letter: 'hoja carta pegada en una pared o puerta',
    half_letter: 'aviso pequeño de mesa',
    a3: 'póster A3',
    banner_3x1: 'pasacalles de 3 × 1 metros en la vía, que se lee desde un carro en movimiento',
  };
  const system = `Escribes el texto de avisos impresos con un código QR para una cabaña de alquiler en Colombia.
Cabaña: ${venue.name || '—'}${venue.city ? ` (${venue.city})` : ''}.
El QR ${kinds[kind] || kinds.url}. Formato: ${sizes[size] || sizes.letter}.

Responde SOLO con JSON, sin nada más: {"headline": "...", "body": "..."}
- headline: el texto grande. Corto y llamativo, máximo 6 palabras y 40 caracteres, sin emojis. Si el usuario da una idea, el texto grande dice ESA idea (por ejemplo, si habla de domicilios: "Pide tu domicilio"), no otra cosa. No empieces con "Escanea": eso ya va impreso junto al QR.
- body: texto adicional opcional, máximo 3 líneas cortas separadas por \n y 150 caracteres en total. Vacío ("") si no hace falta.${size === 'banner_3x1' ? ' En un pasacalles casi siempre va vacío o con una sola línea muy corta.' : ''}${kind === 'wifi' ? ' En el aviso del WiFi va vacío o con una bienvenida corta, sin hablar de la velocidad ni la señal.' : ''}
- Español de Colombia, cálido y claro, tuteando.
- Usa SOLO datos que estén aquí o en la idea del usuario. Nunca inventes teléfonos, precios, horarios, direcciones, servicios ni promesas (como "buena señal" o "los mejores precios"). Si el usuario da números o datos (por ejemplo un número de domicilios o un horario), cópialos en body tal como los escribió, ordenados en renglones claros.
- No repitas el nombre de la cabaña: ya va impreso arriba. No pongas el enlace ni la clave del WiFi: ya van impresos.`;
  const user = [
    idea ? `Idea del usuario: ${idea}` : 'El usuario no dio una idea: propón el mejor texto.',
    headline ? `Texto grande actual: ${headline}` : '',
    body ? `Texto adicional actual: ${body}` : '',
  ].filter(Boolean).join('\n');
  return { system, user };
}

/** {headline, body} from the AI answer, trimmed to what fits on the sign. */
function parseSignCopy(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw Object.assign(new Error('La IA no devolvió un texto válido. Intenta de nuevo.'), { statusCode: 502 });
  let data;
  try { data = JSON.parse(match[0]); } catch {
    // Models sometimes put real line breaks inside the strings: read the fields one by one.
    const field = (name) => match[0].match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
    data = { headline: field('headline'), body: field('body') };
  }
  const headline = String(data.headline || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const body = String(data.body || '').replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).join('\n').slice(0, 300);
  if (!headline) throw Object.assign(new Error('La IA no devolvió un texto válido. Intenta de nuevo.'), { statusCode: 502 });
  return { headline, body };
}

function registerVenueSignRoutes(app, { prisma, isAuthenticated, hasPermission, getAccessibleVenueIds, analytics, appBaseUrl, llmService, logAICall }) {
  async function canAccessVenue(req, venueId, permission) {
    if (req.userPermissions?.isSuperAdmin) return true;
    if (permission && !hasPermission(req.userPermissions, permission)) return false;
    const venueIds = await getAccessibleVenueIds(req.userPermissions);
    return venueIds === null || venueIds.includes(venueId);
  }

  const DAY = 24 * 60 * 60 * 1000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const userIdOf = (req) => (req.user?.claims?.sub ? String(req.user.claims.sub) : null);

  async function scanCounts(signIds) {
    if (!signIds.length) return {};
    const since30 = new Date(Date.now() - 30 * DAY);
    const since7 = new Date(Date.now() - 7 * DAY);
    const rows = await prisma.$queryRaw`
      SELECT sign_id::text AS sign_id,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE scanned_at >= ${since30})::int AS last30,
             COUNT(*) FILTER (WHERE scanned_at >= ${since7})::int AS last7,
             MAX(scanned_at) AS last_scan
      FROM venue_sign_scans
      WHERE sign_id = ANY(${signIds}::uuid[])
      GROUP BY sign_id`;
    return Object.fromEntries(rows.map(r => [r.sign_id, r]));
  }

  function signPayload(sign, venue, counts) {
    const base = appBaseUrl();
    const c = counts[sign.id] || {};
    return {
      ...sign,
      short_url: sign.kind === 'wifi' ? null : `${base}/q/${sign.code}`,
      destination: sign.kind === 'wifi' ? null : signDestination(sign, venue, base),
      // What the QR encodes: the counted short link, or the network itself.
      qr_text: sign.kind === 'wifi'
        ? (venue.wifi_ssid ? wifiPayload(venue.wifi_ssid, venue.wifi_password) : null)
        : `${base}/q/${sign.code}`,
      scans: { total: c.total || 0, last30: c.last30 || 0, last7: c.last7 || 0, last_scan: c.last_scan || null }
    };
  }

  const VENUE_SELECT = { id: true, name: true, city: true, slug: true, is_public: true, whatsapp: true, instagram: true, wifi_ssid: true, wifi_password: true, logo_url: true, brand_color_primary: true, brand_color_secondary: true };

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error('[signs]', req.method, req.path, error.message);
      res.status(500).json({ error: 'No se pudo completar la acción con los avisos' });
    }
  };

  // GET /api/venues/:id/signs — the venue's signs with their scan counts
  app.get('/api/venues/:id/signs', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id))) return res.status(403).json({ error: 'No tienes acceso a esta cabaña' });
    const venue = await prisma.venues.findUnique({ where: { id: req.params.id }, select: VENUE_SELECT });
    if (!venue) return res.status(404).json({ error: 'Cabaña no encontrada' });
    const signs = await prisma.venue_signs.findMany({ where: { venue_id: venue.id }, orderBy: { created_at: 'asc' } });
    const counts = await scanCounts(signs.map(s => s.id));
    res.json({
      venue: {
        name: venue.name, is_public: venue.is_public, has_whatsapp: !!venue.whatsapp, has_instagram: !!venue.instagram,
        whatsapp_display: displayPhone(venue.whatsapp), instagram_handle: instagramHandle(venue.instagram),
        wifi_ssid: venue.wifi_ssid, wifi_password: venue.wifi_password,
        logo_url: venue.logo_url || null,
        colors: { primary: venue.brand_color_primary || null, secondary: venue.brand_color_secondary || null },
        ai_available: !!llmService,
      },
      signs: signs.map(s => signPayload(s, venue, counts))
    });
  }));

  app.post('/api/venues/:id/signs', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id, 'venues:edit'))) return res.status(403).json({ error: 'No tienes permiso para editar esta cabaña' });
    const venue = await prisma.venues.findUnique({ where: { id: req.params.id }, select: VENUE_SELECT });
    if (!venue) return res.status(404).json({ error: 'Cabaña no encontrada' });
    const data = signFields(req.body);
    let sign;
    for (let attempt = 0; !sign; attempt++) {
      try {
        sign = await prisma.venue_signs.create({ data: { ...data, venue_id: venue.id, code: newCode(), created_by: UUID.test(userIdOf(req) || '') ? userIdOf(req) : null } });
      } catch (error) {
        if (error.code !== 'P2002' || attempt >= 4) throw error; // code taken: try another one
      }
    }
    analytics.track('sign_created', { userId: userIdOf(req), venueId: venue.id, properties: { kind: sign.kind, size: sign.size } });
    res.status(201).json(signPayload(sign, venue, {}));
  }));

  app.put('/api/venues/:id/signs/:signId', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id, 'venues:edit'))) return res.status(403).json({ error: 'No tienes permiso para editar esta cabaña' });
    const existing = await prisma.venue_signs.findFirst({ where: { id: req.params.signId, venue_id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Aviso no encontrado' });
    const data = signFields({ kind: existing.kind, ...req.body }, { partial: true });
    const sign = await prisma.venue_signs.update({ where: { id: existing.id }, data: { ...data, updated_at: new Date() } });
    const venue = await prisma.venues.findUnique({ where: { id: req.params.id }, select: VENUE_SELECT });
    res.json(signPayload(sign, venue, await scanCounts([sign.id])));
  }));

  app.delete('/api/venues/:id/signs/:signId', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id, 'venues:edit'))) return res.status(403).json({ error: 'No tienes permiso para editar esta cabaña' });
    const { count } = await prisma.venue_signs.deleteMany({ where: { id: req.params.signId, venue_id: req.params.id } });
    if (!count) return res.status(404).json({ error: 'Aviso no encontrado' });
    res.json({ ok: true });
  }));

  // POST /api/venues/:id/signs/suggest — the AI writes the headline and the free text
  app.post('/api/venues/:id/signs/suggest', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id, 'venues:edit'))) return res.status(403).json({ error: 'No tienes permiso para editar esta cabaña' });
    if (!llmService) return res.status(503).json({ error: 'El asistente de IA no está disponible' });
    const venue = await prisma.venues.findUnique({ where: { id: req.params.id }, select: VENUE_SELECT });
    if (!venue) return res.status(404).json({ error: 'Cabaña no encontrada' });
    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'public_page';
    const size = SIZES.includes(req.body.size) ? req.body.size : 'letter';
    const { system, user } = signCopyPrompt({
      venue, kind, size, idea: clip(req.body.idea, 500), headline: clip(req.body.headline, 80), body: clip(req.body.body, 300),
    });
    const setting = await prisma.ai_settings.findUnique({ where: { setting_key: 'customer_chat' } }).catch(() => null);
    const providerCode = setting?.provider_code || 'anthropic_claude';
    const started = Date.now();
    let result;
    try {
      result = await llmService.callLLMByCode(providerCode, [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], { maxTokens: 300, temperature: 0.8, model: setting?.model || undefined });
    } catch (error) {
      console.error('[signs] AI copy failed:', error.message);
      return res.status(502).json({ error: 'La IA no respondió. Intenta de nuevo en un momento.' });
    }
    if (logAICall) {
      logAICall({
        venue_id: venue.id, feature: 'sign_copy', provider_code: providerCode, model: result.model || providerCode,
        system_prompt: system, user_prompt: user, response_content: result.content,
        input_tokens: result.usage?.prompt_tokens, output_tokens: result.usage?.completion_tokens,
        response_time_ms: Date.now() - started, user_id: req.user?.id, metadata: { kind, size },
      });
    }
    res.json(parseSignCopy(result.content));
  }));

  // GET /api/venues/:id/signs/:signId/scans?days=30 — scans per day (Bogotá time) and per phone
  app.get('/api/venues/:id/signs/:signId/scans', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id))) return res.status(403).json({ error: 'No tienes acceso a esta cabaña' });
    const sign = await prisma.venue_signs.findFirst({ where: { id: req.params.signId, venue_id: req.params.id }, select: { id: true } });
    if (!sign) return res.status(404).json({ error: 'Aviso no encontrado' });
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * DAY);
    const [perDay, perDevice] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char((scanned_at AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS scans
        FROM venue_sign_scans WHERE sign_id = ${sign.id}::uuid AND scanned_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT device, COUNT(*)::int AS scans
        FROM venue_sign_scans WHERE sign_id = ${sign.id}::uuid AND scanned_at >= ${since}
        GROUP BY 1`
    ]);
    res.json({ days, per_day: perDay, per_device: perDevice });
  }));

  // GET /q/:code — public: count the scan and send the person to the sign's destination
  app.get('/q/:code', async (req, res) => {
    const base = appBaseUrl();
    try {
      const code = String(req.params.code || '').toLowerCase();
      const sign = /^[a-z0-9]{4,16}$/.test(code)
        ? await prisma.venue_signs.findUnique({ where: { code }, include: { venue: { select: VENUE_SELECT } } })
        : null;
      const destination = sign && sign.kind !== 'wifi' ? signDestination(sign, sign.venue, base) : null;
      if (!destination) return res.redirect(302, base);

      const ua = req.get('user-agent') || '';
      if (!BOT_UA.test(ua)) {
        const device = deviceOf(ua);
        prisma.venue_sign_scans.create({ data: { sign_id: sign.id, device } })
          .catch(err => console.error('[signs] scan not saved:', err.message));
        analytics.track('qr_scanned', { venueId: sign.venue_id, properties: { sign_id: sign.id, sign_code: sign.code, kind: sign.kind, size: sign.size, device } });
      }
      res.set('Cache-Control', 'no-store');
      res.redirect(302, destination);
    } catch (error) {
      console.error('[signs] /q failed:', error.message);
      res.redirect(302, base);
    }
  });
}

module.exports = { registerVenueSignRoutes, signDestination, wifiPayload, signFields, newCode, deviceOf, displayPhone, instagramHandle, signCopyPrompt, parseSignCopy };
