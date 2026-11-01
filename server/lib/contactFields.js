// How a contact can be reached: a WhatsApp number, a WhatsApp username or an
// Instagram @username. Each one is validated on its own, so having one never
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

/** An Instagram @username (not a numeric IGSID). */
function cleanInstagram(value) {
  const text = String(value || '').trim();
  return /^@?[A-Za-z0-9._]{1,30}$/.test(text) && !/^\d+$/.test(text.replace('@', ''))
    ? (text.startsWith('@') ? text : `@${text}`)
    : null;
}

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
      if (!digits) throw Object.assign(new Error('El número de WhatsApp no es válido: escribe solo el número, con o sin indicativo.'), { statusCode: 400 });
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
  return out;
}

module.exports = { cleanPhone, cleanInstagram, cleanWhatsappUsername, contactWhatsappFields };
