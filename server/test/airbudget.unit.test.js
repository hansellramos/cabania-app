// Unit tests of the AirBudget webhook pieces that need no database.
//   cd server && node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  signWebhook, secretError, urlError, classify, nextAttemptAt, scrub, RETRY_DELAYS_MINUTES
} = require('../services/airbudgetSync');

test('signature matches the contract example', () => {
  const body = '{"type":"movement.upserted","timestamp":"2026-10-23T00:00:00Z","data":{"external_id":"expense:3b9e2c1a-0000-4000-8000-000000000002","kind":"expense","amount":150000,"currency":"COP","date":"2026-10-20","concept":"Mantenimiento piscina","updated_at":"2026-10-22T18:30:00Z"}}';
  const signature = signWebhook(
    'whsec_Y2FiYW5pYS10ZXN0LXNlY3JldC0wMTIzNDU2Nzg5YWI=',
    'msg_2f1c7a3e-0000-4000-8000-000000000001',
    1792800000,
    body
  );
  assert.equal(signature, 'v1,pwDrk+lgg2WjpZJrhIkL1ySGhpRSHoWLoBc/3CtYfdI=');
});

test('secret format', () => {
  assert.equal(secretError('whsec_Y2FiYW5pYS10ZXN0LXNlY3JldC0wMTIzNDU2Nzg5YWI='), null);
  assert.match(secretError('Y2FiYW5pYS10ZXN0'), /formato/);
  assert.match(secretError('whsec_abc'), /corto/);
  assert.match(secretError('whsec_no es base64!'), /formato/);
});

test('webhook URL must be https (http only for localhost outside production)', () => {
  assert.equal(urlError('https://airbudget.example.com/hooks/cabania'), null);
  assert.match(urlError('http://airbudget.example.com/hooks'), /https/);
  assert.equal(urlError('http://localhost:4000/hook', { allowHttpLocalhost: true }), null);
  assert.match(urlError('http://localhost:4000/hook', { allowHttpLocalhost: false }), /https/);
  assert.match(urlError('not a url'), /válida/);
});

test('which answers are retried', () => {
  for (const code of [200, 201, 204]) assert.equal(classify(code), 'delivered');
  for (const code of [null, 408, 429, 500, 502, 503]) assert.equal(classify(code), 'retry');
  for (const code of [400, 401, 404, 403, 422, 301]) assert.equal(classify(code), 'failed');
  assert.equal(classify(410), 'gone');
});

test('backoff: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, then give up', () => {
  const t0 = new Date('2026-10-23T12:00:00Z');
  const minutes = [];
  for (let attempts = 1; ; attempts++) {
    const next = nextAttemptAt(attempts, t0);
    if (!next) break;
    minutes.push((next - t0) / 60000);
  }
  assert.deepEqual(minutes, [1, 5, 30, 120, 360, 720]);
  assert.deepEqual(RETRY_DELAYS_MINUTES, minutes);
});

test('scrub removes emails, phones and the given names, keeps amounts and dates', () => {
  const names = ['María José Gómez'];
  assert.equal(scrub('Devolución · María José Gómez · 2026-10-20', names), 'Devolución · 2026-10-20');
  assert.equal(scrub('Devolución a maria jose gomez', names), 'Devolución a');
  assert.equal(scrub('Arreglo nevera, llamar al +57 300 123 4567', []), 'Arreglo nevera, llamar al');
  assert.equal(scrub('Factura enviada a ana@correo.com', []), 'Factura enviada a');
  assert.equal(scrub('Mantenimiento piscina 1.500.000', []), 'Mantenimiento piscina 1.500.000');
  assert.equal(scrub('Wi-Fi mensual', []), 'Wi-Fi mensual');
  assert.equal(scrub('Nequi 3001234567', []), 'Nequi');
});

test('secretBox encrypts with AES-256-GCM bound to the organization', () => {
  const previous = process.env.SECRETS_ENCRYPTION_KEY;
  process.env.SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  try {
    const secretBox = require('../lib/secretBox');
    const stored = secretBox.encrypt('whsec_abc', 'org-1');
    assert.ok(!stored.includes('whsec_abc'));
    assert.equal(secretBox.decrypt(stored, 'org-1'), 'whsec_abc');
    assert.throws(() => secretBox.decrypt(stored, 'org-2'));
  } finally {
    if (previous === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
    else process.env.SECRETS_ENCRYPTION_KEY = previous;
  }
});
