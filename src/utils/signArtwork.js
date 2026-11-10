// Artwork of a printed sign as an SVG measured in millimetres, so it prints at its
// real size (letter, half letter, A3 or a 3×1 m banner) and print shops get a
// vector file. The background is the venue's brand gradient (the one of its public
// page), with its logo on top and the QR on a white card with the channel's logo
// (WhatsApp, Instagram, WiFi...) in the middle.
import QRCode from 'qrcode'
import { cibWhatsapp, cibInstagram, cilGlobeAlt, cilLink } from '@coreui/icons'

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

export const SIGN_STYLES = {
  gradient: { label: 'Degradado de la cabaña' },
  light: { label: 'Fondo blanco (ahorra tinta)' },
}

const INK = '#1d1d1b'
const MUTED = '#6b6b66'
const DEFAULT_PRIMARY = '#10b981'
const DEFAULT_SECONDARY = '#0ea5e9'
const WHATSAPP_GREEN = '#25D366'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- colors ----------

const validHex = (value) => (/^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : null)

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Relative luminance (0 black … 1 white). */
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The color mixed with black until it reads on white. */
function readableOnWhite(hex) {
  let [r, g, b] = rgb(hex)
  for (let i = 0; i < 10 && luminance(`#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`) > 0.3; i++) {
    r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85)
  }
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Colors of a sign: the venue's gradient (or white) and text that reads on it. */
function palette(style, colors) {
  const primary = validHex(colors?.primary) || DEFAULT_PRIMARY
  const secondary = validHex(colors?.secondary) || DEFAULT_SECONDARY
  if (style === 'light') {
    const accent = readableOnWhite(primary)
    return { light: true, primary, secondary, text: INK, soft: MUTED, accent }
  }
  // A pale gradient (yellow, pastel) gets dark text instead of white.
  const pale = (luminance(primary) + luminance(secondary)) / 2 > 0.5
  const text = pale ? INK : '#ffffff'
  return { light: false, primary, secondary, text, soft: pale ? 'rgba(29,29,27,0.78)' : 'rgba(255,255,255,0.92)', accent: text }
}

// ---------- text ----------

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

/** Like wrap, but keeps the line breaks the person typed. */
function wrapParagraphs(text, maxChars, maxLines) {
  const lines = String(text || '').split('\n').map(p => p.trim()).filter(Boolean)
    .flatMap(p => wrap(p, maxChars, maxLines + 1))
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.{0,1}$/, '')}…`
    return kept
  }
  return lines
}

/**
 * Lines and font size for text in a box `width` wide: the biggest size from `size`
 * down to `min` of it at which the text fits in `maxLines` lines without cutting.
 */
function fitText(text, width, size, maxLines, { paragraphs = false, min = 0.55, bold = true } = {}) {
  const split = paragraphs ? wrapParagraphs : wrap
  const charW = bold ? 0.58 : 0.52
  for (let s = size; s >= size * min; s *= 0.92) {
    const maxChars = Math.floor(width / (s * charW))
    const lines = split(text, maxChars, maxLines + 1)
    if (lines.length <= maxLines && lines.every(l => l.length <= maxChars)) return { lines, size: s }
  }
  const small = size * min
  return { lines: split(text, Math.floor(width / (small * charW)), maxLines), size: small }
}

const blockHeight = (fit, lineHeight = 1.15) => (fit.lines.length ? fit.size * (1 + (fit.lines.length - 1) * lineHeight) : 0)

/** Lines of text whose first line's top is at y; returns the svg. */
function textBlock(fit, { x, y, weight = 400, color = INK, anchor = 'middle', lineHeight = 1.15, spacing = 0 }) {
  // The baseline sits about 0.8 of the font size under the top of the line.
  return fit.lines.map((line, i) =>
    `<text x="${x.toFixed(1)}" y="${(y + fit.size * 0.8 + i * fit.size * lineHeight).toFixed(1)}" font-family="${FONT}" font-size="${fit.size.toFixed(1)}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${(fit.size * spacing).toFixed(2)}"` : ''}>${esc(line)}</text>`
  ).join('')
}

// ---------- pieces ----------

