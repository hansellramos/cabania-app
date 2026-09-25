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

// ==================== Instagram Business Login (OAuth) ====================

const OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const OAUTH_SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages'];

/**
 * Build the URL where a business grants our app access to its Instagram account.
 * @param {object} p
 * @param {string} p.clientId - Instagram app ID
 * @param {string} p.redirectUri - Must match a redirect URI registered in Meta
 * @param {string} p.state - Opaque anti-CSRF value, echoed back on the callback
 */
function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(','),
    state
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code for a short-lived (1 hour) user token.
 * Instagram has returned both a flat object and a `data: [...]` wrapper, so
 * both shapes are accepted.
 * @returns {Promise<{accessToken: string, userId: string, permissions: string[]}>}
 */
async function exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code
    })
  });
  const body = await res.json();
  const data = Array.isArray(body.data) ? body.data[0] : body;
  if (!res.ok || !data?.access_token) {
    throw new Error(`IG code exchange ${res.status}: ${JSON.stringify(body)}`);
  }
  const permissions = Array.isArray(data.permissions)
    ? data.permissions
    : String(data.permissions || '').split(',').map(p => p.trim()).filter(Boolean);
  return { accessToken: data.access_token, userId: String(data.user_id), permissions };
}

/**
 * Exchange a short-lived token for a long-lived one (valid 60 days).
 * @returns {Promise<{accessToken: string, expiresIn: number}>}
 */
async function exchangeForLongLivedToken(clientSecret, shortLivedToken) {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`IG long-lived exchange ${res.status}: ${JSON.stringify(body)}`);
  }
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || 0 };
}

/**
 * Refresh a long-lived token for another 60 days. Meta only allows it once the
 * token is at least 24 hours old and still valid.
 * @returns {Promise<{accessToken: string, expiresIn: number}>}
 */
async function refreshLongLivedToken(token) {
  const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    const err = new Error(`IG token refresh ${res.status}: ${JSON.stringify(body)}`);
    // 190 = invalid or expired token: it will never refresh, the account must reconnect.
    err.code = body.error?.code;
    throw err;
  }
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || 0 };
}

/**
 * Get the professional account behind a token. `user_id` is the ID Instagram uses
 * as recipient.id in webhooks, which is NOT the app-scoped user_id returned by
 * the code exchange, so this is the one to store in ig_user_id.
 * @returns {Promise<{igUserId: string, username: string}>}
 */
async function getAccount(token) {
  const body = await graphRequest(`${GRAPH_API}/me?fields=user_id,username`, token);
  return { igUserId: String(body.user_id), username: body.username || null };
}

module.exports = {
  sendText,
  sendImage,
  subscribeApp,
  getSubscribedApps,
  OAUTH_SCOPES,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getAccount
};
