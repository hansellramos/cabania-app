// Schedule math for recurring expenses. Dates are 'YYYY-MM-DD' strings (Bogotá
// calendar days), so nothing here depends on the server's timezone.

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'bimonthly', 'yearly'];

// How many days before the due date an occurrence counts as "pendiente".
const LEAD_DAYS = { weekly: 2, biweekly: 4, monthly: 7, bimonthly: 7, yearly: 15 };

// How far back unpaid occurrences still count as overdue.
const OVERDUE_LOOKBACK_DAYS = 365;

/** A Date (as Prisma returns @db.Date: UTC midnight) or string to 'YYYY-MM-DD'. */
function isoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDays(iso, n) {
  const { y, m, d } = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** ISO weekday: 1 = lunes ... 7 = domingo. */
function isoWeekday(iso) {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Month index (y * 12 + m - 1) shifted by k months, back to { y, m }. */
function shiftMonth(y, m, k) {
  const idx = y * 12 + (m - 1) + k;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/**
 * Due dates of a recurring expense between `from` and `to` (inclusive), within
 * its start/end dates.
 *  - weekly: every week on `due_day` (ISO weekday; default the start date's).
 *  - biweekly (quincenal): days 15 and the last day of every month.
 *  - monthly / bimonthly / yearly: on `due_day` (clamped to the month's length;
 *    default the start date's day), every 1 / 2 / 12 months counted from the
 *    start date's month.
 */
function occurrencesBetween(def, from, to) {
  const start = isoDate(def.start_date);
  const end = isoDate(def.end_date);
  const lo = from > start ? from : start;
  const hi = end && end < to ? end : to;
  if (lo > hi) return [];
  const out = [];

  if (def.frequency === 'weekly') {
    const weekday = def.due_day >= 1 && def.due_day <= 7 ? def.due_day : isoWeekday(start);
    let date = addDays(lo, (weekday - isoWeekday(lo) + 7) % 7);
    while (date <= hi) {
      out.push(date);
      date = addDays(date, 7);
    }
    return out;
  }

  const s = parts(start);
  const l = parts(lo);
  const step = def.frequency === 'yearly' ? 12 : def.frequency === 'bimonthly' ? 2 : 1;
  // First month to look at: the step boundary just before `lo`.
  const monthsFromStart = (l.y * 12 + l.m) - (s.y * 12 + s.m);
  let k = Math.max(0, Math.floor(monthsFromStart / step) - 1) * step;
  for (;; k += step) {
    const { y, m } = shiftMonth(s.y, s.m, k);
    if (fmt(y, m, 1) > hi) break;
    const last = daysInMonth(y, m);
    const days = def.frequency === 'biweekly'
      ? [15, last]
      : [Math.min(def.due_day >= 1 && def.due_day <= 31 ? def.due_day : s.d, last)];
    for (const day of days) {
      const date = fmt(y, m, day);
      if (date >= lo && date <= hi) out.push(date);
    }
  }
  return out;
}

/** Latest due date on or before `date`, or null. */
function previousOccurrence(def, date) {
  const list = occurrencesBetween(def, addDays(date, -400), date);
  return list.length ? list[list.length - 1] : null;
}

/** First due date after `date`, or null (ended). */
function nextOccurrence(def, date) {
  return occurrencesBetween(def, addDays(date, 1), addDays(date, 400))[0] || null;
}

/** The occurrence an expense dated `date` most likely pays: the closest due date. */
function closestOccurrence(def, date) {
  const prev = previousOccurrence(def, date);
  const next = nextOccurrence(def, date);
  if (!prev) return next;
  if (!next) return prev;
  const diff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b));
  return diff(next, date) < diff(prev, date) ? next : prev;
}

/**
 * The due date a payment for `period` covers: `period` itself when it is a due
 * date, else the closest due date in the same month (a payment dated the 4th
 * covers the bill due the 15th), else `period` unchanged (e.g. a month before
 * the start date, which then counts in its own month without any due date).
 */
function snapPeriod(def, period) {
  if (!period) return period;
  const month = monthRange(period.slice(0, 7));
  const dues = occurrencesBetween(def, month.from, month.to);
  if (!dues.length || dues.includes(period)) return period;
  const diff = (d) => Math.abs(Date.parse(d) - Date.parse(period));
  return dues.reduce((best, d) => (diff(d) < diff(best) ? d : best));
}

/**
 * Where a recurring expense stands today.
 * `paid` and `skipped` are Sets of due dates already covered.
 *
 * status:
 *  - vencido: a past due date has no expense and was not skipped
 *  - pendiente: due today or within the lead days
 *  - programado: the next due date is not close and not paid yet
 *  - registrado / omitido: the next due date was already paid / skipped ahead
 *  - finalizado: past its end date with nothing owed
 *  - inactivo: turned off
 *
 * current_period is the due date the "Registrar" / "Omitir" buttons act on.
 */
function periodStatus(def, today, paid, skipped) {
  const covered = (d) => paid.has(d) || skipped.has(d);
  const lastDue = previousOccurrence(def, today);
  const nextDue = nextOccurrence(def, today);
  const result = { last_due: lastDue, next_due: nextDue, overdue_periods: [], current_period: null, status: null };

  if (!def.is_active) {
    result.status = 'inactivo';
    return result;
  }

  result.overdue_periods = occurrencesBetween(def, addDays(today, -OVERDUE_LOOKBACK_DAYS), addDays(today, -1))
    .filter(d => !covered(d));
  if (result.overdue_periods.length) {
    result.status = 'vencido';
    result.current_period = result.overdue_periods[0];
    return result;
  }

  if (lastDue === today && !covered(lastDue)) {
    result.status = 'pendiente';
    result.current_period = lastDue;
    return result;
  }

  const lead = LEAD_DAYS[def.frequency] || 7;
  if (nextDue && !covered(nextDue) && nextDue <= addDays(today, lead)) {
    result.status = 'pendiente';
    result.current_period = nextDue;
    return result;
  }

  // Nothing owed now: the status speaks of the next due date, not the last one
  // (a salary paid late for October must not read as November paid).
  if (nextDue && !covered(nextDue)) {
    result.status = 'programado';
    result.current_period = nextDue;
  } else if (nextDue) {
    result.status = paid.has(nextDue) ? 'registrado' : 'omitido';
  } else if (lastDue && covered(lastDue) && isoDate(def.end_date) && isoDate(def.end_date) < today) {
    result.status = 'finalizado';
  } else if (lastDue) {
    result.status = paid.has(lastDue) ? 'registrado' : 'omitido';
  } else {
    result.status = 'finalizado';
  }
  return result;
}

/** First and last day ('YYYY-MM-DD') of a month given as 'YYYY-MM'. */
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { from: fmt(y, m, 1), to: fmt(y, m, daysInMonth(y, m)) };
}