// The usual WiFi symbol: three arcs over a dot.
const WIFI_ICON = ['24 24', "<g fill='none' stroke='#ffffff' stroke-width='2.3' stroke-linecap='round'><path d='M2.5 9a14 14 0 0 1 19 0'/><path d='M5.8 12.6a9.2 9.2 0 0 1 12.4 0'/><path d='M9.1 16.1a4.5 4.5 0 0 1 5.8 0'/></g><circle cx='12' cy='19.6' r='1.7'/>"]
const ICONS = { whatsapp: cibWhatsapp, instagram: cibInstagram, wifi: WIFI_ICON, public_page: cilGlobeAlt, url: cilLink }

/** The channel's logo: a coloured disc (a rounded square for Instagram) with a white glyph. */
function channelBadge(kind, cx, cy, d, pal, id) {
  const icon = ICONS[kind] || cilLink
  const glyph = icon[1].replace(/var\(--ci-primary-color,\s*currentColor\)/g, '#ffffff')
  const g = d * (kind === 'instagram' ? 0.56 : 0.6)
  const shape = kind === 'instagram'
    ? `<rect x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}" rx="${d * 0.28}" fill="url(#${id}-ig)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="${kind === 'whatsapp' ? WHATSAPP_GREEN : pal.light ? pal.accent : pal.primary}"/>`
  return shape
    + `<svg x="${cx - g / 2}" y="${cy - g / 2}" width="${g}" height="${g}" viewBox="0 0 ${icon[0]}"><g fill="#ffffff">${glyph}</g></svg>`
}

/** The QR (vector) of side `side` at (x, y), with the channel's logo in the middle. */
async function qrBlock(text, x, y, side, kind, pal, id) {
  const raw = await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'H', color: { dark: INK, light: '#ffffff' } })
  const modules = Number(raw.match(/viewBox="0 0 (\d+) \d+"/)?.[1] || 25)
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const d = side * 0.2
  const cx = x + side / 2
  const cy = y + side / 2
  return `<svg x="${x}" y="${y}" width="${side}" height="${side}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges">${inner}</svg>`
    + `<rect x="${cx - d * 0.64}" y="${cy - d * 0.64}" width="${d * 1.28}" height="${d * 1.28}" rx="${d * 0.32}" fill="#ffffff"/>`
    + channelBadge(kind, cx, cy, d, pal, id)
}

/** The venue's logo in a white disc. */
function logoBlock(logo, cx, cy, d, id) {
  const inset = d * 0.1
  return `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="#ffffff"/>`
    + `<clipPath id="${id}-logo"><circle cx="${cx}" cy="${cy}" r="${d / 2 - inset * 0.4}"/></clipPath>`
    + `<image href="${esc(logo)}" xlink:href="${esc(logo)}" x="${cx - d / 2 + inset}" y="${cy - d / 2 + inset}" width="${d - 2 * inset}" height="${d - 2 * inset}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id}-logo)"/>`
}

function background(W, H, pal, id) {
  const defs = `<defs>`
    + `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.primary}"/><stop offset="1" stop-color="${pal.secondary}"/></linearGradient>`
    + `<linearGradient id="${id}-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset="0.3" stop-color="#fa7e1e"/><stop offset="0.6" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient>`
    // The circles are cut at the sheet's edge, so nothing paints outside the sign.
    + `<clipPath id="${id}-sheet"><rect width="${W}" height="${H}"/></clipPath>`
    + `</defs>`
  const big = Math.max(W, H)
  if (pal.light) {
    const bar = Math.min(W, H) * 0.03
    return defs
      + `<rect width="${W}" height="${H}" fill="#ffffff"/>`
      + `<g clip-path="url(#${id}-sheet)">`
      + `<circle cx="${W * 0.95}" cy="${H * 0.04}" r="${big * 0.28}" fill="${pal.primary}" opacity="0.07"/>`
      + `<circle cx="${W * 0.02}" cy="${H * 0.98}" r="${big * 0.22}" fill="${pal.secondary}" opacity="0.07"/>`
      + `</g>`
      + `<rect width="${W}" height="${bar}" fill="url(#${id}-bg)"/>`
      + `<rect y="${H - bar}" width="${W}" height="${bar}" fill="url(#${id}-bg)"/>`
  }
  // Soft light circles, like the glow on the public page.
  return defs
    + `<rect width="${W}" height="${H}" fill="url(#${id}-bg)"/>`
    + `<g clip-path="url(#${id}-sheet)">`
    + `<circle cx="${W * 0.92}" cy="${H * 0.06}" r="${big * 0.32}" fill="#ffffff" opacity="0.10"/>`
    + `<circle cx="${W * 0.04}" cy="${H * 0.96}" r="${big * 0.26}" fill="#ffffff" opacity="0.08"/>`
    + `</g>`
}

