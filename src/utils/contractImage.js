/**
 * Construye la URL de una imagen de Cloudinary con tratamiento de protección
 * para adjuntos de contrato: escala de grises + marca de agua diagonal repetida
 * ("tiled") con el nombre del venue.
 *
 * La transformación queda "horneada" por Cloudinary en la imagen entregada,
 * así que protege aunque se abra/descargue el enlace directo.
 *
 * Ej: para efectos de este contrato con Casa Baluna
 */

// Cloudinary interpreta ',' y '/' como separadores dentro de l_text, así que
// esos caracteres del texto deben ir doblemente codificados.
function encodeOverlayText(text) {
  return encodeURIComponent(text)
    .replace(/%2C/g, '%252C')
    .replace(/%2F/g, '%252F')
}

export function protectedContractImageUrl(url, venueName) {
  if (!url || !url.includes('/upload/')) return url

  const text = `para efectos de este contrato con ${venueName || ''}`.trim()
  const encoded = encodeOverlayText(text)

  const transform = [
    'e_grayscale',
    `l_text:Arial_34_bold:${encoded},co_rgb:ffffff,o_45,a_45`,
    'fl_tiled,fl_layer_apply',
  ].join('/')

  return url.replace('/upload/', `/upload/${transform}/`)
}

export default protectedContractImageUrl
