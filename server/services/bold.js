/**
 * Bold payment links (checkout.bold.co) — Link de pagos API.
 *
 * The payer opens the link and pays with any method enabled on the Bold account
 * (QR Bre-B, Nequi, PSE, Botón Bancolombia, card). Bold notifies the result via
 * webhook, and the link status can be queried as the source of truth.
 */
const crypto = require('crypto');

const LINK_API = 'https://integrations.api.bold.co/online/link/v1';

function identityKey() {
  return process.env.BOLD_IDENTITY_KEY || '';
}

function isConfigured() {
  return !!(process.env.BOLD_IDENTITY_KEY && process.env.BOLD_SECRET_KEY);
}

async function boldRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `x-api-key ${identityKey()}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Bold API ${res.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

let methodsCache = null;

/**
 * Payment methods enabled on the Bold account (e.g. QR_BOLD, NEQUI, PSE...).
 * Cached for an hour.
 */
async function getPaymentMethods() {
  if (methodsCache && Date.now() - methodsCache.at < 60 * 60 * 1000) return methodsCache.methods;
  const body = await boldRequest(`${LINK_API}/payment_methods`);
  const methods = Object.keys(body.payload?.payment_methods || {});
  methodsCache = { at: Date.now(), methods };
  return methods;
}

/**
 * Create a closed-amount payment link.
 * @param {object} p
 * @param {number} p.amount - Total in COP (integer, Bold minimum is 1000)
 * @param {string} p.description
 * @param {Date} p.expiresAt
 * @param {string} [p.callbackUrl] - Where Bold sends the payer after paying
 * @param {string} [p.payerEmail]
 * @returns {Promise<{linkId: string, url: string}>}
 */
async function createPaymentLink({ amount, description, expiresAt, callbackUrl, payerEmail }) {
  let paymentMethods;
  try {
    paymentMethods = await getPaymentMethods();
  } catch (err) {
    // Not fatal: without the list Bold offers every method enabled on the account.
    console.warn('[bold] Could not load payment methods:', err.message);
  }

  const payload = {
    amount_type: 'CLOSE',
    amount: { currency: 'COP', total_amount: Math.round(amount) },
    description: String(description || 'Reserva').slice(0, 100),
    // Bold expects the expiration as nanoseconds since the Unix epoch.
    expiration_date: String(BigInt(expiresAt.getTime()) * 1000000n)
  };
  if (paymentMethods?.length) payload.payment_methods = paymentMethods;
  if (callbackUrl) payload.callback_url = callbackUrl;
  if (payerEmail) payload.payer_email = payerEmail;

  const body = await boldRequest(LINK_API, { method: 'POST', body: JSON.stringify(payload) });
  const data = body.payload || body;
  if (!data.payment_link || !data.url) {
    throw new Error(`Bold link without id/url: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { linkId: data.payment_link, url: data.url };
}

/**
 * Current state of a payment link. Used to confirm what a webhook says instead
 * of trusting its body.
 * @returns {Promise<{status: string, transactionId: string|null, paymentMethod: string|null, raw: object}>}
 */
async function getPaymentLink(linkId) {
  const body = await boldRequest(`${LINK_API}/${encodeURIComponent(linkId)}`);
  const data = body.payload || body;
  return {
    status: data.status || null,
    transactionId: data.transaction_id || null,
    paymentMethod: data.payment_method || null,
    raw: data
  };
}

/**
 * Validate the x-bold-signature header: hex HMAC-SHA256 of the base64-encoded raw
 * body. Bold signs test-mode events with an empty key, which anyone can reproduce,
 * so that key is only accepted when BOLD_TEST_MODE=true.
 */
function validateWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;
  const keys = [process.env.BOLD_SECRET_KEY || ''];
  if (process.env.BOLD_TEST_MODE === 'true') keys.push('');
  const base64Body = Buffer.from(rawBody).toString('base64');
  const received = Buffer.from(String(signature));
  return keys.some(key => {
    if (!key && process.env.BOLD_TEST_MODE !== 'true') return false;
    const expected = Buffer.from(crypto.createHmac('sha256', key).update(base64Body).digest('hex'));
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
}

module.exports = {
  isConfigured,
  getPaymentMethods,
  createPaymentLink,
  getPaymentLink,
  validateWebhookSignature
};
