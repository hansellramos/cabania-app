/**
 * Reports an organization's incomes and expenses to AirBudget through a signed
 * webhook (Standard Webhooks style).
 *
 * - Source of truth: an income is a row of `incomes` (a verified payment; an
 *   unverified payment is not money received yet), an expense a row of
 *   `expenses`. Security deposits are not reported: they are returned.
 * - Every path that creates, edits or deletes one calls emitMovement() with the
 *   transaction client, so the event is written in the same transaction
 *   (transactional outbox, table airbudget_deliveries).
 * - A worker sends the pending events in insertion order; events of the same
 *   movement never overtake each other. Retries with growing waits.
 * - Payloads carry no personal data: no guest names, phones or emails.
 *
 * Contract (do not change without telling AirBudget):
 *   POST <url>  webhook-id: msg_<uuid>, webhook-timestamp: <unix s>,
 *   webhook-signature: v1,<base64 HMAC-SHA256(secret, `${id}.${ts}.${body}`)>
 */
const crypto = require('crypto');
const secretBox = require('../lib/secretBox');

const USER_AGENT = 'Cabania-Webhooks/1.0';
const TIMEOUT_MS = 10 * 1000;
// Waits after each failed attempt; once used up the event is `failed`.
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 360, 720];
// While one worker sends an event, others leave it alone this long.
const LEASE_MS = 60 * 1000;
const INCOME_CATEGORY = 'Alquiler';

// ---------- Signature ----------

/** Error message for a secret that is not whsec_<base64 of 16+ bytes>, or null. */
function secretError(secret) {
  const match = /^whsec_([A-Za-z0-9+/]+={0,2})$/.exec(String(secret || '').trim());
  if (!match) return 'El secreto debe tener el formato whsec_<base64>';
  if (Buffer.from(match[1], 'base64').length < 16) return 'El secreto es muy corto';
  return null;
}

