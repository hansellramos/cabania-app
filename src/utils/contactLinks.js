// Links to reach a guest on the channel they have: WhatsApp by number or by
// username, otherwise an Instagram DM. Instagram links cannot prefill a message,
// so callers copy the text to the clipboard first.

/** WhatsApp link for a Colombian number stored with or without the 57 prefix. */
export function whatsappUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const number = digits.length === 10 ? `57${digits}` : digits
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/**
 * A WhatsApp username in lowercase and without the @, or null. Same rules as
 * WhatsApp (and server/lib/contactFields.js): 3 to 35 letters, digits, periods or
 * underscores, at least one letter, no period at the start, the end or twice in a row.
 */
export function cleanWhatsappUsername(value) {
  const user = String(value || '').trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._]{3,35}$/.test(user) || !/[a-z]/.test(user)) return null
  if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) return null
  return user
}

/** Digits of a WhatsApp number (8 to 15, with or without +, spaces or dashes), or null. Same rule as the server. */
export function cleanWhatsappNumber(value) {
  const text = String(value || '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
  if (!text || !/^\+?[\d\s().-]+$/.test(text)) return null
  const digits = text.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

/** Why a typed WhatsApp number is not valid, or '' when it is valid or empty. */
export function whatsappNumberError(value) {
  return String(value || '').trim() && !cleanWhatsappNumber(value)
    ? 'Escribe solo el número, con o sin indicativo (de 8 a 15 dígitos).'
    : ''
}

/** Why a typed WhatsApp username is not valid, or '' when it is valid or empty. */
export function whatsappUsernameError(value) {
  const text = String(value || '').trim()
  return text && text !== '@' && !cleanWhatsappUsername(text)
    ? 'De 3 a 35 letras, números, puntos o guiones bajos, con al menos una letra y sin punto al inicio ni al final.'
    : ''
}

/** Text typed in a number field that is really a username (it has letters or an @). */
export function looksLikeWhatsappUsername(value) {
  return /[A-Za-z@_]/.test(String(value || ''))
}

/** WhatsApp link for a username, with the text prefilled like a number link. */
export function whatsappUsernameUrl(username, text) {
  const user = cleanWhatsappUsername(username)
  if (!user) return null
  const query = [text && `text=${encodeURIComponent(text)}`, `username=${user}`, 'type=username', 'app_absent=0']
  return `https://api.whatsapp.com/send/?${query.filter(Boolean).join('&')}`
}

/** WhatsApp link for a contact: by number when there is one, else by username. */
export function contactWhatsappUrl(contact, text) {
  return whatsappUrl(contact?.whatsapp || contact?.phone, text) || whatsappUsernameUrl(contact?.whatsapp_username, text)
}

/** Instagram DM link for an @username (with or without the @). */
export function instagramDmUrl(handle) {
  const user = String(handle || '').trim().replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(user) && !/^\d+$/.test(user) ? `https://ig.me/m/${user}` : null
}

/** The best way to message a contact: { channel, url, label } or null. */
export function contactChannel(contact, text) {
  const wa = contactWhatsappUrl(contact, text)
  if (wa) return { channel: 'whatsapp', url: wa, label: 'WhatsApp' }
  const ig = instagramDmUrl(contact?.instagram)
  if (ig) return { channel: 'instagram', url: ig, label: 'Instagram' }
  return null
}

/** Copy to the clipboard, ignoring browsers that refuse it. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Public page of a venue, as a path (not a hash link) so WhatsApp and Instagram
 * preview it with the venue's name and photo. Null while it is not published.
 */
export function publicVenueUrl(venue) {
  if (!venue?.is_public || !venue.slug) return null
  const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')
  return `${base}/p/${venue.slug}`
}
