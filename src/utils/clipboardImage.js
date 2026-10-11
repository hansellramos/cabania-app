// Put an image on the clipboard so it can be pasted in WhatsApp, Instagram, etc.

/** The image as PNG, the only image type browsers can put on the clipboard. */
async function pngBlob(src) {
  const blob = await (await fetch(src)).blob()
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}

/** Copy the image at src (URL or data URL). Returns false if the browser refuses. */
export async function copyImage(src) {
  try {
    // The promise goes straight into the ClipboardItem so Safari keeps the click gesture.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(src) })])
    return true
  } catch {
    return false
  }
}
