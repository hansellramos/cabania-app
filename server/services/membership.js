/**
 * Membership billing helpers (platform memberships sold by CabanIA).
 *
 * A membership is a `subscriptions` row. When `paid_until` is set, the
 * membership is active through that day (Bogotá date) and expires after it.
 * Memberships without `paid_until` have no billing control and never expire.
 */

const DUE_SOON_DAYS = 7;
// Days before paid_until when the owner gets an in-app notice (-1 = expired).
const NOTICE_DAYS = [7, 1, -1];

/** Today's date in Bogotá as 'YYYY-MM-DD'. */
function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/** 'YYYY-MM-DD' of a @db.Date value (stored as UTC midnight). */
function toDateStr(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  return Math.round((Date.parse(toStr + 'T00:00:00Z') - Date.parse(fromStr + 'T00:00:00Z')) / 86400000);
}

/** Add months to a 'YYYY-MM-DD' date, clamping to the end of the month (Jan 31 + 1 = Feb 28). */
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * New paid_until after a payment of `months`: counted from the current
 * paid_until if it is still ahead of the payment date, otherwise from the
 * payment date (a late payment does not pay for the days it was expired).
 */
function extendPaidUntil(currentPaidUntil, paymentDate, months) {
  const current = toDateStr(currentPaidUntil);
  const base = current && current > paymentDate ? current : paymentDate;
  return addMonths(base, months);
}

/**
 * Status of a membership from its paid_until:
 * 'sin_control' (no date), 'al_dia', 'por_vencer' (≤ 7 days) or 'vencida'.
 */
function membershipStatus(paidUntil, today = todayBogota()) {
  const paid = toDateStr(paidUntil);
  if (!paid) return { status: 'sin_control', days_left: null, paid_until: null };
  const daysLeft = daysBetween(today, paid);
  let status = 'al_dia';
  if (daysLeft < 0) status = 'vencida';
  else if (daysLeft <= DUE_SOON_DAYS) status = 'por_vencer';
  return { status, days_left: daysLeft, paid_until: paid };
}

/**
 * The notice due today for a membership, or null: the tightest threshold
 * reached (7 days, 1 day or expired). Its key changes with paid_until, so a payment
 * re-arms the notices.
 */
function dueNotice(paidUntil, today = todayBogota()) {
  const { days_left: daysLeft, paid_until: paid } = membershipStatus(paidUntil, today);
  if (daysLeft === null || daysLeft > NOTICE_DAYS[0]) return null;
  const threshold = [...NOTICE_DAYS].reverse().find(t => daysLeft <= t);
  return { threshold, daysLeft, key: `${paid}|${threshold}` };
}

module.exports = {
  DUE_SOON_DAYS,
  todayBogota,
  toDateStr,
  addMonths,
  extendPaidUntil,
  membershipStatus,
  dueNotice,
};
