/**
 * Meta WhatsApp Cloud API Service
 *
 * Sends messages, downloads media, and marks messages as read
 * via the official Graph API v22.0.
 */

const GRAPH_API = 'https://graph.facebook.com/v22.0';

async function graphRequest(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body}`);
  }
  return options.raw ? res : res.json();
}

/**
 * Send a text message.
 * @returns {{ messaging_product, contacts, messages }} — messages[0].id is the wamid
 */
async function sendText(phoneNumberId, token, to, text) {
  return graphRequest(`${GRAPH_API}/${phoneNumberId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
}

/**
 * Send an image message with optional caption.
 */
async function sendImage(phoneNumberId, token, to, imageUrl, caption) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl }
  };
  if (caption) payload.image.caption = caption;

  return graphRequest(`${GRAPH_API}/${phoneNumberId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/**
 * Send a template message (e.g. hello_world for testing).
 */
async function sendTemplate(phoneNumberId, token, to, templateName, lang = 'en_US') {
  return graphRequest(`${GRAPH_API}/${phoneNumberId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: lang }
      }
    })
  });
}

/**
 * Download media by its ID. Returns a Buffer.
 */
async function downloadMedia(mediaId, token) {
  // Step 1: get the media URL
  const meta = await graphRequest(`${GRAPH_API}/${mediaId}`, token);
  // Step 2: download the actual binary
  const res = await graphRequest(meta.url, token, { raw: true });
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Mark a message as read.
 */
async function markAsRead(phoneNumberId, token, messageId) {
  return graphRequest(`${GRAPH_API}/${phoneNumberId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    })
  });
}

/**
 * Subscribe this app to the WABA's webhook messaging events.
 * Without this call Meta does NOT forward messages to the webhook, even if
 * the webhook is verified and the `messages` field is subscribed at the app
 * level. Unlike Instagram (subscribed at the IG user level), WhatsApp Cloud
 * API subscribes at the WhatsApp Business Account (WABA) level.
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} token - Account/system access token
 * @param {string} [fields='messages'] - Comma-separated fields to subscribe
 */
async function subscribeApp(wabaId, token, fields = 'messages') {
  const res = await fetch(`${GRAPH_API}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: fields, access_token: token })
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(`WABA subscribed_apps ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * List the apps subscribed to the WABA's webhooks. Useful to verify that
 * subscribeApp() took effect.
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} token - Account/system access token
 */
async function getSubscribedApps(wabaId, token) {
  const res = await fetch(
    `${GRAPH_API}/${wabaId}/subscribed_apps?access_token=${encodeURIComponent(token)}`
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`WABA subscribed_apps GET ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data || [];
}

module.exports = {
  sendText,
  sendImage,
  sendTemplate,
  downloadMedia,
  markAsRead,
  subscribeApp,
  getSubscribedApps
};
