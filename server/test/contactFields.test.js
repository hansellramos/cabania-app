// WhatsApp number and username rules (lib/contactFields.js): each field is
// validated on its own, so one never relaxes the other.
const test = require('node:test');
const assert = require('node:assert');
const { cleanWhatsappUsername, contactWhatsappFields } = require('../lib/contactFields');

test('cleanWhatsappUsername follows WhatsApp rules', () => {
  assert.strictEqual(cleanWhatsappUsername('@SayanaDeLosReyesF26'), 'sayanadelosreyesf26');
  assert.strictEqual(cleanWhatsappUsername('maria.perez_88'), 'maria.perez_88');
  assert.strictEqual(cleanWhatsappUsername('ab'), null, 'too short');
  assert.strictEqual(cleanWhatsappUsername('a'.repeat(36)), null, 'too long');
  assert.strictEqual(cleanWhatsappUsername('123456'), null, 'needs a letter');
  assert.strictEqual(cleanWhatsappUsername('.maria'), null);
  assert.strictEqual(cleanWhatsappUsername('maria.'), null);
  assert.strictEqual(cleanWhatsappUsername('ma..ria'), null);
  assert.strictEqual(cleanWhatsappUsername('maría'), null, 'only English letters');
  assert.strictEqual(cleanWhatsappUsername('maria perez'), null);
});

test('contactWhatsappFields validates each field separately', () => {
  assert.deepStrictEqual(contactWhatsappFields({ whatsapp: '+57 300 123 4567' }), { whatsapp: '573001234567' });
  assert.deepStrictEqual(contactWhatsappFields({ whatsapp_username: '@Maria.P' }), { whatsapp_username: 'maria.p' });
  assert.deepStrictEqual(contactWhatsappFields({ whatsapp: '3001234567', whatsapp_username: 'maria' }), { whatsapp: '3001234567', whatsapp_username: 'maria' });
  // Empty clears; absent fields are left alone.
  assert.deepStrictEqual(contactWhatsappFields({ whatsapp: '', whatsapp_username: '@' }), { whatsapp: null, whatsapp_username: null });
  assert.deepStrictEqual(contactWhatsappFields({ fullname: 'Ana' }), {});
  // A valid username does not excuse a bad number, and vice versa.
  assert.throws(() => contactWhatsappFields({ whatsapp: '@maria', whatsapp_username: 'maria' }), { statusCode: 400, message: /número/ });
  assert.throws(() => contactWhatsappFields({ whatsapp: '3001234567', whatsapp_username: '12' }), { statusCode: 400, message: /usuario/ });
});
