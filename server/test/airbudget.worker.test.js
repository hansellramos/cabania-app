// AirBudget outbox and worker against a local database, with a fake AirBudget
// (fetch) and a fake clock: order per movement, retries and backoff, answers
// that are not retried, 410, timeouts, and no personal data in the payloads.
const test = require('node:test');
const assert = require('node:assert/strict');
const { skip, TEST_SECRET, createFixture, enableIntegration, dropFixture, assertNoGuestData } = require('./helpers/airbudgetDb');

test('AirBudget worker', { skip }, async (t) => {
  const { prisma } = require('../db');
  const { createAirbudgetSync, signWebhook } = require('../services/airbudgetSync');

  let clock = new Date('2026-10-23T12:00:00Z');
  const advance = (minutes) => { clock = new Date(clock.getTime() + minutes * 60 * 1000); };

  // Fake AirBudget: checks the signature and answers from a script.
  const calls = [];
  let answer = () => ({ status: 200 });
  const fakeFetch = async (url, init) => {
    const h = init.headers;
    const call = { url, id: h['webhook-id'], timestamp: h['webhook-timestamp'], body: JSON.parse(init.body), raw: init.body, headers: h };
    calls.push(call);
    assert.equal(h['webhook-signature'], signWebhook(TEST_SECRET, h['webhook-id'], h['webhook-timestamp'], init.body));
    assert.equal(h['webhook-timestamp'], String(Math.floor(clock.getTime() / 1000)));
    assert.equal(h['user-agent'], 'Cabania-Webhooks/1.0');
    assert.equal(h['content-type'], 'application/json');
    assert.match(h['webhook-id'], /^msg_[0-9a-f-]{36}$/);
    const a = answer(call);
    if (a.throw) throw a.throw;
    return new Response(a.body || '', { status: a.status });
  };
  const sync = createAirbudgetSync({ prisma, fetch: fakeFetch, now: () => new Date(clock), log: { warn() {}, error() {} } });

  const fx = await createFixture(prisma, 'Worker');
  t.after(async () => { await dropFixture(prisma, fx); await prisma.$disconnect(); });
  await enableIntegration(prisma, fx.org.id);

  const newExpense = (data = {}) => prisma.expenses.create({
    data: { organization_id: fx.org.id, venue_id: fx.venue.id, amount: 150000, description: 'Mantenimiento piscina', expense_date: new Date('2026-10-20T00:00:00Z'), ...data }
  });
  const reset = async () => {
    calls.length = 0;
    answer = () => ({ status: 200 });
    await prisma.airbudget_deliveries.deleteMany({ where: { organization_id: fx.org.id } });
  };

  await t.test('an expense is queued with the contract payload and no guest data', async () => {
    await reset();
    const expense = await newExpense({
      accommodation_id: fx.booking.id,
      description: 'Decoración pedida por Lucía Fernández (300 111 2233)',
      notes: 'Llamar a lucia.fernandez@example.com',
      subcategory: 'Globos'
    });
    const row = await prisma.$transaction(tx => sync.emitMovement(tx, { kind: 'expense', id: expense.id }));
    assert.equal(row.type, 'movement.upserted');
    assert.equal(row.status, 'pending');
    assert.equal(row.external_id, `expense:${expense.id}`);
    const { data } = row.payload;
    assert.deepEqual(Object.keys(row.payload).sort(), ['data', 'timestamp', 'type']);
    assert.equal(row.payload.timestamp, '2026-10-23T12:00:00Z');
    assert.deepEqual(
      { kind: data.kind, amount: data.amount, currency: data.currency, date: data.date, venue: data.venue, notes: data.notes, updated_at: data.updated_at },
      { kind: 'expense', amount: 150000, currency: 'COP', date: '2026-10-20', venue: fx.venue.name, notes: 'Globos', updated_at: '2026-10-23T12:00:00Z' }
    );
    assert.equal(data.concept, 'Decoración pedida por');
    assertNoGuestData(assert, row.payload);
    await sync.processDue();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].raw, JSON.stringify(calls[0].body)); // signed bytes = sent bytes
    const sent = await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } });
    assert.equal(sent.status, 'delivered');
    assert.equal(sent.attempts, 1);
    assert.equal(sent.last_status_code, 200);
  });

  await t.test('refunds and commissions get a fixed concept (they carry names)', async () => {
    await reset();
    const refund = await newExpense({ accommodation_id: fx.booking.id, description: 'Devolución por cancelación · Lucía Fernández · 2026-11-14' });
    await prisma.accommodations.update({ where: { id: fx.booking.id }, data: { cancel_refund_expense_id: refund.id } });
    const commissionExpense = await newExpense({ description: 'Comisión - Pedro Pérez - Evento 14/11/2026' });
    const provider = await prisma.providers.create({ data: { name: 'Pedro Pérez', organization_id: fx.org.id } });
    const agent = await prisma.commission_agents.create({ data: { name: 'Pedro Pérez', organization_id: fx.org.id, provider_id: provider.id } });
    await prisma.commission_payments.create({
      data: { agent_id: agent.id, accommodation_id: fx.booking.id, adults: 10, agreed_price: 500000, calculated_amount: 50000, status: 'paid', expense_id: commissionExpense.id }
    });
    try {
      const a = await sync.emitMovement(prisma, { kind: 'expense', id: refund.id });
      const b = await sync.emitMovement(prisma, { kind: 'expense', id: commissionExpense.id });
      assert.equal(a.payload.data.concept, `Devolución por cancelación · ${fx.venue.name}`);
      assert.equal(b.payload.data.concept, `Comisión de venta · ${fx.venue.name}`);
      assertNoGuestData(assert, a.payload);
      assert.ok(!JSON.stringify(b.payload).includes('Pedro'));
    } finally {
      await prisma.accommodations.update({ where: { id: fx.booking.id }, data: { cancel_refund_expense_id: null } });
      await prisma.commission_payments.deleteMany({ where: { agent_id: agent.id } });
      await prisma.commission_agents.delete({ where: { id: agent.id } });
      await prisma.providers.delete({ where: { id: provider.id } });
    }
  });

  await t.test('an income is the verified payment, described without guest data', async () => {
    await reset();
    const payment = await prisma.payments.create({
      data: { accommodation: fx.booking.id, amount: 350000, payment_method: 'Nequi 3001112233', payment_date: new Date('2026-10-20T00:00:00Z'), verified: true, notes: 'Lucía pagó el abono' }
    });
    const income = await prisma.incomes.create({
      data: { payment_id: payment.id, organization_id: fx.org.id, venue_id: fx.venue.id, amount: 350000, type: 'accommodation', date: new Date('2026-10-20T00:00:00Z') }
    });
    const row = await sync.emitMovement(prisma, { kind: 'income', id: income.id });
    assert.deepEqual(row.payload.data, {
      external_id: `income:${income.id}`,
      kind: 'income',
      amount: 350000,
      currency: 'COP',
      date: '2026-10-20',
      concept: `Reserva ${fx.venue.name} · Pasadía`,
      notes: 'Pago por Nequi',
      venue: fx.venue.name,
      category: 'Alquiler',
      updated_at: '2026-10-23T12:00:00Z'
    });
    assertNoGuestData(assert, row.payload);
  });

  await t.test('a deletion carries only external_id, kind and updated_at', async () => {
    await reset();
    const expense = await newExpense();
    await prisma.expenses.delete({ where: { id: expense.id } });
    const row = await sync.emitMovement(prisma, { kind: 'expense', id: expense.id, deleted: true, row: expense });
    assert.equal(row.type, 'movement.deleted');
    assert.deepEqual(row.payload.data, { external_id: `expense:${expense.id}`, kind: 'expense', updated_at: '2026-10-23T12:00:00Z' });
  });

  await t.test('events of one movement go in order; updated_at always grows', async () => {
    await reset();
    const expense = await newExpense();
    const first = await sync.emitMovement(prisma, { kind: 'expense', id: expense.id });
    await prisma.expenses.update({ where: { id: expense.id }, data: { amount: 175000 } });
    const second = await sync.emitMovement(prisma, { kind: 'expense', id: expense.id }); // same second
    const other = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
    assert.ok(second.payload.data.updated_at > first.payload.data.updated_at);

    answer = (call) => ({ status: call.id === first.event_id ? 500 : 200 });
    await sync.processDue();
    // The first fails; the second waits for it; another movement is not blocked.
    assert.deepEqual(calls.map(c => c.id), [first.event_id, other.event_id]);

    answer = () => ({ status: 200 });
    advance(1);
    await sync.processDue();
    assert.deepEqual(calls.map(c => c.id), [first.event_id, other.event_id, first.event_id, second.event_id]);
    assert.notEqual(calls[0].timestamp, calls[2].timestamp); // recalculated per attempt, same webhook-id
    assert.equal(calls[3].body.data.amount, 175000);
  });

  await t.test('retries 408, 429, 5xx and network errors: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, then failed', async () => {
    await reset();
    const row = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
    const answers = [{ status: 503 }, { status: 408 }, { status: 429 }, { throw: Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }, { throw: new TypeError('fetch failed') }, { status: 500 }, { status: 502 }];
    answer = () => answers[calls.length - 1];
    const waits = [];
    for (let i = 0; i < answers.length; i++) {
      await sync.processDue();
      const d = await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } });
      assert.equal(d.attempts, i + 1);
      if (i < answers.length - 1) {
        assert.equal(d.status, 'pending');
        waits.push((d.next_attempt_at - clock) / 60000);
        // Not before its time.
        advance(waits[i] - 0.5);
        await sync.processDue();
        assert.equal(calls.length, i + 1);
        advance(0.5);
      } else {
        assert.equal(d.status, 'failed');
        assert.equal(d.last_status_code, 502);
      }
    }
    assert.deepEqual(waits, [1, 5, 30, 120, 360, 720]);
    const d = await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } });
    assert.match(d.last_error, /HTTP 502/);
  });

  await t.test('timeout and network errors are recorded', async () => {
    await reset();
    const row = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
    answer = () => ({ throw: Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) });
    await sync.processDue();
    const d = await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } });
    assert.equal(d.status, 'pending');
    assert.equal(d.last_status_code, null);
    assert.equal(d.last_error, 'Sin respuesta en 10 s');
  });

  for (const status of [400, 401, 404]) {
    await t.test(`${status} is not retried`, async () => {
      await reset();
      const row = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
      answer = () => ({ status, body: '{"error":"bad"}' });
      await sync.processDue();
      advance(60);
      await sync.processDue();
      assert.equal(calls.length, 1);
      const d = await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } });
      assert.equal(d.status, 'failed');
      assert.equal(d.last_status_code, status);
      assert.equal(d.last_error, `HTTP ${status}: {"error":"bad"}`);
    });
  }

  await t.test('"Reintentar" puts a failed event back with fresh attempts', async () => {
    const failed = await prisma.airbudget_deliveries.findFirst({ where: { organization_id: fx.org.id, status: 'failed' } });
    calls.length = 0;
    answer = () => ({ status: 200 });
    assert.equal(await sync.retry(fx.org.id, failed.id), true);
    assert.equal(await sync.retry(fx.org.id, failed.id), false); // only failed ones
    await sync.processDue();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, failed.event_id);
    const d = await prisma.airbudget_deliveries.findUnique({ where: { id: failed.id } });
    assert.equal(d.status, 'delivered');
    assert.equal(d.attempts, 1);
  });

  await t.test('410 fails the event and turns the integration off', async () => {
    await reset();
    const row = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
    const queued = await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id });
    answer = () => ({ status: 410 });
    await sync.processDue();
    assert.equal(calls.length, 1); // the integration went off before the next one
    assert.equal((await prisma.airbudget_deliveries.findUnique({ where: { id: row.id } })).status, 'failed');
    assert.equal((await prisma.airbudget_deliveries.findUnique({ where: { id: queued.id } })).status, 'pending');
    const integration = await prisma.airbudget_integrations.findUnique({ where: { organization_id: fx.org.id } });
    assert.equal(integration.enabled, false);
    assert.match(integration.disabled_reason, /410/);
    // Off: nothing new is queued.
    assert.equal(await sync.emitMovement(prisma, { kind: 'expense', id: (await newExpense()).id }), null);
    await enableIntegration(prisma, fx.org.id);
  });

  await t.test('ping is sent at once and logged', async () => {
    await reset();
    const ok = await sync.ping(fx.org.id);
    assert.deepEqual(ok, { ok: true, status_code: 200, error: null });
    assert.deepEqual(calls[0].body, { type: 'ping', timestamp: clock.toISOString().replace(/\.\d{3}Z$/, 'Z'), data: {} });
    answer = () => ({ status: 401, body: 'firma inválida' });
    const bad = await sync.ping(fx.org.id);
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'HTTP 401: firma inválida');
    const logged = await prisma.airbudget_deliveries.findMany({ where: { organization_id: fx.org.id, type: 'ping' } });
    assert.deepEqual(logged.map(d => d.status).sort(), ['delivered', 'failed']);
    await sync.processDue();
    assert.equal(calls.length, 2); // the worker does not resend pings
  });

  await t.test('"Enviar desde…" queues every income and expense from that date', async () => {
    await reset();
    await prisma.expenses.create({ data: { organization_id: fx.org.id, venue_id: fx.venue.id, amount: 1000, description: 'Viejo', expense_date: new Date('2026-01-05T00:00:00Z') } });
    const expenses = await prisma.expenses.count({ where: { organization_id: fx.org.id, expense_date: { gte: new Date('2026-10-01T00:00:00Z') } } });
    const incomes = await prisma.incomes.count({ where: { organization_id: fx.org.id, date: { gte: new Date('2026-10-01T00:00:00Z') } } });
    const result = await sync.backfill(fx.org.id, '2026-10-01');
    assert.deepEqual(result, { queued: expenses + incomes, incomes, expenses });
    const rows = await prisma.airbudget_deliveries.findMany({ where: { organization_id: fx.org.id }, orderBy: { seq: 'asc' } });
    assert.equal(rows.length, expenses + incomes);
    assert.ok(rows.every(r => r.type === 'movement.upserted' && r.payload.data.date >= '2026-10-01'));
    for (const r of rows) assertNoGuestData(assert, r.payload);
  });
});
