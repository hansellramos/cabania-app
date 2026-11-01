/**
 * Encrypts secrets stored in the database (AES-256-GCM).
 *
 * The key is SECRETS_ENCRYPTION_KEY: 32 bytes in base64 (or 64 hex chars).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Stored format: v1:<iv>:<tag>:<ciphertext>, each part base64. `context` (for
 * example the organization id) is bound as additional data, so a ciphertext
 * copied to another row does not decrypt.
 */
const crypto = require('crypto');

function loadKey() {
  const raw = (process.env.SECRETS_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SECRETS_ENCRYPTION_KEY debe tener 32 bytes (base64 o hex)');
  return key;
}

function isConfigured() {
  try { return !!loadKey(); } catch { return false; }
}

function requireKey() {
  const key = loadKey();
  if (!key) throw new Error('Falta SECRETS_ENCRYPTION_KEY en el servidor');
  return key;
}

function encrypt(plaintext, context = '') {
  const key = requireKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(String(context)));
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

function decrypt(stored, context = '') {
  const key = requireKey();
  const [version, iv, tag, data] = String(stored || '').split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Secreto cifrado con formato desconocido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(String(context)));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, isConfigured };
