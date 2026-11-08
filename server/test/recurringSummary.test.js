// Month summary of recurring expenses (services/recurringExpenses.js monthSummary).
const test = require('node:test');
const assert = require('node:assert');
const { monthSummary, monthRange } = require('../services/recurringExpenses');

const cat = (id, name) => ({ id, name, color: null });
const base = { start_date: '2026-01-01', end_date: null, is_active: true, due_day: null };

test('monthRange gives the first and last day', () => {
  assert.deepStrictEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepStrictEqual(monthRange('2026-11'), { from: '2026-11-01', to: '2026-11-30' });
});

test('paid at the real amount, pending at the expected one, skipped left out', () => {
  const defs = [
    { ...base, id: 'a', frequency: 'monthly', due_day: 15, expected_amount: 500000, category: cat('c1', 'Nómina') },
    { ...base, id: 'b', frequency: 'monthly', due_day: 5, expected_amount: 120000, category: cat('c2', 'Servicios') },
    { ...base, id: 'c', frequency: 'biweekly', expected_amount: 100000, category: cat('c1', 'Nómina') },
    { ...base, id: 'd', frequency: 'monthly', due_day: 10, expected_amount: null, category: null },
    { ...base, id: 'e', frequency: 'monthly', due_day: 20, expected_amount: 90000, category: null, is_active: false },
  ];
  const expenses = [
    { recurring_expense_id: 'b', recurring_period: '2026-11-05', amount: '130000' },
    { recurring_expense_id: 'c', recurring_period: new Date('2026-11-15'), amount: 100000 },
  ];
  const skips = [{ recurring_expense_id: 'c', due_date: '2026-11-30' }];
  const s = monthSummary(defs, expenses, skips, '2026-11');
  assert.strictEqual(s.paid, 230000);
  assert.strictEqual(s.paid_count, 2);
  assert.strictEqual(s.pending, 500000); // a (c's 30th skipped, d has no amount, e inactive)
  assert.strictEqual(s.pending_count, 2);
  assert.strictEqual(s.pending_without_amount, 1);
  assert.strictEqual(s.total, 730000);
  assert.deepStrictEqual(s.categories.map(c => [c.name, c.paid, c.pending]), [
    ['Nómina', 100000, 500000],
    ['Servicios', 130000, 0],
  ]);
});

test('weekly expenses count every due date in the month', () => {
  const defs = [{ ...base, id: 'w', frequency: 'weekly', due_day: 1, expected_amount: 50000, category: null }];
  const s = monthSummary(defs, [], [], '2026-11'); // Mondays: 2, 9, 16, 23, 30
  assert.strictEqual(s.pending_count, 5);
  assert.strictEqual(s.pending, 250000);
});

test('a payment whose period is not a due date covers the due date of its month', () => {
  const { snapPeriod } = require('../services/recurringExpenses');
  // Like the gardener: starts on the 4th, due on the 15th, paid with period the 4th.
  const def = { ...base, id: 'j', frequency: 'monthly', due_day: 15, start_date: '2026-11-04', expected_amount: 500000, category: cat('c3', 'Jardinería') };
  assert.strictEqual(snapPeriod(def, '2026-11-04'), '2026-11-15');
  assert.strictEqual(snapPeriod(def, '2026-11-15'), '2026-11-15');
  assert.strictEqual(snapPeriod(def, '2026-10-15'), '2026-10-15'); // before the start: kept
  const nov = monthSummary([def], [{ recurring_expense_id: 'j', recurring_period: '2026-11-04', amount: 550000 }], [], '2026-11');
  assert.strictEqual(nov.paid, 550000);
  assert.strictEqual(nov.pending, 0); // not counted twice
  const oct = monthSummary([def], [{ recurring_expense_id: 'j', recurring_period: '2026-10-15', amount: 550000 }], [], '2026-10');
  assert.strictEqual(oct.paid, 550000);
});

test('status speaks of the next due date: a late October salary does not mark November paid', () => {
  const { periodStatus } = require('../services/recurringExpenses');
  const def = { frequency: 'monthly', due_day: 30, start_date: '2026-10-01', is_active: true };
  const s = periodStatus(def, '2026-11-08', new Set(['2026-10-30']), new Set());
  assert.strictEqual(s.status, 'programado');
  assert.strictEqual(s.current_period, '2026-11-30');
  // Paid ahead (internet paid the 8th for the 10th): registrado.
  const internet = { frequency: 'monthly', due_day: 10, start_date: '2026-10-01', is_active: true };
  assert.strictEqual(periodStatus(internet, '2026-11-08', new Set(['2026-10-10', '2026-11-10']), new Set()).status, 'registrado');
});

test('the current month carries the unpaid due dates of earlier months', () => {
  const luz = { ...base, id: 'l', frequency: 'monthly', due_day: 15, start_date: '2026-10-01', expected_amount: 400000, category: cat('c2', 'Servicios') };
  const gas = { ...base, id: 'g', frequency: 'monthly', due_day: 10, start_date: '2026-10-01', expected_amount: 98000, category: cat('c2', 'Servicios') };
  const internet = { ...base, id: 'i', frequency: 'monthly', due_day: 10, start_date: '2026-10-01', expected_amount: 100000, category: cat('c2', 'Servicios') };
  const expenses = [{ recurring_expense_id: 'i', recurring_period: '2026-10-10', amount: 100000 }];
  const skips = [{ recurring_expense_id: 'g', due_date: '2026-10-10' }];
  const nov = monthSummary([luz, gas, internet], expenses, skips, '2026-11', { carryFrom: '2025-11-01' });
  assert.deepStrictEqual(nov.overdue.items.map(i => [i.name, i.due]), [['l', '2026-10-15']].map(([, d]) => [luz.name, d]));
  assert.strictEqual(nov.overdue.amount, 400000);
  assert.strictEqual(nov.pending, 598000); // November's own: luz + gas + internet
  assert.strictEqual(nov.total, 998000);
  // Without carryFrom (past or future months) nothing is carried.
  assert.strictEqual(monthSummary([luz], [], [], '2026-11').overdue.count, 0);
});
