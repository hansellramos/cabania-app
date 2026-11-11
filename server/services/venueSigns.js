// Printed signs with a QR for a venue: banners on the road, table signs, the WiFi
// card. Except for WiFi (the QR joins the network directly), the QR points at
// /q/<code>: we count the scan and redirect to the sign's current destination,
// so the host can change where it goes without reprinting.

const crypto = require('crypto');

// directory: no main QR, a list of rows with their own QR (deliveries, menus...).
const KINDS = ['public_page', 'whatsapp', 'instagram', 'url', 'wifi', 'directory'];
// Extra QRs a sign can carry (WiFi does not go through a link, so it cannot be one).
// call: a phone call to the row's number (directory rows only).
const LINK_KINDS = ['public_page', 'whatsapp', 'instagram', 'url'];
const DIRECTORY_LINK_KINDS = ['whatsapp', 'call', 'url', 'public_page', 'instagram'];
const MAX_LINKS = 2;
const MAX_DIRECTORY_ROWS = 6;
const SIZES = ['letter', 'half_letter', 'a3', 'banner_3x1'];
const STYLES = ['gradient', 'light'];
// No 0/o, 1/l/i: the code is also printed under the QR and may be typed by hand.
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
// Link previews and crawlers fetch the URL too; they are not people scanning.
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|headless/i;

/**
 * A custom short link as the host typed it, cleaned: lowercase, no accents, words
 * joined by dashes ("Domicilios Baluna" -> "domicilios-baluna"). Null when empty.
 * Throws a 400 when it is too short or too long.
 */
function cleanAlias(value) {
  const text = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!text) return null;
  if (text.length < 3 || text.length > 40) {
    throw Object.assign(new Error('El enlace personalizado debe tener entre 3 y 40 letras, números o guiones.'), { statusCode: 400 });
  }
  return text;
}

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
      // A directory row may have its own number (e.g. the shop that delivers).
      const number = waNumber(sign.phone || venue.whatsapp);
      if (!number) return null;
      // A row with its own number is another business (a shop, a restaurant): tell it where the guest is.
      const text = sign.target || (sign.phone
        ? `Hola, te escribo desde ${venue.name || 'la cabaña'}.`
        : `Hola, vi su aviso de ${venue.name || 'la cabaña'} y quiero información.`);
      return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }
    case 'instagram': {
      const handle = instagramHandle(venue.instagram);
      return handle ? `https://www.instagram.com/${handle}/` : null;
    }
    case 'url':
      return /^https?:\/\/\S+$/i.test(sign.target || '') ? sign.target : null;
    case 'call': {
      const number = waNumber(sign.phone || venue.whatsapp);
      return number ? `tel:+${number}` : null;
    }
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
  if ((body.kind === 'directory') && out.size === 'banner_3x1') throw bad('El directorio es vertical: elige carta, media carta o A3.');
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
  if (body.alias !== undefined) out.alias = body.kind === 'wifi' || body.kind === 'directory' ? null : cleanAlias(body.alias);
  if (body.links !== undefined) out.links = signLinks(body.links, body.kind);
  const aliases = [out.alias, ...(out.links || []).map(l => l.alias)].filter(Boolean);
  if (new Set(aliases).size !== aliases.length) throw bad('Usaste el mismo enlace personalizado en dos QR del aviso: cada uno necesita el suyo.');
  if (!partial && body.kind === 'directory' && !(out.links || []).length) throw bad('Agrega al menos una fila al directorio.');
  return out;
}

/**
 * The extra QRs sent by the form, checked. On most signs: at most two small QRs of
 * different kinds. On a directory: up to six rows, each with a title and maybe its
 * own phone.
 */
