/**
 * Renderizador de markdown ligero para el contenido de contratos.
 *
 * Soporta:
 *   - **negrita** y *itálica*
 *   - Listas numeradas: líneas que empiezan con "1." , "2)" , etc.
 *     => <ol> con numeración AUTOMÁTICA (el número que escribas se ignora,
 *        se renumera solo al mostrar y al reordenar).
 *   - Viñetas: líneas que empiezan con "- " o "• " => <ul>.
 *   - Líneas sin marcador dentro de una lista => continúan el ítem anterior.
 *   - Una línea en blanco cierra la lista y separa párrafos.
 *
 * Devuelve HTML seguro (el texto se escapa antes de aplicar formato).
 */

const ORDERED_RE = /^\s*\d+[.)]\s+(.*)$/
const UNORDERED_RE = /^\s*[-•]\s+(.*)$/

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineFormat(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

export function renderMarkdown(content) {
  if (!content) return ''

  const lines = escapeHtml(content).split('\n')
  const blocks = []
  let current = null // { type: 'p' | 'ol' | 'ul', items: [] }

  for (const line of lines) {
    const ordered = line.match(ORDERED_RE)
    const unordered = line.match(UNORDERED_RE)

    if (ordered) {
      if (!current || current.type !== 'ol') {
        current = { type: 'ol', items: [] }
        blocks.push(current)
      }
      current.items.push(ordered[1])
    } else if (unordered) {
      if (!current || current.type !== 'ul') {
        current = { type: 'ul', items: [] }
        blocks.push(current)
      }
      current.items.push(unordered[1])
    } else if (line.trim() === '') {
      // Línea en blanco: cierra la lista/párrafo en curso.
      current = null
    } else if (current && (current.type === 'ol' || current.type === 'ul') && current.items.length) {
      // Continuación del último ítem de la lista.
      current.items[current.items.length - 1] += '<br>' + line
    } else {
      if (!current || current.type !== 'p') {
        current = { type: 'p', items: [] }
        blocks.push(current)
      }
      current.items.push(line)
    }
  }

  return blocks
    .map((block) => {
      if (block.type === 'ol') {
        return `<ol>${block.items.map((i) => `<li>${inlineFormat(i)}</li>`).join('')}</ol>`
      }
      if (block.type === 'ul') {
        return `<ul>${block.items.map((i) => `<li>${inlineFormat(i)}</li>`).join('')}</ul>`
      }
      return block.items.map(inlineFormat).join('<br>')
    })
    .join('<br>')
}

export default renderMarkdown
