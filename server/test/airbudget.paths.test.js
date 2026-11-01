// End to end: starts the server against a local database and a local AirBudget
// receiver that verifies the signature, then goes through every path that
// creates, edits or deletes an income or an expense (REST, agent tools/MCP,
// Bold, commissions, cancellations, recurring) and checks what gets queued and
// delivered. Uses its own temporary admin user, organization and venue.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { skip, TEST_SECRET, createFixture, dropFixture, assertNoGuestData } = require('./helpers/airbudgetDb');

/** AirBudget's side of the contract, written independently of the service. */
function startReceiver() {
  const key = Buffer.from(TEST_SECRET.slice('whsec_'.length), 'base64');
  const received = [];
  const seen = new Set();
  const state = { answer: 200 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const id = req.headers['webhook-id'];
      const ts = req.headers['webhook-timestamp'];
      const expected = 'v1,' + crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
      const signatures = String(req.headers['webhook-signature'] || '').split(' ');
      if (!signatures.includes(expected)) { res.writeHead(401); return res.end('firma inválida'); }
      if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) { res.writeHead(401); return res.end('timestamp viejo'); }
      if (state.answer !== 200) { res.writeHead(state.answer); return res.end('rechazado'); }
      if (!seen.has(id)) {
        seen.add(id);
        received.push({ id, userAgent: req.headers['user-agent'], contentType: req.headers['content-type'], event: JSON.parse(body) });
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, received, state, url: `http://127.0.0.1:${server.address().port}/hooks/cabania` })));
}

