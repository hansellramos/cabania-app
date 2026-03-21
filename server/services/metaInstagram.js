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

module.exports = { sendText, sendImage };