function signLinks(value, signKind) {
  const bad = (message) => Object.assign(new Error(message), { statusCode: 400 });
  const directory = signKind === 'directory';
  if (value === null) return [];
  if (!Array.isArray(value)) throw bad('Los QR adicionales no son válidos.');
  const max = directory ? MAX_DIRECTORY_ROWS : MAX_LINKS;
  if (value.length > max) throw bad(directory ? `El directorio admite hasta ${max} filas.` : `Puedes poner hasta ${max} QR adicionales.`);
  const seen = new Set();
  return value.map((link, i) => {
    const kind = link?.kind;
    const where = directory ? `En la fila ${i + 1}` : 'En el QR adicional';
    if (!(directory ? DIRECTORY_LINK_KINDS : LINK_KINDS).includes(kind)) throw bad(`${where}, el destino no es válido.`);
    if (!directory && seen.has(kind) && kind !== 'url') throw bad('No repitas el mismo destino en dos QR adicionales.');
    seen.add(kind);
    const target = String(link.target || '').trim() || null;
    if (kind === 'url' && !/^https?:\/\/\S+$/i.test(target || '')) throw bad(`${where}, escribe una dirección completa que empiece por https://`);
    const out = { id: typeof link.id === 'string' ? link.id : null, kind, target: target ? target.slice(0, 1000) : null };
    if (link.alias !== undefined) out.alias = cleanAlias(link.alias);
    if (directory) {
      const title = String(link.title || '').trim();
      if (!title) throw bad(`Ponle un título a la fila ${i + 1} (por ejemplo "Domicilios tienda").`);
      out.title = title.slice(0, 60);
      out.subtitle = String(link.subtitle || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null;
      const raw = String(link.phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      if (raw && (digits.length < 7 || digits.length > 15)) throw bad(`${where}, el teléfono no es válido.`);
      out.phone = digits || null;
    }
    return out;
  });
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
    directory: 'es un directorio para los huéspedes dentro de la cabaña, con varias filas, cada una con su QR (por ejemplo domicilios de la tienda, almuerzos o comidas rápidas); el texto grande es el título del directorio',
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
    // Per sign: its total, plus one row per QR (link_id null = the main QR).
    const rows = await prisma.$queryRaw`
      SELECT sign_id::text AS sign_id, link_id::text AS link_id, GROUPING(link_id)::int AS all_qrs,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE scanned_at >= ${since30})::int AS last30,
             COUNT(*) FILTER (WHERE scanned_at >= ${since7})::int AS last7,
             MAX(scanned_at) AS last_scan
      FROM venue_sign_scans
      WHERE sign_id = ANY(${signIds}::uuid[])
      GROUP BY GROUPING SETS ((sign_id), (sign_id, link_id))`;
    const out = {};
    for (const r of rows) {
      const entry = out[r.sign_id] || (out[r.sign_id] = { all: null, main: null, links: {} });
      const counts = { total: r.total, last30: r.last30, last7: r.last7, last_scan: r.last_scan };
      if (r.all_qrs) entry.all = counts;
      else if (r.link_id) entry.links[r.link_id] = counts;
      else entry.main = counts;
    }
    return out;
  }

  const scanSummary = (c) => ({ total: c?.total || 0, last30: c?.last30 || 0, last7: c?.last7 || 0, last_scan: c?.last_scan || null });

  function signPayload(sign, venue, counts) {
    const base = appBaseUrl();
    const c = counts[sign.id] || {};
    const links = (sign.links || []).slice().sort((a, b) => a.sort_order - b.sort_order).map(link => ({
      id: link.id,
      kind: link.kind,
      target: link.target,
      title: link.title || null,
      subtitle: link.subtitle || null,
      phone: link.phone || null,
      code: link.code,
      alias: link.alias || null,
      short_url: `${base}/q/${link.alias || link.code}`,
      qr_text: `${base}/q/${link.alias || link.code}`,
      destination: signDestination({ ...link, code: link.code }, venue, base),
      scans: scanSummary(c.links?.[link.id])
    }));
    return {
      ...sign,
      links,
      // A directory has no main QR: only its rows.
      short_url: sign.kind === 'wifi' || sign.kind === 'directory' ? null : `${base}/q/${sign.alias || sign.code}`,
      destination: sign.kind === 'wifi' || sign.kind === 'directory' ? null : signDestination(sign, venue, base),
      // What the QR encodes: the counted short link, or the network itself.
      qr_text: sign.kind === 'directory' ? null : sign.kind === 'wifi'
        ? (venue.wifi_ssid ? wifiPayload(venue.wifi_ssid, venue.wifi_password) : null)
        : `${base}/q/${sign.alias || sign.code}`,
      // All the sign's QRs together; main_scans is the big QR alone.
      scans: scanSummary(c.all),
      main_scans: scanSummary(c.main)
    };
  }

  const WITH_LINKS = { links: { orderBy: { sort_order: 'asc' } } };

  /** A new short code not used by any sign or extra QR (they share /q/<code>). */
  /** Whether /q/<value> already belongs to another sign (its code or custom link) or its QRs. */
  async function shortLinkTaken(value, signId = null) {
    const [sign, link] = await Promise.all([
      prisma.venue_signs.findFirst({ where: { OR: [{ code: value }, { alias: value }], ...(signId && { id: { not: signId } }) }, select: { id: true } }),
      prisma.venue_sign_links.findFirst({ where: { OR: [{ code: value }, { alias: value }], ...(signId && { sign_id: { not: signId } }) }, select: { id: true } }),
    ]);
    return !!(sign || link);
  }

  /** Every custom link of the sign must be free (they share /q/ with all the codes). */
  async function checkAliases(aliases, signId = null) {
    for (const alias of aliases.filter(Boolean)) {
      if (await shortLinkTaken(alias, signId)) {
        throw Object.assign(new Error(`El enlace cabania.app/q/${alias} ya está en uso: elige otro.`), { statusCode: 409 });
      }
    }
  }

  async function freeCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      if (!(await shortLinkTaken(code))) return code;
    }
    throw new Error('No se pudo generar un código para el QR');
  }

  /**
   * Saves a sign's extra QRs. A QR that stays (same id, or same kind) keeps its
   * code, so the printed sign keeps working; the ones taken out are deleted.
   */
  async function saveLinks(signId, wanted, { directory = false } = {}) {
    const existing = await prisma.venue_sign_links.findMany({ where: { sign_id: signId } });
    // Custom links may move between this sign's QRs: free them first.
    if (existing.some(e => e.alias)) await prisma.venue_sign_links.updateMany({ where: { sign_id: signId }, data: { alias: null } });
    const kept = new Set();
    for (const [i, link] of wanted.entries()) {
      // A directory's rows are matched by id only (several rows can share a kind).
      const byId = link.id && existing.find(e => !kept.has(e.id) && e.id === link.id);
      const match = byId || (directory ? null : existing.find(e => !kept.has(e.id) && e.kind === link.kind));
      // A QR that keeps its custom link when the form did not send one.
      const alias = link.alias !== undefined ? link.alias : (match?.alias || null);
      const rowData = { title: link.title || null, subtitle: link.subtitle || null, phone: link.phone || null, alias };
      if (match) {
        kept.add(match.id);
        await prisma.venue_sign_links.update({ where: { id: match.id }, data: { kind: link.kind, target: link.target, sort_order: i, ...rowData } });
        continue;
      }
      for (let attempt = 0; ; attempt++) {
        try {
          const created = await prisma.venue_sign_links.create({ data: { sign_id: signId, kind: link.kind, target: link.target, sort_order: i, ...rowData, code: await freeCode() } });
          kept.add(created.id);
          break;
        } catch (error) {
          if (error.code !== 'P2002' || attempt >= 4) throw error; // code taken: try another one
        }
      }
    }
    const gone = existing.filter(e => !kept.has(e.id)).map(e => e.id);
    if (gone.length) await prisma.venue_sign_links.deleteMany({ where: { id: { in: gone } } });
  }

  const VENUE_SELECT = { id: true, name: true, city: true, slug: true, is_public: true, whatsapp: true, instagram: true, wifi_ssid: true, wifi_password: true, logo_url: true, brand_color_primary: true, brand_color_secondary: true };

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      if (error.code === 'P2002' && String(error.meta?.target || '').includes('alias')) {
        return res.status(409).json({ error: 'Ese enlace personalizado ya está en uso: elige otro.' });
      }
      console.error('[signs]', req.method, req.path, error.message);
      res.status(500).json({ error: 'No se pudo completar la acción con los avisos' });
    }
  };

  // GET /api/venues/:id/signs — the venue's signs with their scan counts
  app.get('/api/venues/:id/signs', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id))) return res.status(403).json({ error: 'No tienes acceso a esta cabaña' });
    const venue = await prisma.venues.findUnique({ where: { id: req.params.id }, select: VENUE_SELECT });
    if (!venue) return res.status(404).json({ error: 'Cabaña no encontrada' });
    const signs = await prisma.venue_signs.findMany({ where: { venue_id: venue.id }, orderBy: { created_at: 'asc' }, include: WITH_LINKS });
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
    const { links, ...data } = signFields(req.body);
    await checkAliases([data.alias, ...(links || []).map(l => l.alias)]);
    let sign;
    for (let attempt = 0; !sign; attempt++) {
      try {
        sign = await prisma.venue_signs.create({ data: { ...data, venue_id: venue.id, code: await freeCode(), created_by: UUID.test(userIdOf(req) || '') ? userIdOf(req) : null } });
      } catch (error) {
        if (error.code !== 'P2002' || attempt >= 4) throw error; // code taken: try another one
      }
    }
    if (links?.length) await saveLinks(sign.id, links, { directory: sign.kind === 'directory' });
    sign = await prisma.venue_signs.findUnique({ where: { id: sign.id }, include: WITH_LINKS });
    analytics.track('sign_created', { userId: userIdOf(req), venueId: venue.id, properties: { kind: sign.kind, size: sign.size, extra_qrs: sign.links.map(l => l.kind) } });
    res.status(201).json(signPayload(sign, venue, {}));
  }));

  app.put('/api/venues/:id/signs/:signId', isAuthenticated, handle(async (req, res) => {
    if (!(await canAccessVenue(req, req.params.id, 'venues:edit'))) return res.status(403).json({ error: 'No tienes permiso para editar esta cabaña' });
    const existing = await prisma.venue_signs.findFirst({ where: { id: req.params.signId, venue_id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Aviso no encontrado' });
    const { links, ...data } = signFields({ kind: existing.kind, size: req.body.size ?? existing.size, ...req.body }, { partial: true });
    await checkAliases([data.alias, ...(links || []).map(l => l.alias)], existing.id);
    await prisma.venue_signs.update({ where: { id: existing.id }, data: { ...data, updated_at: new Date() } });
    if (links) await saveLinks(existing.id, links, { directory: (data.kind || existing.kind) === 'directory' });
    const sign = await prisma.venue_signs.findUnique({ where: { id: existing.id }, include: WITH_LINKS });
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
    const sign = await prisma.venue_signs.findFirst({ where: { id: req.params.signId, venue_id: req.params.id }, select: { id: true, kind: true, links: { select: { id: true, kind: true, title: true }, orderBy: { sort_order: 'asc' } } } });
    if (!sign) return res.status(404).json({ error: 'Aviso no encontrado' });
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * DAY);
    const [perDay, perDevice, perQr] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char((scanned_at AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS scans
        FROM venue_sign_scans WHERE sign_id = ${sign.id}::uuid AND scanned_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT device, COUNT(*)::int AS scans
        FROM venue_sign_scans WHERE sign_id = ${sign.id}::uuid AND scanned_at >= ${since}
        GROUP BY 1`,
      prisma.$queryRaw`
        SELECT link_id::text AS link_id, COUNT(*)::int AS scans
        FROM venue_sign_scans WHERE sign_id = ${sign.id}::uuid AND scanned_at >= ${since}
        GROUP BY 1`
    ]);
    // Scans of each QR of the sign: the main one first, then the extra ones.
    const byLink = Object.fromEntries(perQr.map(r => [r.link_id || 'main', r.scans]));
    const qrs = (sign.kind === 'directory' ? [] : [{ id: null, kind: sign.kind, main: true, scans: byLink.main || 0 }])
      .concat(sign.links.map(l => ({ id: l.id, kind: l.kind, title: l.title, main: false, scans: byLink[l.id] || 0 })));
    res.json({ days, per_day: perDay, per_device: perDevice, per_qr: qrs });
  }));

  // GET /q/:code — public: count the scan and send the person to the sign's destination
  app.get('/q/:code', async (req, res) => {
    const base = appBaseUrl();
    try {
      const code = String(req.params.code || '').toLowerCase();
      // A generated code, or a custom link (letters, numbers and dashes).
      const valid = /^[a-z0-9-]{3,40}$/.test(code);
      const byCode = { OR: [{ code }, { alias: code }] };
      let sign = valid
        ? await prisma.venue_signs.findFirst({ where: byCode, include: { venue: { select: VENUE_SELECT } } })
        : null;
      // Not a sign's main QR: maybe one of its extra QRs.
      const link = !sign && valid
        ? await prisma.venue_sign_links.findFirst({ where: byCode, include: { sign: { include: { venue: { select: VENUE_SELECT } } } } })
        : null;
      if (link) sign = link.sign;
      const target = link || sign;
      const destination = target && target.kind !== 'wifi' ? signDestination(target, sign.venue, base) : null;
      if (!destination) return res.redirect(302, base);

      const ua = req.get('user-agent') || '';
      if (!BOT_UA.test(ua)) {
        const device = deviceOf(ua);
        prisma.venue_sign_scans.create({ data: { sign_id: sign.id, link_id: link ? link.id : null, device } })
          .catch(err => console.error('[signs] scan not saved:', err.message));
        analytics.track('qr_scanned', {
          venueId: sign.venue_id,
          properties: { sign_id: sign.id, sign_code: sign.code, kind: target.kind, size: sign.size, device, qr: link ? 'extra' : 'main', ...(link && { link_code: link.code, sign_kind: sign.kind }) }
        });
      }
      res.set('Cache-Control', 'no-store');
      res.redirect(302, destination);
    } catch (error) {
      console.error('[signs] /q failed:', error.message);
      res.redirect(302, base);
    }
  });
}

module.exports = { registerVenueSignRoutes, signDestination, wifiPayload, signFields, signLinks, cleanAlias, newCode, deviceOf, displayPhone, instagramHandle, signCopyPrompt, parseSignCopy };
