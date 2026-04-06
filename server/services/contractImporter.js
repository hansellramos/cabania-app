/**
 * Contract template importer — extracts text from PDF/Word and uses AI to parse into sections
 */
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { getAvailablePlaceholders } = require('./contractRenderer');

/**
 * Extract text from a file buffer based on mimetype
 */
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error('Formato no soportado. Solo PDF y Word (.docx)');
}

/**
 * Build the AI prompt for contract parsing
 */
function buildImportPrompt(text) {
  const placeholders = getAvailablePlaceholders();
  const placeholderList = placeholders
    .map(p => `- ${p.label} → {{${p.key}}}`)
    .join('\n');

  return {
    system: `Eres un experto en contratos de hospedaje en Colombia. Tu tarea es analizar contratos existentes y convertirlos en plantillas estructuradas con secciones y placeholders.

Reglas:
- Identifica secciones lógicas del contrato (pagos, depósito, horarios, limpieza, mascotas, etc.)
- Reemplaza datos específicos (nombres, fechas, montos, direcciones) por placeholders
- Mantén el tono y formato original del texto
- Usa markdown para formato: **negrita**, *cursiva*, listas numeradas
- Si hay datos del comisionista/empresa (nombre, teléfono, redes), ponlos en una sección "Información del Intermediario"
- Si hay datos del cliente, ponlos en una sección "Datos del Huésped"
- Responde SOLO con JSON válido, sin texto adicional`,

    user: `Analiza este contrato y conviértelo en secciones estructuradas.

Placeholders disponibles para reemplazar datos variables:
${placeholderList}

Responde con este formato JSON exacto:
{
  "name": "nombre sugerido para la plantilla",
  "sections": [
    {
      "title": "Nombre de la Sección",
      "content": "Contenido en markdown con {{placeholders}}",
      "sort_order": 1
    }
  ]
}

CONTRATO A ANALIZAR:
---
${text}
---`
  };
}

/**
 * Parse AI response to extract JSON
 */
function parseAIResponse(response) {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.name || !Array.isArray(parsed.sections)) {
    throw new Error('Respuesta de IA no tiene el formato esperado');
  }

  // Validate sections
  parsed.sections = parsed.sections.map((s, i) => ({
    title: s.title || `Sección ${i + 1}`,
    content: s.content || '',
    sort_order: s.sort_order ?? i + 1,
  }));

  return parsed;
}

module.exports = {
  extractText,
  buildImportPrompt,
  parseAIResponse,
};