function signWebhook(secret, id, timestamp, body) {
  const key = Buffer.from(String(secret).trim().replace(/^whsec_/, ''), 'base64');
  const digest = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${digest}`;
}

/** Error message for a webhook URL we will not call, or null. */
function urlError(value, { allowHttpLocalhost = process.env.NODE_ENV !== 'production' } = {}) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return 'La URL no es válida'; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && local && allowHttpLocalhost) return null;
  return 'La URL debe empezar por https://';
}

// ---------- Retry policy ----------

/** What to do after an attempt: delivered | retry | failed | gone (410). */
function classify(statusCode) {
  if (statusCode == null) return 'retry'; // network error or timeout
  if (statusCode >= 200 && statusCode < 300) return 'delivered';
  if (statusCode === 410) return 'gone';
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) return 'retry';
  return 'failed'; // 400, 401, 404 and any other answer that will not change by retrying
}

/** When to try again after `attempts` attempts, or null when they are used up. */
function nextAttemptAt(attempts, now) {
  const minutes = RETRY_DELAYS_MINUTES[attempts - 1];
  return minutes ? new Date(now.getTime() + minutes * 60 * 1000) : null;
}

// ---------- Personal data ----------

const EMAIL_RE = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
// A run of 7+ digits with optional +, spaces, dashes or parentheses (phones and
// IDs). Amounts written with thousand dots (1.500.000) are left alone.
const PHONE_RE = /\+?\d[\d\s()-]{5,}\d/g;
const letters = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text without emails, phone-like numbers or the given names. */
function scrub(text, names = []) {
  if (!text) return '';
  let out = String(text)
    .replace(EMAIL_RE, '')
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 7 && !/^\d{4}-\d{2}-\d{2}$/.test(m) ? '' : m));
  const words = new Set();
  for (const name of names) {
    for (const word of letters(String(name || '')).split(/\s+/)) if (word.length >= 3) words.add(word.toLowerCase());
  }
  if (words.size) {
    const plain = letters(out);
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${[...words].map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    // Work on the accent-free copy to find names, cut the same spans from the original.
    const spans = [];
    for (const m of plain.matchAll(pattern)) spans.push([m.index, m.index + m[0].length]);
    for (const [start, end] of spans.reverse()) out = out.slice(0, start) + out.slice(end);
  }
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/([·,:;-])(?:\s*[·,:;-])+/g, '$1')
    .replace(/^[\s·,:;-]+|[\s·,:;-]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

// ---------- Payloads ----------

const isoSeconds = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const amountOf = (v) => Math.round(Math.abs(Number(v) || 0) * 100) / 100;
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

function envelope(type, data, now) {
  return { type, timestamp: isoSeconds(now), data };
}

/**
 * @param {object} deps
 * @param {import('@prisma/client').PrismaClient} deps.prisma
 * @param {typeof fetch} [deps.fetch]
 * @param {() => Date} [deps.now]
 */
function createAirbudgetSync({ prisma, fetch: fetchImpl = globalThis.fetch, now = () => new Date(), log = console } = {}) {
  /** The organization's integration when it is on, else null. */
  async function activeIntegration(db, organizationId) {
    if (!organizationId) return null;
    return db.airbudget_integrations.findFirst({
      where: { organization_id: organizationId, enabled: true },
      select: { id: true, organization_id: true }
    });
  }

  async function venueInfo(db, venueId) {
    if (!venueId) return null;
    return db.venues.findUnique({ where: { id: venueId }, select: { name: true, organization: true } });
  }

  /** Movement data for an income (verified payment), or null when it is gone. */
  async function incomeSnapshot(db, incomeId) {
    const income = await db.incomes.findUnique({ where: { id: incomeId } });
    if (!income) return null;
    const payment = income.payment_id
      ? await db.payments.findUnique({ where: { id: income.payment_id }, select: { payment_method: true, accommodation: true } })
      : null;
    const booking = payment?.accommodation
      ? await db.accommodations.findUnique({ where: { id: payment.accommodation }, select: { venue: true, plan_id: true, customer: true } })
      : null;
    const venue = await venueInfo(db, income.venue_id || booking?.venue);
    const plan = booking?.plan_id
      ? await db.venue_plans.findUnique({ where: { id: booking.plan_id }, select: { name: true } })
      : null;
    const customer = booking?.customer
      ? await db.contacts.findUnique({ where: { id: booking.customer }, select: { fullname: true } })
      : null;
    const names = [customer?.fullname];
    const planName = scrub(plan?.name, names);
    const concept = booking
      ? ['Reserva', venue?.name, planName].filter(Boolean).join(' · ').replace('Reserva · ', 'Reserva ')
      : `Ingreso${venue?.name ? ` ${venue.name}` : ''}`;
    const method = scrub(payment?.payment_method, names);
    return {
      organizationId: income.organization_id || venue?.organization || null,
      data: {
        external_id: `income:${income.id}`,
        kind: 'income',
        amount: amountOf(income.amount),
        currency: 'COP',
        date: isoDay(income.date || income.created_at),
        concept: clip(concept, 200),
        ...(method && { notes: clip(`Pago por ${method}`, 500) }),
        ...(venue?.name && { venue: venue.name }),
        category: INCOME_CATEGORY
      }
    };
  }

  /** Movement data for an expense, or null when it is gone. */
  async function expenseSnapshot(db, expenseId) {
    const expense = await db.expenses.findUnique({ where: { id: expenseId }, include: { category: { select: { name: true } } } });
    if (!expense) return null;
    const venue = await venueInfo(db, expense.venue_id);
    const booking = expense.accommodation_id
      ? await db.accommodations.findUnique({ where: { id: expense.accommodation_id }, select: { customer: true, cancel_refund_expense_id: true } })
      : null;
    const customer = booking?.customer
      ? await db.contacts.findUnique({ where: { id: booking.customer }, select: { fullname: true } })
      : null;
    // Expenses the app writes itself carry a person's name in the description:
    // the guest (refunds) or the commission agent. Those get a fixed concept.
    const commission = await db.commission_payments.findFirst({ where: { expense_id: expense.id }, select: { id: true } });
    const categoryName = expense.category?.name || null;
    const isRefund = booking?.cancel_refund_expense_id === expense.id
      || (categoryName === 'Devoluciones' && !!expense.accommodation_id);
    const where = venue?.name ? ` · ${venue.name}` : '';
    const names = [customer?.fullname];
    let concept;
    if (commission) concept = `Comisión de venta${where}`;
    else if (isRefund) concept = `Devolución por cancelación${where}`;
    else concept = scrub(expense.description, names) || categoryName || 'Egreso';
    const notes = scrub(expense.subcategory, names);
    return {
      organizationId: expense.organization_id || venue?.organization || null,
      data: {
        external_id: `expense:${expense.id}`,
        kind: 'expense',
        amount: amountOf(expense.amount),
        currency: 'COP',
        date: isoDay(expense.expense_date),
        concept: clip(concept, 200),
        ...(notes && { notes: clip(notes, 500) }),
        ...(venue?.name && { venue: venue.name }),
        ...(categoryName && { category: categoryName })
      }
    };
  }

  /**
   * updated_at of a new event: now, but always after the previous event of the
   * same movement (AirBudget drops an event older than the last one it applied).
   */
  async function nextUpdatedAt(db, externalId, at) {
    const last = await db.airbudget_deliveries.findFirst({
      where: { external_id: externalId },
      orderBy: { seq: 'desc' },
      select: { payload: true }
    });
    const previous = last?.payload?.data?.updated_at ? new Date(last.payload.data.updated_at) : null;
    const seconds = Math.floor(at.getTime() / 1000) * 1000;
    return new Date(previous && previous.getTime() >= seconds ? previous.getTime() + 1000 : seconds);
  }

  async function enqueue(db, organizationId, type, data, at = now()) {
    const event = envelope(type, data, at);
    return db.airbudget_deliveries.create({
      data: {
        organization_id: organizationId,
        event_id: `msg_${crypto.randomUUID()}`,
        type,
        external_id: data.external_id || null,
        payload: event,
        next_attempt_at: at
      }
    });
  }

  /**
   * Queue the current state of an income or expense for AirBudget. Call it with
   * the transaction client after the change, inside the same transaction.
   * Deletions pass the row as it was (`row`), since it no longer exists.
   *
   * @param {object} db prisma or a transaction client
   * @param {{ kind: 'income'|'expense', id: string, deleted?: boolean, row?: object }} movement
   */
  async function emitMovement(db, { kind, id, deleted = false, row = null }) {
    if (!id || (kind !== 'income' && kind !== 'expense')) return null;
    const at = now();
    const externalId = `${kind}:${id}`;
    let organizationId;
    let data = null;
    if (!deleted) {
      const snapshot = kind === 'income' ? await incomeSnapshot(db, id) : await expenseSnapshot(db, id);
      if (!snapshot) return null;
      organizationId = snapshot.organizationId;
      // A movement of zero is no movement: AirBudget removes it.
      if (snapshot.data.amount > 0) data = snapshot.data;
    } else {
      organizationId = row?.organization_id || (await venueInfo(db, row?.venue_id))?.organization || null;
    }
    if (!(await activeIntegration(db, organizationId))) return null;
    const updatedAt = isoSeconds(await nextUpdatedAt(db, externalId, at));
    return data
      ? enqueue(db, organizationId, 'movement.upserted', { ...data, updated_at: updatedAt }, at)
      : enqueue(db, organizationId, 'movement.deleted', { external_id: externalId, kind, updated_at: updatedAt }, at);
  }

  /** The incomes of a booking again (its venue or plan name is in the concept). */
  async function emitBookingIncomes(db, accommodationId) {
    if (!accommodationId) return;
    const payments = await db.payments.findMany({ where: { accommodation: accommodationId }, select: { id: true } });
    if (!payments.length) return;
    const incomes = await db.incomes.findMany({ where: { payment_id: { in: payments.map(p => p.id) } }, select: { id: true } });
    for (const income of incomes) await emitMovement(db, { kind: 'income', id: income.id });
  }

  // ---------- Sending ----------

  async function post(url, secret, eventId, payload) {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(now().getTime() / 1000);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': USER_AGENT,
          'webhook-id': eventId,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signWebhook(secret, eventId, timestamp, body)
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      let text = '';
      try { text = (await res.text()).slice(0, 300).trim(); } catch { /* no body */ }
      const ok = res.status >= 200 && res.status < 300;
      return { statusCode: res.status, error: ok ? null : `HTTP ${res.status}${text ? `: ${text}` : ''}` };
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return { statusCode: null, error: timedOut ? 'Sin respuesta en 10 s' : `Error de red: ${err?.cause?.code || err?.message || err}` };
    }
  }

  async function disableIntegration(organizationId, reason) {
    await prisma.airbudget_integrations.updateMany({
      where: { organization_id: organizationId },
      data: { enabled: false, disabled_reason: reason, updated_at: now(), updated_by: 'system:airbudget' }
    });
    log.warn?.('[airbudget] Integration disabled', { organizationId, reason });
  }

  /** Send one queued event if it is still due and its integration is on. */
  async function deliver(deliveryId) {
    const at = now();
    const claimed = await prisma.airbudget_deliveries.updateMany({
      where: { id: deliveryId, status: 'pending', next_attempt_at: { lte: at } },
      data: { next_attempt_at: new Date(at.getTime() + LEASE_MS) }
    });
    if (!claimed.count) return null;
    const delivery = await prisma.airbudget_deliveries.findUnique({ where: { id: deliveryId } });
    const integration = await prisma.airbudget_integrations.findUnique({ where: { organization_id: delivery.organization_id } });
    if (!integration?.enabled) {
      await prisma.airbudget_deliveries.update({ where: { id: deliveryId }, data: { next_attempt_at: at } });
      return null;
    }
    let secret;
    try {
      secret = secretBox.decrypt(integration.secret_encrypted, integration.organization_id);
    } catch (err) {
      // Not counted as an attempt: it is ours, not AirBudget's. Try later.
      await prisma.airbudget_deliveries.update({
        where: { id: deliveryId },
        data: { next_attempt_at: new Date(at.getTime() + 5 * 60 * 1000), last_error: `No se pudo leer el secreto: ${err.message}` }
      });
      return null;
    }

    const result = await post(integration.webhook_url, secret, delivery.event_id, delivery.payload);
    const attempts = delivery.attempts + 1;
    const outcome = classify(result.statusCode);
    const done = now();
    const data = { attempts, last_status_code: result.statusCode, last_error: result.error };
    if (outcome === 'delivered') {
      Object.assign(data, { status: 'delivered', delivered_at: done, last_error: null });
    } else if (outcome === 'retry' && nextAttemptAt(attempts, done)) {
      data.next_attempt_at = nextAttemptAt(attempts, done);
    } else {
      data.status = 'failed';
    }
    await prisma.airbudget_deliveries.update({ where: { id: deliveryId }, data });
    if (outcome === 'gone') {
      await disableIntegration(delivery.organization_id, 'AirBudget respondió 410: la integración está desactivada allá');
    }
    return { ...result, outcome: data.status || 'pending' };
  }

  /**
   * Due events, oldest first, skipping one while an older event of the same
   * movement is still pending (even if that one waits for a retry).
   */
  async function dueDeliveries(limit) {
    return prisma.$queryRaw`
      SELECT d.id
      FROM airbudget_deliveries d
      JOIN airbudget_integrations i ON i.organization_id = d.organization_id AND i.enabled
      WHERE d.status = 'pending'
        AND d.next_attempt_at <= ${now()}
        AND (d.external_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM airbudget_deliveries p
          WHERE p.external_id = d.external_id AND p.status = 'pending' AND p.seq < d.seq
        ))
      ORDER BY d.seq
      LIMIT ${limit}`;
  }

  let running = false;
  /**
   * One worker pass: sends what is due, oldest first. It asks for the next one
   * after each send, since delivering an event can free a newer one of the same
   * movement that must go before the rest. Returns how many were tried.
   */
  async function processDue({ max = 500 } = {}) {
    if (running) return 0;
    running = true;
    let tried = 0;
    try {
      for (let i = 0; i < max; i++) {
        const [next] = await dueDeliveries(1);
        if (!next) break;
        if (await deliver(next.id)) tried++;
      }
    } finally {
      running = false;
    }
    return tried;
  }

  let timer = null;
  function start(intervalMs = 10 * 1000) {
    if (timer) return;
    timer = setInterval(() => processDue().catch(err => log.error?.('[airbudget] Worker error:', err.message)), intervalMs);
    timer.unref?.();
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // ---------- Settings screen ----------

  /** "Probar conexión": sends a ping now and logs it with the other events. */
  async function ping(organizationId) {
    const integration = await prisma.airbudget_integrations.findUnique({ where: { organization_id: organizationId } });
    if (!integration) return { ok: false, error: 'Primero guarda la URL y el secreto' };
    const at = now();
    const delivery = await prisma.airbudget_deliveries.create({
      data: {
        organization_id: organizationId,
        event_id: `msg_${crypto.randomUUID()}`,
        type: 'ping',
        payload: envelope('ping', {}, at),
        // Not for the worker: it is sent right here, once.
        status: 'failed',
        next_attempt_at: at
      }
    });
    let result;
    try {
      const secret = secretBox.decrypt(integration.secret_encrypted, organizationId);
      result = await post(integration.webhook_url, secret, delivery.event_id, delivery.payload);
    } catch (err) {
      result = { statusCode: null, error: `No se pudo leer el secreto: ${err.message}` };
    }
    const ok = classify(result.statusCode) === 'delivered';
    await prisma.airbudget_deliveries.update({
      where: { id: delivery.id },
      data: {
        status: ok ? 'delivered' : 'failed',
        attempts: 1,
        last_status_code: result.statusCode,
        last_error: result.error,
        ...(ok && { delivered_at: now() })
      }
    });
    if (result.statusCode === 410) {
      await disableIntegration(organizationId, 'AirBudget respondió 410: la integración está desactivada allá');
    }
    return { ok, status_code: result.statusCode, error: result.error };
  }

  /** Put a failed event back in the queue with a fresh set of attempts. */
  async function retry(organizationId, deliveryId) {
    const updated = await prisma.airbudget_deliveries.updateMany({
      where: { id: deliveryId, organization_id: organizationId, status: 'failed', type: { not: 'ping' } },
      data: { status: 'pending', attempts: 0, next_attempt_at: now() }
    });
    return updated.count > 0;
  }

  /**
   * "Enviar desde…": queue a movement.upserted for every income and expense of
   * the organization dated on or after `since` (YYYY-MM-DD). AirBudget is
   * idempotent by external_id, so sending again is harmless.
   */
  async function backfill(organizationId, since) {
    if (!(await activeIntegration(prisma, organizationId))) return { error: 'Activa la integración primero' };
    const from = new Date(`${since}T00:00:00.000Z`);
    const venues = await prisma.venues.findMany({ where: { organization: organizationId }, select: { id: true } });
    const venueIds = venues.map(v => v.id);
    const ofOrg = [{ organization_id: organizationId }, { organization_id: null, venue_id: { in: venueIds } }];
    const incomes = await prisma.incomes.findMany({
      where: { OR: ofOrg, date: { gte: from } }, select: { id: true }, orderBy: [{ date: 'asc' }, { created_at: 'asc' }]
    });
    const expenses = await prisma.expenses.findMany({
      where: { OR: ofOrg, expense_date: { gte: from } }, select: { id: true }, orderBy: [{ expense_date: 'asc' }, { created_at: 'asc' }]
    });
    let queued = 0;
    for (const [kind, rows] of [['income', incomes], ['expense', expenses]]) {
      for (const { id } of rows) {
        if (await emitMovement(prisma, { kind, id })) queued++;
      }
    }
    return { queued, incomes: incomes.length, expenses: expenses.length };
  }

  return {
    emitMovement, emitBookingIncomes,
    incomeSnapshot, expenseSnapshot,
    processDue, deliver, start, stop,
    ping, retry, backfill
  };
}

module.exports = {
  createAirbudgetSync,
  signWebhook, secretError, urlError, classify, nextAttemptAt, scrub,
  RETRY_DELAYS_MINUTES, USER_AGENT
};
