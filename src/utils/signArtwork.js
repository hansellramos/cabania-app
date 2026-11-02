// Artwork of a printed sign as an SVG measured in millimetres, so it prints at its
// real size (letter, half letter, A3 or a 3×1 m banner) and print shops get a
// vector file. The QR comes from the `qrcode` package as vector paths too.
import QRCode from 'qrcode'

export const SIGN_SIZES = {
  letter: { label: 'Carta (21,6 × 27,9 cm)', width: 216, height: 279 },
  half_letter: { label: 'Media carta, para mesa (14 × 21,6 cm)', width: 140, height: 216 },
  a3: { label: 'Póster A3 (29,7 × 42 cm)', width: 297, height: 420 },
  banner_3x1: { label: 'Pasacalles (3 × 1 m)', width: 3000, height: 1000 },
}

export const SIGN_KINDS = {
  public_page: { label: 'Página pública', headline: 'Reserva aquí', icon: 'cilGlobeAlt', color: 'info' },
  whatsapp: { label: 'WhatsApp', headline: 'Escríbenos por WhatsApp', icon: 'cibWhatsapp', color: 'success' },
  instagram: { label: 'Instagram', headline: 'Síguenos en Instagram', icon: 'cibInstagram', color: 'danger' },
  url: { label: 'Otro enlace', headline: 'Más información', icon: 'cilLink', color: 'secondary' },
  wifi: { label: 'WiFi', headline: 'Conéctate al WiFi', icon: 'cilWifiSignal4', color: 'primary' },
}

const INK = '#1d1d1b'
const ACCENT = '#0b6e4f'
const MUTED = '#5f5f5a'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Split text into lines of about `maxChars` characters, at most `maxLines` (the last one cut with …). */
function wrap(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.{0,1}$/, '')}…`
    return kept
  }
  return lines
}

/**
 * Lines and font size for text in a box `width` wide: the biggest size from `size`
 * down to 55% of it at which the text fits in `maxLines` lines without cutting.
 */
function fitText(text, width, size, maxLines) {
  for (let s = size; s >= size * 0.55; s *= 0.92) {
    const maxChars = Math.floor(width / (s * 0.56))
    const lines = wrap(text, maxChars, maxLines + 1)
    if (lines.length <= maxLines && lines.every(l => l.length <= maxChars)) return { lines, size: s }
  }
  const small = size * 0.55
  return { lines: wrap(text, Math.floor(width / (small * 0.56)), maxLines), size: small }
}

/** Centred (or left-aligned) lines of text starting at baseline y; returns the svg and the y after them. */
function textBlock(lines, { x, y, size, weight = 400, color = INK, anchor = 'middle', lineHeight = 1.15, family = FONT }) {
  const svg = lines.map((line, i) =>
    `<text x="${x}" y="${(y + i * size * lineHeight).toFixed(1)}" font-family="${family}" font-size="${size.toFixed(1)}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(line)}</text>`
  ).join('')
  return { svg, bottom: y + (lines.length - 1) * size * lineHeight }
}

/** The QR as a nested svg of side `side` at (x, y), on a white square with a quiet zone. */
async function qrBlock(text, x, y, side) {
  const raw = await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } })
  const modules = Number(raw.match(/viewBox="0 0 (\d+) \d+"/)?.[1] || 25)
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const pad = side * 0.06
  return `<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="#ffffff"/>`
    + `<svg x="${x + pad}" y="${y + pad}" width="${side - 2 * pad}" height="${side - 2 * pad}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges">${inner}</svg>`
}

