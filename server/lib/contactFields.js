// How a contact can be reached: a phone number (WhatsApp, Telegram or SMS), a
// WhatsApp username, an Instagram @username or a Facebook username, plus the
// channel the host prefers. Each one is validated on its own, so having one never
// relaxes the rules of the other.

/**
 * Digits of a phone number, or null. A WhatsApp BSUID ("CO.123...") and Instagram
 * ids are not phone numbers; copied numbers can carry invisible direction marks.
 */
function cleanPhone(value) {
  const text = String(value || '').replace(/[‎‏‪-‮]/g, '').trim();
  if (!text || !/^\+?[\d\s().-]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** An Instagram @username (not a numeric IGSID), also from a profile link. */
function cleanInstagram(value) {
  const text = String(value || '').trim()
    .replace(/^https?:\/\//i, '').replace(/^(www\.)?(instagram\.com|ig\.me\/m)\//i, '')
    .split(/[/?#]/)[0];
  return /^@?[A-Za-z0-9._]{1,30}$/.test(text) && !/^\d+$/.test(text.replace('@', ''))
    ? (text.startsWith('@') ? text : `@${text}`)
    : null;
}

/**
 * A Facebook username (5 to 50 letters, digits or periods) or numeric profile id,
 * also from a profile or m.me link, or null.
 */
function cleanFacebook(value) {
  let text = String(value || '').trim();
  const id = text.match(/profile\.php\?id=(\d{5,20})/);
  if (id) return id[1];
  text = text.replace(/^https?:\/\//i, '')
    .replace(/^(www\.|m\.|web\.)?(facebook\.com|fb\.com|m\.me)\//i, '')
    .replace(/^@/, '').split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9.]{5,50}$/.test(text) || text.startsWith('.') || text.endsWith('.')) return null;
  return text;
}

/** Channels a host can prefer, and the contact field each one needs. */
const CONTACT_CHANNELS = {
  whatsapp: 'whatsapp',
  telegram: 'whatsapp',
  sms: 'whatsapp',
  whatsapp_user: 'whatsapp_username',
  instagram: 'instagram',
  facebook: 'facebook',
};

/**
 * A WhatsApp username in lowercase and without the @, or null. WhatsApp's rules:
 * 3 to 35 letters, digits, periods or underscores, at least one letter, and no
 * period at the start, at the end or twice in a row.
 */
function cleanWhatsappUsername(value) {
  const user = String(value || '').replace(/[‎‏‪-‮]/g, '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{3,35}$/.test(user) || !/[a-z]/.test(user)) return null;
  if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) return null;
  return user;
}

/**
 * The WhatsApp fields of a contact sent by a form, ready to store. Only the fields
 * present in `body` are returned; an empty value clears the field. Throws a 400
 * when a value is filled in but not valid.
 */
function contactWhatsappFields(body) {
  const out = {};
  if (body.whatsapp !== undefined) {
    const raw = String(body.whatsapp ?? '').trim();
    if (!raw) out.whatsapp = null;
    else {
      const digits = cleanPhone(raw);
      if (!digits) throw Object.assign(new Error('El número de teléfono no es válido: escribe solo el número, con o sin indicativo.'), { statusCode: 400 });
      out.whatsapp = digits;
    }
  }
  if (body.whatsapp_username !== undefined) {
    const raw = String(body.whatsapp_username ?? '').trim();
    if (!raw || raw === '@') out.whatsapp_username = null;
    else {
      const user = cleanWhatsappUsername(raw);
      if (!user) throw Object.assign(new Error('El usuario de WhatsApp no es válido: de 3 a 35 letras, números, puntos o guiones bajos, con al menos una letra.'), { statusCode: 400 });
      out.whatsapp_username = user;
    }
  }
  if (body.instagram !== undefined) {
    const raw = String(body.instagram ?? '').trim();
    if (!raw || raw === '@') out.instagram = null;
    else {
      const handle = cleanInstagram(raw);
      if (!handle) throw badRequest('El usuario de Instagram no es válido: hasta 30 letras, números, puntos o guiones bajos.');
      out.instagram = handle;
    }
  }
  if (body.facebook !== undefined) {
    const raw = String(body.facebook ?? '').trim();
    if (!raw || raw === '@') out.facebook = null;
    else {
      const user = cleanFacebook(raw);
      if (!user) throw badRequest('El usuario de Facebook no es válido: de 5 a 50 letras, números o puntos, o el enlace del perfil.');
      out.facebook = user;
    }
  }
  if (body.contact_channel !== undefined) {
    const channel = body.contact_channel || null;
    if (channel && !CONTACT_CHANNELS[channel]) throw badRequest('El medio de contacto no es válido.');
    // The preferred channel needs its field filled in, when the form sends that field.
    const field = channel && CONTACT_CHANNELS[channel];
    if (field && field in out && !out[field]) throw badRequest('Escribe el dato del medio de contacto elegido.');
    out.contact_channel = channel;
  }
  return out;
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

module.exports = {
  cleanPhone, cleanInstagram, cleanFacebook, cleanWhatsappUsername, contactWhatsappFields,
  contactChannelFields: contactWhatsappFields, CONTACT_CHANNELS,
};
