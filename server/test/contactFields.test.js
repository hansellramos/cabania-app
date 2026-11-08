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

const { cleanFacebook, cleanInstagram, contactChannelFields } = require('../lib/contactFields');

test('Instagram and Facebook accept a handle or a profile link', () => {
  assert.strictEqual(cleanInstagram('https://www.instagram.com/casa.baluna/?hl=es'), '@casa.baluna');
  assert.strictEqual(cleanInstagram('casa_baluna'), '@casa_baluna');
  assert.strictEqual(cleanInstagram('12345'), null, 'numeric ids are not handles');
  assert.strictEqual(cleanFacebook('https://www.facebook.com/maria.perez.77?ref=x'), 'maria.perez.77');
  assert.strictEqual(cleanFacebook('https://m.me/mariaperez'), 'mariaperez');
  assert.strictEqual(cleanFacebook('https://facebook.com/profile.php?id=100012345678'), '100012345678');
  assert.strictEqual(cleanFacebook('@ana'), null, 'too short');
  assert.strictEqual(cleanFacebook('maria_perez'), null, 'no underscores on Facebook');
});

test('contactChannelFields checks the preferred channel', () => {
  assert.deepStrictEqual(contactChannelFields({ contact_channel: 'telegram', whatsapp: '3001234567' }), { whatsapp: '3001234567', contact_channel: 'telegram' });
  assert.deepStrictEqual(contactChannelFields({ contact_channel: 'facebook', facebook: 'facebook.com/maria.perez' }), { facebook: 'maria.perez', contact_channel: 'facebook' });
  assert.deepStrictEqual(contactChannelFields({ contact_channel: '' }), { contact_channel: null });
  assert.throws(() => contactChannelFields({ contact_channel: 'fax' }), { statusCode: 400 });
  assert.throws(() => contactChannelFields({ contact_channel: 'instagram', instagram: '' }), { statusCode: 400, message: /medio de contacto/ });
  assert.throws(() => contactChannelFields({ facebook: 'a b' }), { statusCode: 400, message: /Facebook/ });
});

test('identity document: cleaned, CC by default, cleared when empty', () => {
  const { contactDocumentFields, formatDocumentNumber, contactChannelFields } = require('../lib/contactFields');
  assert.deepStrictEqual(contactDocumentFields({ document_number: '1.143.456.789' }), { document_type: 'CC', document_number: '1143456789' });
  assert.deepStrictEqual(contactDocumentFields({ document_type: 'PA', document_number: 'ab 123456' }), { document_type: 'PA', document_number: 'AB123456' });
  assert.deepStrictEqual(contactDocumentFields({ document_type: 'CC', document_number: '' }), { document_type: null, document_number: null });
  assert.deepStrictEqual(contactDocumentFields({ fullname: 'Ana' }), {});
  assert.throws(() => contactDocumentFields({ document_type: 'CC', document_number: 'ABC123' }), /no es válido/);
  assert.throws(() => contactDocumentFields({ document_type: 'XX', document_number: '123456' }), /tipo de documento/);
  assert.strictEqual(formatDocumentNumber('CC', '1143456789'), '1.143.456.789');
  assert.strictEqual(formatDocumentNumber('NIT', '900123456'), '900123456');
  assert.strictEqual(contactChannelFields({ document_number: '12345678' }).document_number, '12345678');
});

test('contracts print the document, never the phone, as the customer id', () => {
  const { buildPlaceholders } = require('../services/contractRenderer');
  const accommodation = { date: new Date('2026-11-15'), adults: 2, children: 0 };
  const withDoc = buildPlaceholders({ accommodation, customer: { fullname: 'Ana', whatsapp: '573113635165', document_type: 'CC', document_number: '1143456789' } });
  assert.strictEqual(withDoc.customer_id, '1.143.456.789');
  assert.strictEqual(withDoc.customer_document_type, 'Cédula de ciudadanía');
  const without = buildPlaceholders({ accommodation, customer: { fullname: 'Ana', whatsapp: '573113635165' } });
  assert.strictEqual(without.customer_id, '—');
});
