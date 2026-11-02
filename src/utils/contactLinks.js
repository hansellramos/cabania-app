// Links to reach a guest on the channel they have: WhatsApp, Telegram or SMS by
// phone; WhatsApp, Instagram or Facebook by username. Links that cannot prefill a
// message (Instagram, Facebook, Telegram) make callers copy the text first.

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

/** An Instagram @username (with the @) from a handle or a profile link, or null. */
export function cleanInstagramHandle(value) {
  const text = String(value || '').trim()
    .replace(/^https?:\/\//i, '').replace(/^(www\.)?(instagram\.com|ig\.me\/m)\//i, '')
    .split(/[/?#]/)[0]
  const user = text.replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(user) && !/^\d+$/.test(user) ? `@${user}` : null
}

/**
 * A Facebook username (5 to 50 letters, digits or periods) or numeric profile id,
 * also from a profile or m.me link, or null. Same rule as the server.
 */
export function cleanFacebook(value) {
  let text = String(value || '').trim()
  const id = text.match(/profile\.php\?id=(\d{5,20})/)
  if (id) return id[1]
  text = text.replace(/^https?:\/\//i, '')
    .replace(/^(www\.|m\.|web\.)?(facebook\.com|fb\.com|m\.me)\//i, '')
    .replace(/^@/, '').split(/[/?#]/)[0]
  if (!/^[A-Za-z0-9.]{5,50}$/.test(text) || text.startsWith('.') || text.endsWith('.')) return null
  return text
}

/** Messenger link for a Facebook username or profile id. */
export function facebookMessengerUrl(value) {
  const user = cleanFacebook(value)
  return user ? `https://m.me/${user}` : null
}

/** International digits of a phone stored with or without the Colombian 57 prefix. */
function internationalDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return digits.length === 10 ? `57${digits}` : digits
}

/** Telegram chat by phone number (opens it when the guest allows being found by number). */
export function telegramPhoneUrl(phone) {
  const number = internationalDigits(phone)
  return number ? `https://t.me/+${number}` : null
}

/** Text message (SMS) link, with the text prefilled. */
export function smsUrl(phone, text) {
  const number = internationalDigits(phone)
  return number ? `sms:+${number}${text ? `?&body=${encodeURIComponent(text)}` : ''}` : null
}

/**
 * Ways to message a guest. `kind` groups them in the form (by phone or by
 * username), `field` is the contact field each one uses and `prefill` says whether
 * the link carries the text (otherwise callers copy it to the clipboard first).
 */
export const CONTACT_CHANNELS = {
  whatsapp: { kind: 'phone', field: 'whatsapp', label: 'WhatsApp', icon: 'cibWhatsapp', color: 'success', prefill: true },
  telegram: { kind: 'phone', field: 'whatsapp', label: 'Telegram', icon: 'cibTelegramPlane', color: 'info', prefill: false },
  sms: { kind: 'phone', field: 'whatsapp', label: 'SMS', icon: 'cilCommentBubble', color: 'secondary', prefill: true },
  whatsapp_user: { kind: 'user', field: 'whatsapp_username', label: 'WhatsApp', icon: 'cibWhatsapp', color: 'success', prefill: true },
  instagram: { kind: 'user', field: 'instagram', label: 'Instagram', icon: 'cibInstagram', color: 'danger', prefill: false },
  facebook: { kind: 'user', field: 'facebook', label: 'Facebook', icon: 'cibMessenger', color: 'primary', prefill: false },
}

/** Link to message a contact on one channel, or null when the contact lacks that data. */
export function channelUrl(channel, contact, text) {
  switch (channel) {
    case 'whatsapp': return whatsappUrl(contact?.whatsapp || contact?.phone, text)
    case 'telegram': return telegramPhoneUrl(contact?.whatsapp || contact?.phone)
    case 'sms': return smsUrl(contact?.whatsapp || contact?.phone, text)
    case 'whatsapp_user': return whatsappUsernameUrl(contact?.whatsapp_username, text)
    case 'instagram': return instagramDmUrl(contact?.instagram)
    case 'facebook': return facebookMessengerUrl(contact?.facebook)
    default: return null
  }
}

/** The value a contact has for a channel, as shown to the host (e.g. "@user"). */
export function channelValue(channel, contact) {
  const meta = CONTACT_CHANNELS[channel]
  const value = meta && contact?.[meta.field]
  if (!value) return ''
  if (meta.kind === 'phone') return String(value)
  return channel === 'facebook' ? String(value) : `@${String(value).replace(/^@/, '')}`
}

/**
 * The way to message a contact: the channel the host chose for them, else WhatsApp
 * (number, then username), Instagram or Facebook. Returns
 * { channel, url, label, icon, color, prefill } or null.
 */
export function contactChannel(contact, text) {
  const order = [contact?.contact_channel, 'whatsapp', 'whatsapp_user', 'instagram', 'facebook']
  for (const channel of order) {
    if (!CONTACT_CHANNELS[channel]) continue
    const url = channelUrl(channel, contact, text)
    if (url) return { channel, url, ...CONTACT_CHANNELS[channel] }
  }
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

/** Why a value typed for a channel is not valid, or '' when it is valid or empty. */
export function channelError(channel, value) {
  const text = String(value || '').trim()
  if (!text || text === '@') return ''
  const kind = CONTACT_CHANNELS[channel]?.kind
  if (kind === 'phone') return whatsappNumberError(text)
  if (channel === 'whatsapp_user') return whatsappUsernameError(text)
  if (channel === 'instagram') return cleanInstagramHandle(text) ? '' : 'Hasta 30 letras, números, puntos o guiones bajos, o el enlace del perfil.'
  if (channel === 'facebook') return cleanFacebook(text) ? '' : 'De 5 a 50 letras, números o puntos, o el enlace del perfil.'
  return ''
}

/** The channel to preselect for a contact: the saved one, else the first one with data. */
export function initialChannel(contact) {
  if (CONTACT_CHANNELS[contact?.contact_channel]) return contact.contact_channel
  if (contact?.whatsapp) return 'whatsapp'
  if (contact?.whatsapp_username) return 'whatsapp_user'
  if (contact?.instagram) return 'instagram'
  if (contact?.facebook) return 'facebook'
  return 'whatsapp'
}
