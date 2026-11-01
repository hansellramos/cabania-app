// Shared setup of the AirBudget tests that need a database. They only run
// against a local throwaway database:
//   AIRBUDGET_TEST_DATABASE_URL=postgresql://user:pass@localhost:5435/cab_test node --test test/
// The schema must be pushed first (npx prisma db push --schema prisma/schema.prisma).
const crypto = require('crypto');

const url = process.env.AIRBUDGET_TEST_DATABASE_URL || '';
const skip = !url
  ? 'set AIRBUDGET_TEST_DATABASE_URL to a local test database'
  : (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) ? 'AIRBUDGET_TEST_DATABASE_URL must point to localhost' : false);

if (!skip) {
  process.env.DATABASE_URL = url;
  process.env.SECRETS_ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64');
}

const TEST_SECRET = 'whsec_Y2FiYW5pYS10ZXN0LXNlY3JldC0wMTIzNDU2Nzg5YWI=';
const GUEST = { fullname: 'Lucía Fernández', email: 'lucia.fernandez@example.com', whatsapp: 573001112233 };

/** A fresh organization with a venue, a plan, a guest and a booking. */
async function createFixture(prisma, label = 'AirBudget') {
  const tag = `${label} ${crypto.randomBytes(3).toString('hex')}`;
  const org = await prisma.organizations.create({ data: { name: `Org ${tag}` } });
  const venue = await prisma.venues.create({ data: { name: `Cabaña ${tag}`, organization: org.id } });
  const plan = await prisma.venue_plans.create({
    data: { venue_id: venue.id, name: 'Pasadía', plan_type: 'pasadia', adult_price: 50000, child_price: 30000 }
  });
  const guest = await prisma.contacts.create({ data: GUEST });
  const booking = await prisma.accommodations.create({
    data: { venue: venue.id, plan_id: plan.id, customer: guest.id, date: new Date('2026-11-14T00:00:00Z'), adults: 10, agreed_price: 500000 }
  });
  return { org, venue, plan, guest, booking, tag };
}

async function enableIntegration(prisma, orgId, webhookUrl = 'https://airbudget.test/hooks/cabania') {
  const secretBox = require('../../lib/secretBox');
  return prisma.airbudget_integrations.upsert({
    where: { organization_id: orgId },
    update: { webhook_url: webhookUrl, secret_encrypted: secretBox.encrypt(TEST_SECRET, orgId), enabled: true, disabled_reason: null },
    create: { organization_id: orgId, webhook_url: webhookUrl, secret_encrypted: secretBox.encrypt(TEST_SECRET, orgId), enabled: true }
  });
}

/** Removes everything createFixture() and the tests wrote. */
async function dropFixture(prisma, { org, venue, guest }) {
  const bookings = await prisma.accommodations.findMany({ where: { venue: venue.id }, select: { id: true } });
  const bookingIds = bookings.map(b => b.id);
  const payments = await prisma.payments.findMany({ where: { accommodation: { in: bookingIds } }, select: { id: true } });
  await prisma.airbudget_deliveries.deleteMany({ where: { organization_id: org.id } });
  await prisma.airbudget_integrations.deleteMany({ where: { organization_id: org.id } });
  await prisma.incomes.deleteMany({ where: { OR: [{ venue_id: venue.id }, { payment_id: { in: payments.map(p => p.id) } }] } });
  await prisma.commission_payments.deleteMany({ where: { accommodation_id: { in: bookingIds } } });
  await prisma.expenses.deleteMany({ where: { OR: [{ venue_id: venue.id }, { organization_id: org.id }] } });
  await prisma.recurring_expenses.deleteMany({ where: { venue_id: venue.id } });
  await prisma.deposits.deleteMany({ where: { accommodation_id: { in: bookingIds } } });
  await prisma.bold_payment_events.deleteMany({ where: { link_id: { in: (await prisma.bold_payment_links.findMany({ where: { venue_id: venue.id }, select: { id: true } })).map(l => l.id) } } });
  await prisma.bold_payment_links.deleteMany({ where: { venue_id: venue.id } });
  await prisma.payments.deleteMany({ where: { accommodation: { in: bookingIds } } });
  await prisma.accommodations.deleteMany({ where: { venue: venue.id } });
  await prisma.venue_plans.deleteMany({ where: { venue_id: venue.id } });
  await prisma.venues.delete({ where: { id: venue.id } });
  await prisma.contacts.delete({ where: { id: guest.id } }).catch(() => {});
  await prisma.organizations.delete({ where: { id: org.id } });
}

/** Personal data of the guest that must never reach AirBudget. */
function assertNoGuestData(assert, payload) {
  const text = JSON.stringify(payload).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const word of ['lucia', 'fernandez', 'lucia.fernandez@example.com', '3001112233']) {
    assert.ok(!text.includes(word), `payload contains "${word}": ${JSON.stringify(payload)}`);
  }
}

module.exports = { skip, TEST_SECRET, GUEST, createFixture, enableIntegration, dropFixture, assertNoGuestData };