/**
 * What the recurring expenses cost in a month ('YYYY-MM').
 *  - paid: expenses linked to a recurring expense whose period falls in the month
 *    (their real amount).
 *  - pending: due dates in the month with no expense and not skipped, at the
 *    expected amount (active expenses only; `pending_without_amount` counts the
 *    ones with no expected amount).
 * Also split by category. `expenses` and `skips` are the rows of these defs.
 * With `carryFrom` (for the current month), due dates from that day to the end
 * of the previous month still unpaid and not skipped are carried in as
 * `overdue`: they count in the total, the categories and the balance, since
 * this month's income has to cover them.
 */
function monthSummary(defs, expenses, skips, month, { carryFrom = null } = {}) {
  const { from, to } = monthRange(month);
  const inMonth = (d) => d && d >= from && d <= to;
  const byCategory = new Map();
  const bucket = (def) => {
    const key = def.category?.id || 'none';
    if (!byCategory.has(key)) {
      byCategory.set(key, { id: def.category?.id || null, name: def.category?.name || 'Sin categoría', color: def.category?.color || null, paid: 0, pending: 0 });
    }
    return byCategory.get(key);
  };
  const totals = { paid: 0, pending: 0, paid_count: 0, pending_count: 0, pending_without_amount: 0 };
  // Unpaid due dates of earlier months carried into this one (current month only).
  const overdue = { amount: 0, count: 0, items: [] };

  for (const def of defs) {
    const own = expenses.filter(e => e.recurring_expense_id === def.id);
    const paidPeriods = new Set();
    for (const e of own) {
      const period = snapPeriod(def, isoDate(e.recurring_period));
      if (!inMonth(period)) continue;
      paidPeriods.add(period);
      const amount = Number(e.amount) || 0;
      totals.paid += amount;
      totals.paid_count++;
      bucket(def).paid += amount;
    }
    if (!def.is_active) continue;
    const skipped = new Set(skips.filter(s => s.recurring_expense_id === def.id).map(s => isoDate(s.due_date)));
    if (carryFrom && carryFrom < from) {
      const paidBefore = new Set(own.map(e => snapPeriod(def, isoDate(e.recurring_period))));
      for (const due of occurrencesBetween(def, carryFrom, addDays(from, -1))) {
        if (paidBefore.has(due) || skipped.has(due)) continue;
        const amount = def.expected_amount === null || def.expected_amount === undefined ? null : Number(def.expected_amount) || 0;
        overdue.count++;
        overdue.items.push({ recurring_expense_id: def.id, name: def.name, due, amount });
        if (amount) {
          overdue.amount += amount;
          bucket(def).pending += amount;
        }
      }
    }
    for (const due of occurrencesBetween(def, from, to)) {
      if (paidPeriods.has(due) || skipped.has(due)) continue;
      totals.pending_count++;
      if (def.expected_amount === null || def.expected_amount === undefined) {
        totals.pending_without_amount++;
        continue;
      }
      const amount = Number(def.expected_amount) || 0;
      totals.pending += amount;
      bucket(def).pending += amount;
    }
  }
  const categories = [...byCategory.values()]
    .filter(c => c.paid || c.pending)
    .sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
  overdue.items.sort((a, b) => a.due.localeCompare(b.due));
  return { month, from, to, ...totals, overdue, total: totals.paid + totals.pending + overdue.amount, categories };
}

module.exports = {
  FREQUENCIES,
  isoDate,
  addDays,
  occurrencesBetween,
  previousOccurrence,
  nextOccurrence,
  closestOccurrence,
  periodStatus,
  monthRange,
  monthSummary,
  snapPeriod
};
