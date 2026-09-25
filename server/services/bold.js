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
  // Links/button events and payments API events are signed with the secret key of
  // their own integration, so both are accepted.
  const keys = [process.env.BOLD_SECRET_KEY || '', process.env.BOLD_API_SECRET_KEY || ''];
  if (process.env.BOLD_TEST_MODE === 'true') keys.push('');
  const base64Body = Buffer.from(rawBody).toString('base64');
  const received = Buffer.from(String(signature));
  return keys.some(key => {
    if (!key && process.env.BOLD_TEST_MODE !== 'true') return false;
    const expected = Buffer.from(crypto.createHmac('sha256', key).update(base64Body).digest('hex'));
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
}

// ==================== API de Pagos en Linea (QR Bre-B directo) ====================

const PAYMENTS_API = 'https://api.online.payments.bold.co';

/**
 * QR payments need their own keys (distinct from the payment button / links keys)
 * and an explicit switch: Bold only lets a merchant create them in production once
 * the product is certified. Until then BOLD_QR_ENABLED stays off and guests get the
 * payment link, whose checkout offers QR Bre-B anyway.
 */
function isQrConfigured() {
  return process.env.BOLD_QR_ENABLED === 'true' && !!process.env.BOLD_API_IDENTITY_KEY;
}

// Bold requires a device fingerprint. The QR is created server-side from a chat,
// with no payer device involved, so a fixed server fingerprint is sent.
const SERVER_FINGERPRINT = {
  ip: '127.0.0.1',
  device_type: 'DESKTOP',
  os: 'Linux',
  browser: 'Node.js',
  java_enabled: false,
  language: 'es-CO',
  color_depth: 24,
  screen_height: 1080,
  screen_width: 1920,
  time_zone_offset: 300
};

async function paymentsRequest(method, path, body) {
  const res = await fetch(`${PAYMENTS_API}${path}`, {
    method,
    headers: {
      Authorization: `x-api-key ${process.env.BOLD_API_IDENTITY_KEY || ''}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Bold payments API ${res.status}: ${text.slice(0, 300)}`);
  }
  return json.payload || json;
}

/**
 * Create a payment intent and a QR Bre-B payment for it. The QR is valid for 10
 * minutes and can be paid from any bank app.
 * @param {object} p
 * @param {string} p.referenceId - Unique per QR (Bold rejects reused references)
 * @param {number} p.amount - COP
 * @param {string} p.description
 * @param {object} p.payer - { name, email, phone }: Bold requires all three
 * @returns {Promise<{transactionId: string, qrBase64: string, expiresAt: Date, test: boolean}>}
 */
async function createQrPayment({ referenceId, amount, description, payer }) {
  const intent = await paymentsRequest('POST', '/v1/payment-intent', {
    reference_id: referenceId,
    amount: { currency: 'COP', total_amount: Math.round(amount), tip_amount: 0, taxes: [] },
    description: String(description || 'Reserva').slice(0, 100),
    device_fingerprint: SERVER_FINGERPRINT
  });
  const payment = await paymentsRequest('POST', '/v1/payment', {
    reference_id: referenceId,
    payer: { person_type: 'NATURAL_PERSON', ...payer },
    payment_method: { name: 'QR', qr_format: 'BOLD_BASE64' },
    device_fingerprint: SERVER_FINGERPRINT
  });
  const next = payment.next_actions || {};
  if (!next.qr_payload) {
    throw new Error(`Bold QR without payload: ${JSON.stringify(payment).slice(0, 300)}`);
  }
  // expires_at comes in nanoseconds since the epoch.
  const expiresAt = next.expires_at
    ? new Date(Number(BigInt(next.expires_at) / 1000000n))
    : new Date(Date.now() + 10 * 60 * 1000);
  return {
    transactionId: payment.transaction_id || null,
    qrBase64: next.qr_payload,
    expiresAt,
    test: intent.test === true
  };
}

/**
 * State of a QR payment by its reference: approved, rejected, running...
 * @returns {Promise<{status: string|null, transactionId: string|null, paymentMethod: string|null}>}
 */
async function getQrPayment(referenceId) {
  const data = await paymentsRequest('GET', `/v1/payment/${encodeURIComponent(referenceId)}`);
  return {
    status: data.status ? String(data.status).toLowerCase() : null,
    transactionId: data.transaction_id || null,
    paymentMethod: data.payment_method || 'QR'
  };
}

module.exports = {
  isConfigured,
  isQrConfigured,
  createQrPayment,
  getQrPayment,
  getPaymentMethods,
  createPaymentLink,
  getPaymentLink,
  validateWebhookSignature
};
