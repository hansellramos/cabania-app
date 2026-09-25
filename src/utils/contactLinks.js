// Links to reach a guest on the channel they have: WhatsApp when there is a
// number, otherwise an Instagram DM. Instagram links cannot prefill a message,
// so callers copy the text to the clipboard first.

/** WhatsApp link for a Colombian number stored with or without the 57 prefix. */
export function whatsappUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const number = digits.length === 10 ? `57${digits}` : digits
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Instagram DM link for an @username (with or without the @). */
export function instagramDmUrl(handle) {
  const user = String(handle || '').trim().replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(user) && !/^\d+$/.test(user) ? `https://ig.me/m/${user}` : null
}

/** The best way to message a contact: { channel, url, label } or null. */
export function contactChannel(contact, text) {
  const wa = whatsappUrl(contact?.whatsapp || contact?.phone, text)
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
