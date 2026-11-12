import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowanceSummary, monthView, savingsDepositedInMonth } from '../js/stats.js';
import { parseBackup, serializeBackup } from '../js/backup.js';
import { defaultSettings } from '../js/categories.js';

test('planned save is allowance minus budget, actual save is allowance minus spent', () => {
  const plan = allowanceSummary({ allowance: 250000, budget: 180000, spent: 80000, deposited: 20000 });
  assert.equal(plan.planned, 70000);
  assert.equal(plan.actual, 170000);
  assert.equal(plan.deposited, 20000);
  const over = allowanceSummary({ allowance: 200000, budget: 250000, spent: 210000, deposited: 0 });
  assert.equal(over.planned, -50000);
  assert.equal(over.actual, -10000);
  assert.equal(allowanceSummary({ allowance: null, budget: 180000, spent: 100, deposited: 0 }).set, false);
});

test('savings deposits are not spending, and only this month counts as 已存', () => {
  const records = [
    { id: 'e', type: 'expense', amount: 180000, categoryId: 'food', date: '2026-11-12' },
    { id: 'i', type: 'income', amount: 250000, categoryId: 'life', date: '2026-11-01' },
  ];
  const view = monthView(records, [], { monthlyBudget: 180000, monthlyAllowance: 250000 }, 2026, 11);
  assert.equal(view.expense, 180000);
  const savings = {
    saved: 52000,
    deposits: [
      { id: 'd1', amount: 20000, at: new Date(2026, 10, 8, 12).getTime() },
      { id: 'd2', amount: 30000, at: new Date(2026, 9, 2, 12).getTime() },
    ],
  };
  assert.equal(savingsDepositedInMonth(savings, 2026, 11), 20000);
  assert.equal(view.expense, 180000);
  const plan = allowanceSummary({
    allowance: 250000,
    budget: 180000,
    spent: view.expense,
    deposited: savingsDepositedInMonth(savings, 2026, 11),
  });
  assert.equal(plan.planned, 70000);
  assert.equal(plan.actual, 70000);
  assert.equal(plan.deposited, 20000);
});

test('old backups without 生活费 stay unset, new ones round-trip', () => {
  const old = parseBackup(JSON.stringify({
    app: '个人账本',
    version: 1,
    categories: [],
    records: [],
    settings: { monthlyBudget: 180000 },
  }));
  assert.equal(old.ok, true);
  assert.equal(old.data.settings.monthlyAllowance, null);
  assert.equal(old.data.settings.monthlyBudget, 180000);
  const settings = { ...defaultSettings(), monthlyBudget: 180000, monthlyAllowance: 250000 };
  const again = parseBackup(serializeBackup({ categories: [], records: [], settings }));
  assert.equal(again.data.settings.monthlyAllowance, 250000);
  assert.equal(again.data.settings.monthlyBudget, 180000);
});
