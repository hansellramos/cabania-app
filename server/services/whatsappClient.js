/**
 * WhatsApp Service HTTP Client
 *
 * Proxies WhatsApp operations to the external Baileys microservice via HTTP.
 * Drop-in replacement for the direct Baileys service imports.
 */

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

async function callService(method, path, body = null) {
  if (!WHATSAPP_SERVICE_URL) return null;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': WHATSAPP_API_KEY
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${WHATSAPP_SERVICE_URL}${path}`, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp service error: ${res.status} ${errText}`);
  }
  return res.json();
}

module.exports = {
  // Availability
  isAvailable: () => !!WHATSAPP_SERVICE_URL,

  // Venue connections
  connectVenue: (venueId) => callService('POST', `/api/venues/${venueId}/connect`),
  disconnectVenue: (venueId) => callService('POST', `/api/venues/${venueId}/disconnect`),
  getStatus: (venueId) => callService('GET', `/api/venues/${venueId}/status`),
  sendMessage: (venueId, phone, text) => callService('POST', '/api/send/venue', { venueId, phone, text }),
  sendImage: (venueId, phone, imageUrl, caption) => callService('POST', '/api/send/venue/image', { venueId, phone, imageUrl, caption }),

  // System connection
  connectSystem: () => callService('POST', '/api/system/connect'),
  disconnectSystem: () => callService('POST', '/api/system/disconnect'),
  getSystemStatus: () => callService('GET', '/api/system/status'),
  sendSystemMessage: (phone, text) => callService('POST', '/api/send/system', { phone, text }),
};