const freePort = () => new Promise((resolve) => {
  const s = http.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

test('AirBudget: every path that touches incomes and expenses', { skip, timeout: 180000 }, async (t) => {
  const { prisma } = require('../db');
  const bcrypt = require('bcryptjs');
  const fx = await createFixture(prisma, 'Paths');
  const receiver = await startReceiver();

  // A temporary organization admin with an active membership.
  const profile = await prisma.profiles.findFirst({ where: { code: 'organization:admin' } });
  const password = crypto.randomBytes(12).toString('base64url');
  const user = await prisma.users.create({
    data: {
      id: `test-airbudget-${crypto.randomBytes(4).toString('hex')}`,
      email: `airbudget-${crypto.randomBytes(4).toString('hex')}@test.local`,
      display_name: 'Prueba AirBudget',
      profile_id: profile.id,
      password_hash: await bcrypt.hash(password, 4)
    }
  });
  await prisma.user_organizations.create({ data: { user_id: user.id, organization_id: fx.org.id } });
  const subscription = await prisma.subscriptions.create({ data: { name: 'Prueba AirBudget', paid_until: new Date('2099-01-01T00:00:00Z') } });
  await prisma.subscription_users.create({ data: { subscription_id: subscription.id, user_id: user.id, is_owner: true } });
  const provider = await prisma.providers.create({ data: { name: 'Vendedor de prueba', organization_id: fx.org.id } });
  const agent = await prisma.commission_agents.create({ data: { name: 'Vendedor de prueba', organization_id: fx.org.id, provider_id: provider.id } });
  const plan2 = await prisma.venue_plans.create({ data: { venue_id: fx.venue.id, name: 'Pasanoche', plan_type: 'pasanoche', adult_price: 80000, child_price: 40000 } });
  const category = await prisma.expense_categories.findFirst({ where: { is_active: true, name: { notIn: ['Devoluciones', 'Comisiones de pago'] } } });

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const blank = Object.fromEntries([
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GROK_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY', 'WHATSAPP_SERVICE_URL', 'WHATSAPP_API_KEY', 'WHATSAPP_INTERNAL_KEY',
    'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'META_APP_SECRET', 'META_IG_APP_SECRET', 'META_IG_APP_ID',
    'BOLD_IDENTITY_KEY', 'BOLD_SECRET_KEY', 'BOLD_API_IDENTITY_KEY', 'BOLD_API_SECRET_KEY', 'BOLD_API_IDENTITY_KEY_PROD',
    'BOLD_API_SECRET_KEY_PROD', 'BOLD_IDENTITY_KEY_PROD', 'BOLD_SECRET_KEY_PROD', 'BOLD_QR_ENABLED', 'POSTHOG_KEY'
  ].map(k => [k, '']));
  const logs = [];
  const server = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env, ...blank,
      PORT: String(port),
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
      SESSION_SECRET: crypto.randomBytes(16).toString('hex'),
      EMAIL_PROVIDER: 'log'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (d) => logs.push(String(d)));
  server.stderr.on('data', (d) => logs.push(String(d)));

  t.after(async () => {
    server.kill('SIGKILL');
    receiver.server.close();
    await prisma.api_keys.deleteMany({ where: { user_id: user.id } });
    await prisma.commission_payments.deleteMany({ where: { agent_id: agent.id } });
    await prisma.commission_agents.delete({ where: { id: agent.id } });
    await dropFixture(prisma, fx);
    await prisma.providers.delete({ where: { id: provider.id } });
    await prisma.subscription_users.deleteMany({ where: { user_id: user.id } });
    await prisma.subscriptions.delete({ where: { id: subscription.id } });
    await prisma.user_organizations.deleteMany({ where: { user_id: user.id } });
    await prisma.notifications.deleteMany({ where: { user_id: user.id } }).catch(() => {});
    await prisma.users.delete({ where: { id: user.id } });
    await prisma.$disconnect();
    // The secret never shows up in the server output.
    assert.ok(!logs.join('').includes(TEST_SECRET.slice(6)), 'the secret was logged');
  });

  // Server up?
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* starting */ }
    if (i > 120) throw new Error(`server did not start:\n${logs.join('').slice(-3000)}`);
    await new Promise(r => setTimeout(r, 250));
  }

  let cookie = '';
  async function api(method, url, body, headers = {}) {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  }
  const ok = (r, label) => { assert.ok(r.status >= 200 && r.status < 300, `${label}: ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

  // Events queued since the last check.
  let lastSeq = 0n;
  async function newEvents() {
    const rows = await prisma.airbudget_deliveries.findMany({ where: { organization_id: fx.org.id, seq: { gt: lastSeq } }, orderBy: { seq: 'asc' } });
    if (rows.length) lastSeq = rows[rows.length - 1].seq;
    return rows.map(r => ({ type: r.type, external_id: r.external_id, data: r.payload.data, payload: r.payload }));
  }
  const expectEvents = async (expected, label) => {
    const events = await newEvents();
    assert.deepEqual(events.map(e => [e.type, e.external_id]), expected, label);
    for (const e of events) assertNoGuestData(assert, e.payload);
    return events;
  };
  const up = (kind, id) => ['movement.upserted', `${kind}:${id}`];
  const del = (kind, id) => ['movement.deleted', `${kind}:${id}`];
  const incomeOf = async (paymentId) => (await prisma.incomes.findUnique({ where: { payment_id: paymentId } }))?.id;

  ok(await api('POST', '/api/auth/login', { email: user.email, password }), 'login');

  await t.test('settings: admins only, the secret is write-only and validated', async () => {
    const anonymous = await fetch(`${base}/api/organizations/${fx.org.id}/airbudget`);
    assert.equal(anonymous.status, 401);
    let r = await api('PUT', `/api/organizations/${fx.org.id}/airbudget`, { webhook_url: receiver.url, secret: 'no-es-un-secreto' });
    assert.equal(r.status, 400);
    r = await api('PUT', `/api/organizations/${fx.org.id}/airbudget`, { webhook_url: 'ftp://x', secret: TEST_SECRET });
    assert.equal(r.status, 400);
    r = ok(await api('PUT', `/api/organizations/${fx.org.id}/airbudget`, { webhook_url: receiver.url, secret: TEST_SECRET }), 'save');
    assert.equal(r.integration.enabled, false);
    assert.equal(r.integration.has_secret, true);
    assert.ok(!JSON.stringify(r).includes(TEST_SECRET.slice(6)));
    const stored = await prisma.airbudget_integrations.findUnique({ where: { organization_id: fx.org.id } });
    assert.ok(!stored.secret_encrypted.includes(TEST_SECRET.slice(6)));

    // Off: changes are not queued.
    const e = ok(await api('POST', '/api/expenses', { organization_id: fx.org.id, venue_id: fx.venue.id, category_id: category.id, amount: 1000, description: 'Antes de activar', expense_date: '2026-10-01' }), 'expense while off');
    await expectEvents([], 'nothing while off');
    ok(await api('DELETE', `/api/expenses/${e.id}`), 'delete');

    r = ok(await api('POST', `/api/organizations/${fx.org.id}/airbudget/ping`), 'ping');
    assert.equal(r.ok, true);
    assert.equal(r.status_code, 200);
    assert.deepEqual(receiver.received.at(-1).event.type, 'ping');
    assert.equal(receiver.received.at(-1).userAgent, 'Cabania-Webhooks/1.0');
    r = ok(await api('PUT', `/api/organizations/${fx.org.id}/airbudget`, { enabled: true }), 'enable');
    assert.equal(r.integration.enabled, true);
    await newEvents(); // skip the ping
  });

  await t.test('REST expenses: create, edit, delete', async () => {
    const e = ok(await api('POST', '/api/expenses', {
      organization_id: fx.org.id, venue_id: fx.venue.id, category_id: category.id, accommodation_id: fx.booking.id,
      amount: 120000, description: 'Aseo después del evento de Lucía Fernández', expense_date: '2026-11-15', notes: 'lucia.fernandez@example.com'
    }), 'create');
    const [created] = await expectEvents([up('expense', e.id)], 'create');
    assert.equal(created.data.concept, 'Aseo después del evento de');
    assert.equal(created.data.category, category.name);
    ok(await api('PUT', `/api/expenses/${e.id}`, { amount: 130000 }), 'edit');
    const [edited] = await expectEvents([up('expense', e.id)], 'edit');
    assert.equal(edited.data.amount, 130000);
    ok(await api('DELETE', `/api/expenses/${e.id}`), 'delete');
    await expectEvents([del('expense', e.id)], 'delete');
  });

  let paymentId;
  await t.test('payments: only a verified payment is income', async () => {
    const p = ok(await api('POST', '/api/payments', { accommodation: fx.booking.id, amount: 200000, payment_method: 'Transferencia', payment_date: '2026-10-20', type: 'accommodation' }), 'record');
    paymentId = p.id;
    await expectEvents([], 'unverified payment is not income');
    ok(await api('PUT', `/api/payments/${p.id}`, { accommodation: fx.booking.id, amount: 250000, payment_method: 'Transferencia', payment_date: '2026-10-20' }), 'edit unverified');
    await expectEvents([], 'editing an unverified payment');
    ok(await api('PUT', `/api/payments/${p.id}/verify`, { verified: true }), 'verify');
    const income1 = await incomeOf(p.id);
    const [v] = await expectEvents([up('income', income1)], 'verify');
    assert.equal(v.data.amount, 250000);
    assert.equal(v.data.date, '2026-10-20');
    assert.equal(v.data.concept, `Reserva ${fx.venue.name} · Pasadía`);
    ok(await api('PUT', `/api/payments/${p.id}/verify`, { verified: false }), 'unverify');
    await expectEvents([del('income', income1)], 'unverify');
    ok(await api('PUT', `/api/payments/${p.id}/verify`, { verified: true }), 'verify again');
    await expectEvents([up('income', await incomeOf(p.id))], 'verify again');

    const p2 = ok(await api('POST', '/api/payments', { accommodation: fx.booking.id, amount: 50000, payment_method: 'Efectivo', payment_date: '2026-10-21' }), 'second');
    ok(await api('PUT', `/api/payments/${p2.id}/verify`, { verified: true }), 'verify second');
    const income2 = await incomeOf(p2.id);
    await expectEvents([up('income', income2)], 'verify second');
    ok(await api('DELETE', `/api/payments/${p2.id}`), 'delete payment');
    await expectEvents([del('income', income2)], 'delete payment');
    assert.equal(await prisma.incomes.count({ where: { id: income2 } }), 0, 'the income goes with its payment');
  });

  await t.test('booking edit: its incomes again only when the plan or venue changes', async () => {
    const acc = fx.booking;
    const body = { venue: acc.venue, date: '2026-11-14', adults: 12, children: 0, plan_id: fx.plan.id, agreed_price: 500000, customer: acc.customer };
    ok(await api('PUT', `/api/accommodations/${acc.id}`, body), 'edit people');
    await expectEvents([], 'people do not change the income');
    ok(await api('PUT', `/api/accommodations/${acc.id}`, { ...body, plan_id: plan2.id }), 'change plan');
    const [e] = await expectEvents([up('income', await incomeOf(paymentId))], 'plan change');
    assert.equal(e.data.concept, `Reserva ${fx.venue.name} · Pasanoche`);
  });

  await t.test('commissions paid with an expense', async () => {
    const paid = ok(await api('POST', '/api/commission-payments', {
      agent_id: agent.id, accommodation_id: fx.booking.id, organization_id: fx.org.id, venue_id: fx.venue.id,
      adults: 12, agreed_price: 500000, calculated_amount: 40000, status: 'paid', payment_date: '2026-11-16',
      create_expense: true, expense_category_id: category.id
    }), 'paid commission');
    const [a] = await expectEvents([up('expense', paid.expense_id)], 'commission paid at once');
    assert.equal(a.data.concept, `Comisión de venta · ${fx.venue.name}`);
    const pending = ok(await api('POST', '/api/commission-payments', {
      agent_id: agent.id, accommodation_id: fx.booking.id, organization_id: fx.org.id, venue_id: fx.venue.id,
      adults: 12, agreed_price: 500000, calculated_amount: 10000, status: 'pending'
    }), 'pending commission');
    await expectEvents([], 'pending commission is no expense');
    const later = ok(await api('PUT', `/api/commission-payments/${pending.id}`, { status: 'paid', payment_date: '2026-11-17', create_expense: true, expense_category_id: category.id }), 'pay later');
    await expectEvents([up('expense', later.expense_id)], 'commission paid later');
  });

  await t.test('recurring expense payment', async () => {
    const def = ok(await api('POST', '/api/recurring-expenses', { venue_id: fx.venue.id, name: 'Internet', frequency: 'monthly', due_day: 5, start_date: '2026-09-05', expected_amount: 90000, category_id: category.id }), 'recurring');
    const e = ok(await api('POST', '/api/expenses', { organization_id: fx.org.id, venue_id: fx.venue.id, category_id: category.id, amount: 90000, description: 'Internet octubre', expense_date: '2026-10-05', recurring_expense_id: def.id }), 'pay recurring');
    await expectEvents([up('expense', e.id)], 'recurring payment');
  });

  await t.test('Bold payment: income and the estimated fee', async () => {
    const link = await prisma.bold_payment_links.create({
      data: { venue_id: fx.venue.id, accommodation_id: fx.booking.id, bold_link_id: `LNK_TEST_${crypto.randomBytes(4).toString('hex')}`, bold_url: 'https://checkout.bold.co/test', amount: 100000, status: 'ACTIVE' }
    });
    const r = ok(await api('POST', `/api/bold/links/${link.id}/mark-paid`, { transaction_id: 'TX-TEST-1', payment_method: 'CARD', note: 'Conciliado en la prueba' }), 'mark paid');
    const income = await incomeOf(r.payment_id);
    const fee = await prisma.expenses.findFirst({ where: { accommodation_id: fx.booking.id, reference: 'TX-TEST-1' } });
    const events = await expectEvents(fee ? [up('income', income), up('expense', fee.id)] : [up('income', income)], 'bold');
    assert.equal(events[0].data.notes, 'Pago por Bold - CARD');
  });

  let key;
  await t.test('agent tools (REST and MCP use the same tools)', async () => {
    const created = ok(await api('POST', '/api/agent-keys', { name: 'Prueba AirBudget', can_write: true }), 'key');
    key = created.key;
    const tool = (method, url, body) => api(method, `/api/agent/v1${url}`, body, { authorization: `Bearer ${key}` });

    const rec = ok(await tool('POST', '/expenses', { amount: 45000, category: category.name, description: 'Hielo y carbón', booking_id: fx.booking.id, date: '2026-11-14' }), 'record_expense');
    const expenseId = rec.expense.id;
    await expectEvents([up('expense', expenseId)], 'record_expense');
    ok(await tool('PATCH', `/expenses/${expenseId}`, { amount: 47000 }), 'update_expense');
    const [u] = await expectEvents([up('expense', expenseId)], 'update_expense');
    assert.equal(u.data.amount, 47000);
    ok(await tool('POST', '/recurring-expenses', { from_expense_id: expenseId, frequency: 'monthly', name: 'Hielo' }), 'create_recurring_expense');
    await expectEvents([up('expense', expenseId)], 'linked as recurring payment');
    ok(await tool('POST', `/bookings/${fx.booking.id}/payments`, { amount: 10000, method: 'Nequi' }), 'record_payment');
    await expectEvents([], 'record_payment is unverified');
    ok(await tool('PATCH', `/bookings/${fx.booking.id}`, { plan_id: fx.plan.id }), 'update_booking');
    const incomes = await prisma.incomes.findMany({ where: { venue_id: fx.venue.id }, select: { id: true } });
    const events = await newEvents();
    assert.deepEqual(new Set(events.map(e => e.external_id)), new Set(incomes.map(i => `income:${i.id}`)), 'update_booking re-sends the incomes');

    const cancel = ok(await tool('POST', `/bookings/${fx.booking.id}/cancel`, { refund_amount: 30000, note: 'Lucía no puede ir' }), 'cancel_booking');
    const refund = await prisma.accommodations.findUnique({ where: { id: fx.booking.id }, select: { cancel_refund_expense_id: true } });
    assert.ok(cancel.ok);
    const [c] = await expectEvents([up('expense', refund.cancel_refund_expense_id)], 'cancel with refund');
    assert.equal(c.data.concept, `Devolución por cancelación · ${fx.venue.name}`);

    ok(await api('DELETE', `/api/accommodations/${fx.booking.id}/cancel`), 'undo cancel');
    await expectEvents([del('expense', refund.cancel_refund_expense_id)], 'undo cancel');
    ok(await api('POST', `/api/accommodations/${fx.booking.id}/cancel`, { note: 'De nuevo', refund: { amount: 20000, method: 'Nequi' } }), 'REST cancel');
    const again = await prisma.accommodations.findUnique({ where: { id: fx.booking.id }, select: { cancel_refund_expense_id: true } });
    await expectEvents([up('expense', again.cancel_refund_expense_id)], 'REST cancel with refund');
  });

  await t.test('the worker delivers everything, in order, signed', async () => {
    const all = await prisma.airbudget_deliveries.findMany({ where: { organization_id: fx.org.id, type: { not: 'ping' } }, orderBy: { seq: 'asc' } });
    for (let i = 0; ; i++) {
      const pending = await prisma.airbudget_deliveries.count({ where: { organization_id: fx.org.id, status: 'pending' } });
      if (!pending) break;
      if (i > 120) throw new Error(`${pending} still pending`);
      await new Promise(r => setTimeout(r, 250));
    }
    const failed = await prisma.airbudget_deliveries.findMany({ where: { organization_id: fx.org.id, status: 'failed' } });
    assert.deepEqual(failed, []);
    const got = receiver.received.filter(r => r.event.type !== 'ping');
    assert.equal(got.length, all.length);
    assert.deepEqual(got.map(r => r.id), all.map(d => d.event_id), 'sent in creation order');
    for (const r of got) {
      assert.equal(r.contentType, 'application/json');
      assertNoGuestData(assert, r.event);
    }
  });

  await t.test('"Enviar desde…" and "Reintentar" from the settings screen', async () => {
    let r = await api('POST', `/api/organizations/${fx.org.id}/airbudget/backfill`, { since: '20-10-2026' });
    assert.equal(r.status, 400);
    r = ok(await api('POST', `/api/organizations/${fx.org.id}/airbudget/backfill`, { since: '2026-10-01' }), 'backfill');
    const incomes = await prisma.incomes.count({ where: { organization_id: fx.org.id } });
    const expenses = await prisma.expenses.count({ where: { organization_id: fx.org.id, expense_date: { gte: new Date('2026-10-01T00:00:00Z') } } });
    assert.equal(r.queued, incomes + expenses);
    await newEvents();

    receiver.state.answer = 400;
    const e = ok(await api('POST', '/api/expenses', { organization_id: fx.org.id, venue_id: fx.venue.id, category_id: category.id, amount: 5000, description: 'Rechazado una vez', expense_date: '2026-10-30' }), 'expense');
    let delivery;
    for (let i = 0; i < 200; i++) {
      delivery = await prisma.airbudget_deliveries.findFirst({ where: { external_id: `expense:${e.id}` } });
      if (delivery.status !== 'pending') break;
      await new Promise(res => setTimeout(res, 250));
    }
    assert.equal(delivery.status, 'failed');
    assert.equal(delivery.last_status_code, 400);
    const listed = ok(await api('GET', `/api/organizations/${fx.org.id}/airbudget`), 'list');
    assert.ok(listed.deliveries.length <= 50);
    assert.equal(listed.deliveries.find(d => d.id === delivery.id).status, 'failed');

    receiver.state.answer = 200;
    ok(await api('POST', `/api/organizations/${fx.org.id}/airbudget/deliveries/${delivery.id}/retry`), 'retry');
    for (let i = 0; i < 200; i++) {
      delivery = await prisma.airbudget_deliveries.findUnique({ where: { id: delivery.id } });
      if (delivery.status !== 'pending') break;
      await new Promise(res => setTimeout(res, 250));
    }
    assert.equal(delivery.status, 'delivered');
  });
});
