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
    { name: 'Pasacalles', kind: 'public_page', size: 'banner_3x1', style: 'gradient', headline: null });
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

const { displayPhone, instagramHandle, parseSignCopy, signCopyPrompt } = require('../services/venueSigns');

test('free text and style are checked', () => {
  const f = signFields({ name: 'Mesa', kind: 'whatsapp', body: '  Domicilios 300 123 4567 \r\n\n\n\nTodos los días ', style: 'light' });
  assert.equal(f.body, 'Domicilios 300 123 4567\n\nTodos los días');
  assert.equal(f.style, 'light');
  assert.equal(signFields({ name: 'x', kind: 'url', target: 'https://a.co' }).style, 'gradient');
  assert.throws(() => signFields({ name: 'x', kind: 'wifi', style: 'neon' }), /estilo/);
  assert.throws(() => signFields({ name: 'x', kind: 'wifi', body: 'a'.repeat(301) }), /300/);
});

test('phone and instagram as printed', () => {
  assert.equal(displayPhone('573001234567'), '300 123 4567');
  assert.equal(displayPhone('3001234567'), '300 123 4567');
  assert.equal(displayPhone(null), null);
  assert.equal(instagramHandle('https://instagram.com/el.mirador/?hl=es'), 'el.mirador');
  assert.equal(instagramHandle('@cabana_x'), 'cabana_x');
});

test('AI copy is parsed and trimmed', () => {
  assert.deepEqual(parseSignCopy('Claro:\n{"headline": " Pide tu domicilio ", "body": "Llama al 300 123 4567\\nTodos los días"}'),
    { headline: 'Pide tu domicilio', body: 'Llama al 300 123 4567\nTodos los días' });
  assert.throws(() => parseSignCopy('no sé'), /IA/);
  const { system, user } = signCopyPrompt({ venue: { name: 'El Mirador', city: 'Guatapé' }, kind: 'whatsapp', size: 'banner_3x1', idea: 'domicilios 300' });
  assert.match(system, /El Mirador \(Guatapé\)/);
  assert.match(system, /pasacalles/);
  assert.match(user, /domicilios 300/);
});

test('signLinks checks the extra QRs', () => {
  const { signLinks, signFields } = require('../services/venueSigns');
  assert.deepStrictEqual(signLinks([{ kind: 'whatsapp' }, { kind: 'instagram', target: '' }]), [
    { id: null, kind: 'whatsapp', target: null },
    { id: null, kind: 'instagram', target: null },
  ]);
  assert.deepStrictEqual(signLinks(null), []);
  assert.throws(() => signLinks([{ kind: 'wifi' }]), /no es válido/);
  assert.throws(() => signLinks([{ kind: 'whatsapp' }, { kind: 'whatsapp' }]), /No repitas/);
  assert.throws(() => signLinks([{ kind: 'url', target: 'hola' }]), /https/);
  assert.throws(() => signLinks([{ kind: 'whatsapp' }, { kind: 'instagram' }, { kind: 'public_page' }]), /hasta 2/);
  assert.deepStrictEqual(signFields({ links: [{ kind: 'public_page' }] }, { partial: true }), { links: [{ id: null, kind: 'public_page', target: null }] });
  assert.deepStrictEqual(signFields({ name: 'x' }, { partial: true }).links, undefined);
});

test('directory signs: rows with their own phone, call QRs, no banner', () => {
  const { signLinks, signFields, signDestination } = require('../services/venueSigns');
  const rows = signLinks([
    { kind: 'whatsapp', title: ' Domicilios tienda ', subtitle: 'Todos los días', phone: '300 111 2233' },
    { kind: 'whatsapp', title: 'Almuerzos', phone: '' },
    { kind: 'call', title: 'Comidas rápidas', phone: '+57 301 444 5566' },
  ], 'directory');
  assert.deepStrictEqual(rows[0], { id: null, kind: 'whatsapp', target: null, title: 'Domicilios tienda', subtitle: 'Todos los días', phone: '3001112233' });
  assert.strictEqual(rows[1].phone, null);
  assert.throws(() => signLinks([{ kind: 'whatsapp', title: '' }], 'directory'), /título a la fila 1/);
  assert.throws(() => signLinks([{ kind: 'call', title: 'x' }], 'whatsapp'), /no es válido/);
  assert.throws(() => signLinks([{ kind: 'whatsapp', title: 'x', phone: '12' }], 'directory'), /teléfono/);
  assert.throws(() => signLinks(Array(7).fill({ kind: 'whatsapp', title: 'x' }), 'directory'), /hasta 6 filas/);
  assert.throws(() => signFields({ name: 'D', kind: 'directory', size: 'banner_3x1', links: rows }), /vertical/);
  assert.throws(() => signFields({ name: 'D', kind: 'directory', size: 'letter', links: [] }), /al menos una fila/);
  assert.strictEqual(signDestination({ kind: 'call', phone: '3014445566' }, venue, base), 'tel:+573014445566');
  assert.strictEqual(signDestination({ kind: 'whatsapp', phone: '3001112233' }, venue, base),
    'https://wa.me/573001112233?text=' + encodeURIComponent('Hola, te escribo desde Casa Baluna.'));
  assert.strictEqual(signDestination({ kind: 'directory', code: 'x' }, venue, base), null);
});