const displayUrl = (url) => String(url || '').replace(/^https?:\/\//, '')

/**
 * The sign as an SVG string.
 * sign: { kind, size, headline } · venueName · qrText (what the QR encodes) ·
 * shortUrl (printed under the QR) · wifi: { ssid, password } for WiFi signs.
 */
export async function signSvg({ sign, venueName, qrText, shortUrl, wifi }) {
  const { width: W, height: H } = SIGN_SIZES[sign.size] || SIGN_SIZES.letter
  const headline = sign.headline || SIGN_KINDS[sign.kind]?.headline || ''
  const isWifi = sign.kind === 'wifi'
  const parts = []

  if (W > H) {
    // Banner: text on the left, a big QR on the right.
    const m = H * 0.08
    const side = H - 2 * m - H * 0.08
    const qrX = W - m - side
    const textW = qrX - 2 * m
    const center = m + textW / 2
    const nameSize = H * 0.13
    const headSize = H * 0.2
    let y = m + nameSize
    const nameFit = fitText(venueName, textW, nameSize, 1)
    const name = textBlock(nameFit.lines, { x: center, y, size: nameFit.size, weight: 700 })
    parts.push(name.svg)
    const headFit = fitText(headline, textW, headSize, 2)
    y = name.bottom + headFit.size * 1.35
    const head = textBlock(headFit.lines, { x: center, y, size: headFit.size, weight: 800, color: ACCENT })
    parts.push(head.svg)
    const footSize = H * 0.075
    const foot = isWifi
      ? [`Red: ${wifi?.ssid || ''}`, `Clave: ${wifi?.password || 'sin clave'}`]
      : [displayUrl(shortUrl)]
    parts.push(textBlock(foot, { x: center, y: H - m - (foot.length - 1) * footSize * 1.2, size: footSize, weight: 600, color: isWifi ? INK : MUTED, lineHeight: 1.2 }).svg)
    if (qrText) parts.push(await qrBlock(qrText, qrX, m, side))
    parts.push(textBlock(['Escanea con la cámara'], { x: qrX + side / 2, y: H - m * 0.55, size: H * 0.045, color: MUTED }).svg)
  } else {
    // Portrait: name, headline, QR, then the link (or the network and password).
    const m = W * 0.08
    const center = W / 2
    const nameSize = W * 0.07
    const headSize = W * 0.105
    let y = m + nameSize
    const nameFit = fitText(venueName, W - 2 * m, nameSize, 2)
    const name = textBlock(nameFit.lines, { x: center, y, size: nameFit.size, weight: 700 })
    parts.push(name.svg)
    const headFit = fitText(headline, W - 2 * m, headSize, 3)
    y = name.bottom + headFit.size * 1.5
    const head = textBlock(headFit.lines, { x: center, y, size: headFit.size, weight: 800, color: ACCENT })
    parts.push(head.svg)
    y = head.bottom + headFit.size * 0.7

    const footSize = W * (isWifi ? 0.06 : 0.042)
    const footLines = isWifi
      ? [`Red: ${wifi?.ssid || ''}`, `Clave: ${wifi?.password || 'sin clave'}`]
      : [displayUrl(shortUrl)]
    const footHeight = footLines.length * footSize * 1.3 + W * 0.05
    const side = Math.min(W - 2 * m, H - y - m - footHeight - W * 0.06)
    if (qrText) parts.push(await qrBlock(qrText, center - side / 2, y, side))
    y += side + W * 0.05
    parts.push(textBlock(['Escanea con la cámara de tu celular'], { x: center, y, size: W * 0.033, color: MUTED }).svg)
    y += footSize * 1.6
    parts.push(textBlock(footLines, { x: center, y, size: footSize, weight: isWifi ? 700 : 500, color: isWifi ? INK : MUTED, lineHeight: 1.3 }).svg)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#ffffff"/>${parts.join('')}</svg>`
}

/** Open the sign alone in a new window at its real size and show the print dialog. */
export function printSign(svg, size, title) {
  const { width: W, height: H } = SIGN_SIZES[size] || SIGN_SIZES.letter
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page { size: ${W}mm ${H}mm; margin: 0 } html, body { margin: 0; background: #fff }
svg { display: block; width: ${W}mm; height: ${H}mm }</style></head>
<body>${svg}<script>window.onload = () => { window.focus(); window.print() }<\/script></body></html>`)
  win.document.close()
  return true
}

/** Download the sign as an SVG file (vector, at real size, for print shops). */
export function downloadSign(svg, fileName) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
