/**
 * Meta Instagram Messaging API Service
 *
 * Sends messages via the Instagram Graph API v22.0.
 */

const GRAPH_API = 'https://graph.instagram.com/v22.0';

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
    throw new Error(`IG Graph API ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Send a text message to an Instagram user.
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} token - Page access token
 * @param {string} recipientId - Instagram Scoped ID (IGSID) of recipient
 * @param {string} text - Message text
 */
async function sendText(igUserId, token, recipientId, text) {
  return graphRequest(`${GRAPH_API}/${igUserId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });
}

/**
 * Send an image message to an Instagram user.
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} token - Page access token
 * @param {string} recipientId - IGSID of recipient
 * @param {string} imageUrl - Public URL of the image
 */
async function sendImage(igUserId, token, recipientId, imageUrl) {
  return graphRequest(`${GRAPH_API}/${igUserId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl }
        }
      }
    })
  });
}

/**
 * Subscribe this app to the account's webhook messaging events.
 * Without this call Instagram does NOT forward DMs to the webhook, even if
 * the webhook is verified in Meta and the `messages` field is subscribed at
 * the app level.
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} token - Account access token
 * @param {string} [fields='messages'] - Comma-separated fields to subscribe
 */
async function subscribeApp(igUserId, token, fields = 'messages') {
  const res = await fetch(`${GRAPH_API}/${igUserId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: fields, access_token: token })
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(`IG subscribed_apps ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * List the apps subscribed to the account's webhooks. Useful to verify that
 * subscribeApp() took effect.
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} token - Account access token
 */
async function getSubscribedApps(igUserId, token) {
  const res = await fetch(
    `${GRAPH_API}/${igUserId}/subscribed_apps?access_token=${encodeURIComponent(token)}`
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`IG subscribed_apps GET ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data || [];
}

module.exports = { sendText, sendImage, subscribeApp, getSubscribedApps };
