// Printed signs (services/venueSigns.js): where each QR leads, the WiFi payload
// and the form checks.
const test = require('node:test');
const assert = require('node:assert');
const { signDestination, wifiPayload, signFields, newCode, deviceOf } = require('../services/venueSigns');

const venue = { name: 'Casa Baluna', slug: 'casa-baluna', is_public: true, whatsapp: '3001234567', instagram: '@casa.baluna' };
const base = 'https://cabania.app';

test('each kind of sign leads to the right place', () => {
  assert.strictEqual(signDestination({ kind: 'public_page', code: 'abc2345' }, venue, base),
    'https://cabania.app/p/casa-baluna?utm_source=qr&utm_medium=aviso&utm_campaign=abc2345');
  assert.match(signDestination({ kind: 'whatsapp', code: 'x' }, venue, base), /^https:\/\/wa\.me\/573001234567\?text=Hola%2C%20vi%20su%20aviso/);
  assert.strictEqual(signDestination({ kind: 'whatsapp', target: 'Precio?' }, venue, base), 'https://wa.me/573001234567?text=Precio%3F');
  assert.strictEqual(signDestination({ kind: 'instagram' }, venue, base), 'https://www.instagram.com/casa.baluna/');
  assert.strictEqual(signDestination({ kind: 'url', target: 'https://youtu.be/x' }, venue, base), 'https://youtu.be/x');
  // Missing data: no destination (the redirect then goes to the home page).
  assert.strictEqual(signDestination({ kind: 'public_page' }, { ...venue, is_public: false }, base), null);
  assert.strictEqual(signDestination({ kind: 'whatsapp' }, { ...venue, whatsapp: null }, base), null);
  assert.strictEqual(signDestination({ kind: 'wifi' }, venue, base), null);
});

test('WiFi payload escapes special characters', () => {
  assert.strictEqual(wifiPayload('Baluna', 'clave123'), 'WIFI:T:WPA;S:Baluna;P:clave123;;');
  assert.strictEqual(wifiPayload('Mi;Red', 'a:b"c'), 'WIFI:T:WPA;S:Mi\\;Red;P:a\\:b\\"c;;');
  assert.strictEqual(wifiPayload('Abierta', ''), 'WIFI:T:nopass;S:Abierta;;');
});

test('sign form checks', () => {
  assert.deepStrictEqual(signFields({ name: ' Pasacalles ', kind: 'public_page', size: 'banner_3x1', headline: '' }),
    { name: 'Pasacalles', kind: 'public_page', size: 'banner_3x1', headline: null });
  assert.throws(() => signFields({ name: '', kind: 'wifi' }), { statusCode: 400 });
  assert.throws(() => signFields({ name: 'X', kind: 'fax' }), { statusCode: 400 });
  assert.throws(() => signFields({ name: 'X', kind: 'url', target: 'youtube.com' }), { statusCode: 400, message: /https/ });
  assert.deepStrictEqual(signFields({ headline: 'Hola' }, { partial: true }), { headline: 'Hola' });
});

test('codes and devices', () => {
  assert.match(newCode(), /^[2-9a-hjkmnp-z]{7}$/);
  assert.strictEqual(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.strictEqual(deviceOf('Mozilla/5.0 (Linux; Android 15; SM-A556E)'), 'android');
  assert.strictEqual(deviceOf('Mozilla/5.0 (Macintosh)'), 'other');
});