/** White card with a soft shadow. */
function card(x, y, w, h, r, pal) {
  return `<rect x="${x}" y="${y + r * 0.25}" width="${w}" height="${h}" rx="${r}" fill="#000000" opacity="${pal.light ? 0.06 : 0.12}"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff"${pal.light ? ` stroke="#e4e4e0" stroke-width="${(r * 0.04).toFixed(2)}"` : ''}/>`
}

const displayUrl = (url) => String(url || '').replace(/^https?:\/\//, '')

/** What is printed under the QR, inside the card: the number, the @user, the link, or the network. */
function channelLines(sign, { shortUrl, wifi, whatsapp, instagram }) {
  switch (sign.kind) {
    case 'wifi': return [`Red: ${wifi?.ssid || ''}`, `Clave: ${wifi?.password || 'sin clave'}`]
    case 'whatsapp': return [whatsapp || 'WhatsApp']
    case 'instagram': return [instagram ? `@${instagram}` : 'Instagram']
    default: return [displayUrl(shortUrl)]
  }
}

// The name printed next to an extra (small) QR.
export const EXTRA_QR_LABELS = { whatsapp: 'WhatsApp', instagram: 'Instagram', public_page: 'Reservas', url: 'Más info' }

/** What is printed under an extra QR's name: the number, the @user or the short link. */
function extraCaption(kind, { shortUrl, whatsapp, instagram }) {
  if (kind === 'whatsapp') return whatsapp || ''
  if (kind === 'instagram') return instagram ? `@${instagram}` : ''
  return displayUrl(shortUrl)
}

/** An extra QR: a small white card with the QR on the left and its name and caption on the right. */
async function extraChip(extra, x, y, w, h, pal, id, art) {
  const p = h * 0.12
  const side = h - 2 * p
  const tx = x + p + side + p * 0.8
  const tw = Math.max(w - (tx - x) - p * 0.7, h * 0.4)
  const label = fitText(EXTRA_QR_LABELS[extra.kind] || '', tw, h * 0.17, 1, { min: 0.5 })
  const caption = fitText(extraCaption(extra.kind, { ...art, shortUrl: extra.shortUrl }), tw, h * 0.11, 2, { bold: false, min: 0.5 })
  const textH = blockHeight(label) + (caption.lines.length ? h * 0.05 + blockHeight(caption, 1.2) : 0)
  const ty = y + (h - textH) / 2
  return card(x, y, w, h, h * 0.12, pal)
    + (extra.qrText ? await qrBlock(extra.qrText, x + p, y + p, side, extra.kind, pal, id) : '')
    + textBlock(label, { x: tx, y: ty, weight: 800, anchor: 'start' })
    + (caption.lines.length ? textBlock(caption, { x: tx, y: ty + blockHeight(label) + h * 0.05, weight: 500, color: MUTED, anchor: 'start', lineHeight: 1.2 }) : '')
}

// ---------- the sign ----------

/**
 * The sign as an SVG string.
 * sign: { kind, size, style, headline, body } · venueName · qrText (what the QR encodes) ·
 * shortUrl · wifi: { ssid, password } · colors: { primary, secondary } · logo (data URL
 * or URL) · whatsapp ("300 123 4567") · instagram (handle).
 */
export async function signSvg({ sign, venueName, qrText, shortUrl, wifi, colors, logo, whatsapp, instagram, extras = [] }) {
  const { width: W, height: H } = SIGN_SIZES[sign.size] || SIGN_SIZES.letter
  const headline = sign.headline || SIGN_KINDS[sign.kind]?.headline || ''
  const pal = palette(sign.style, colors)
  const id = `s${Math.random().toString(36).slice(2, 8)}`
  const isWifi = sign.kind === 'wifi'
  const lines = channelLines(sign, { shortUrl, wifi, whatsapp, instagram })
  const parts = [background(W, H, pal, id)]
  // Extra small QRs (e.g. WhatsApp and Instagram under the booking QR): at most two.
  const extraQrs = (extras || []).slice(0, 2)
  const art = { whatsapp, instagram }

  if (W > H) {
    // Banner: logo on the left, text in the middle, QR card on the right.
    const m = H * 0.09
    const cardH = H - 2 * m
    const pad = cardH * 0.07
    const capSize = H * (isWifi ? 0.06 : 0.055)
    const capH = lines.length * capSize * 1.25 + pad * 0.5
    const side = cardH - 2 * pad - capH
    const capW = Math.max(...lines.map(l => l.length)) * capSize * 0.58
    const cardW = Math.max(side, capW) + 2 * pad
    const cardX = W - m - cardW
    parts.push(card(cardX, m, cardW, cardH, H * 0.05, pal))
    // Extra QRs stacked in a column left of the main card.
    let textRight = cardX
    if (extraQrs.length) {
      const gapY = H * 0.04
      const chipH = (cardH - gapY) / 2
      const chipW = chipH * 2.5
      const chipX = cardX - m * 0.6 - chipW
      const top = extraQrs.length === 1 ? m + (cardH - chipH) / 2 : m
      for (const [i, extra] of extraQrs.entries()) {
        parts.push(await extraChip(extra, chipX, top + i * (chipH + gapY), chipW, chipH, pal, id, art))
      }
      textRight = chipX
    }
    if (qrText) parts.push(await qrBlock(qrText, cardX + (cardW - side) / 2, m + pad, side, sign.kind, pal, id))
    parts.push(textBlock({ lines, size: capSize }, { x: cardX + cardW / 2, y: m + pad + side + pad * 0.5, weight: 700, lineHeight: 1.25 }))

    let left = m
    if (logo) {
      const d = H * 0.56
      parts.push(logoBlock(logo, m + d / 2, H / 2, d, id))
      left = m + d + m * 0.9
    }
    const textW = textRight - m - left
    const cx = left + textW / 2
    const name = fitText(venueName, textW, H * 0.1, 1)
    const head = fitText(headline, textW, H * 0.22, 2)
    const body = sign.body ? fitText(sign.body, textW, H * 0.075, 2, { paragraphs: true, bold: false, min: 0.6 }) : { lines: [], size: 0 }
    const gap = H * 0.05
    const total = blockHeight(name) + gap + blockHeight(head, 1.05) + (body.lines.length ? gap + blockHeight(body, 1.25) : 0)
    let y = (H - total) / 2
    parts.push(textBlock(name, { x: cx, y, weight: 700, color: pal.soft, spacing: 0.04 }))
    y += blockHeight(name) + gap
    parts.push(textBlock(head, { x: cx, y, weight: 800, color: pal.accent, lineHeight: 1.05 }))
    y += blockHeight(head, 1.05) + gap
    if (body.lines.length) parts.push(textBlock(body, { x: cx, y, weight: 500, color: pal.text, lineHeight: 1.25 }))
  } else {
    // Portrait: logo, name, headline, the QR card, then the free text. Everything
    // above and below the card shrinks together until the QR gets at least half
    // the width of the sheet.
    const m = W * 0.08
    const cx = W / 2
    const pad = W * 0.055
    const hint = { lines: ['Escanea con la cámara de tu celular'], size: W * 0.03 }
    const capSize = W * (isWifi ? 0.05 : 0.045)
    const capH = hint.size + W * 0.025 + lines.length * capSize * 1.3
    const capW = Math.max(hint.lines[0].length * hint.size * 0.5, ...lines.map(l => l.length * capSize * 0.58))
    const minSide = W * (extraQrs.length ? 0.36 : 0.42)
    // The extra QRs go in a row of small cards under the main card.
    const chipH = W * 0.17
    const extrasH = extraQrs.length ? chipH + W * 0.04 : 0

    const layout = (k) => {
      const logoD = logo ? W * 0.2 * k : 0
      const name = fitText(venueName, W - 2 * m, W * 0.055 * Math.max(k, 0.8), 2)
      const head = fitText(headline, W - 2 * m, W * 0.105 * k, 3)
      const body = sign.body ? fitText(sign.body, W - 2 * m, W * 0.045 * Math.max(k, 0.8), 4, { paragraphs: true, bold: false, min: 0.65 }) : { lines: [], size: 0 }
      const top = m + (logoD ? logoD + W * 0.04 * k : 0) + blockHeight(name) + W * 0.035 * k + blockHeight(head, 1.08) + W * 0.06 * k
      const bodyH = body.lines.length ? blockHeight(body, 1.3) + W * 0.05 * k : 0
      const side = Math.min(W - 2 * m - 2 * pad, H - m - bodyH - extrasH - top - 2 * pad - capH - pad * 0.4)
      return { k, logoD, name, head, body, side }
    }
    let L = layout(1)
    for (let k = 0.92; L.side < minSide && k >= 0.6; k -= 0.08) L = layout(k)
    const side = Math.max(L.side, W * 0.3)
    const k = L.k

    let y = m
    if (L.logoD) {
      parts.push(logoBlock(logo, cx, y + L.logoD / 2, L.logoD, id))
      y += L.logoD + W * 0.04 * k
    }
    parts.push(textBlock(L.name, { x: cx, y, weight: 700, color: pal.soft, spacing: 0.04 }))
    y += blockHeight(L.name) + W * 0.035 * k
    parts.push(textBlock(L.head, { x: cx, y, weight: 800, color: pal.accent, lineHeight: 1.08 }))
    y += blockHeight(L.head, 1.08) + W * 0.06 * k

    const cardW = Math.min(W - 2 * m, Math.max(side, capW) + 2 * pad)
    const cardH = side + 2 * pad + capH + pad * 0.4
    parts.push(card(cx - cardW / 2, y, cardW, cardH, W * 0.045, pal))
    if (qrText) parts.push(await qrBlock(qrText, cx - side / 2, y + pad, side, sign.kind, pal, id))
    let cy = y + pad + side + pad * 0.55
    parts.push(textBlock(hint, { x: cx, y: cy, color: MUTED }))
    cy += hint.size + W * 0.025
    const cap = fitText(lines.join('\n'), cardW - pad, capSize, lines.length, { paragraphs: true, min: 0.6 })
    parts.push(textBlock(cap, { x: cx, y: cy, weight: 700, lineHeight: 1.3 }))
    y += cardH

    if (extraQrs.length) {
      const gapX = W * 0.03
      const rowW = W - 2 * m
      const chipW = extraQrs.length === 1 ? rowW * 0.62 : (rowW - gapX) / 2
      let x = extraQrs.length === 1 ? cx - chipW / 2 : m
      for (const [i, extra] of extraQrs.entries()) {
        parts.push(await extraChip(extra, x, y + W * 0.04, chipW, chipH, pal, id, art))
        x += chipW + gapX
      }
      y += extrasH
    }

    if (L.body.lines.length) {
      // Centre the free text in the space left under the card.
      const room = H - m - y
      parts.push(textBlock(L.body, { x: cx, y: y + (room - blockHeight(L.body, 1.3)) / 2, weight: 500, color: pal.text, lineHeight: 1.3 }))
    }
  }

  if (sign.powered_by !== false) {
    // Small credit in the bottom margin, under everything else.
    const size = W > H ? H * 0.032 : W * 0.02
    const margin = W > H ? H * 0.09 : W * 0.08
    parts.push(`<text x="${(W / 2).toFixed(1)}" y="${(H - margin * 0.38).toFixed(1)}" font-family="${FONT}" font-size="${size.toFixed(2)}" font-weight="500" fill="${pal.soft}" fill-opacity="0.75" text-anchor="middle" letter-spacing="${(size * 0.03).toFixed(2)}">Powered by <tspan font-weight="700">CabanIA.app</tspan></text>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`
    + `${parts.join('')}</svg>`
}

/**
 * The venue logo as a data URL, so it travels inside the SVG file and the print
 * window. Null when it cannot be read (the sign then goes without it).
 */
export async function logoDataUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { credentials: url.startsWith('/') ? 'include' : 'omit' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Open the sign alone in a new window at its real size and show the print dialog. */
export function printSign(svg, size, title) {
  const { width: W, height: H } = SIGN_SIZES[size] || SIGN_SIZES.letter
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page { size: ${W}mm ${H}mm; margin: 0 } html, body { margin: 0; background: #fff }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact }
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
