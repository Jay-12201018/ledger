import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPresetCategories, categoryDeleteChoice, resolveCategoryId,
} from '../js/categories.js';
import { categoryShares, monthView } from '../js/stats.js';

test('presets include 其他 as an ordinary category', () => {
  const cats = buildPresetCategories();
  const expense = cats.filter((c) => c.type === 'expense');
  const income = cats.filter((c) => c.type === 'income');
  assert.deepEqual(expense.map((c) => c.name), ['餐饮', '交通', '学习', '娱乐', '日用', '其他']);
  assert.ok(income.some((c) => c.name === '其他'));
  assert.equal(cats.some((c) => c.isFallback), false);
});

test('unknown import labels use the first category, known names keep their match', () => {
  const categories = [
    { id: 'food', type: 'expense', name: '餐饮', order: 0 },
    { id: 'other', type: 'expense', name: '其他', order: 5 },
    { id: 'life', type: 'income', name: '生活费', order: 0 },
  ];
  assert.equal(resolveCategoryId('餐饮', 'expense', categories), 'food');
  assert.equal(resolveCategoryId('其他', 'expense', categories), 'other');
  assert.equal(resolveCategoryId('医疗', 'expense', categories), 'food');
  assert.equal(resolveCategoryId('没有这个', 'income', categories), 'life');
  assert.equal(resolveCategoryId('餐饮', 'income', []), '');
});

test('delete asks for a destination when records exist, and blocks the last category', () => {
  const categories = [
    { id: 'a', type: 'expense', name: '餐饮', order: 0 },
    { id: 'b', type: 'expense', name: '🧃', order: 1 },
  ];
  const move = categoryDeleteChoice(categories[1], categories, 3);
  assert.equal(move.action, 'move');
  assert.deepEqual(move.others.map((c) => c.id), ['a']);
  assert.equal(categoryDeleteChoice(categories[0], [categories[0]], 2).action, 'blocked');
  assert.equal(categoryDeleteChoice(categories[0], [categories[0]], 0).action, 'delete');
});

test('a missing category shows as 未分类 and does not break the month view', () => {
  const records = [{ id: 'r', type: 'expense', categoryId: 'gone', amount: 500, date: '2026-11-12' }];
  const share = categoryShares(records, []);
  assert.equal(share.rows[0].name, '未分类');
  const view = monthView(records, [], { monthlyBudget: 1000, categoryBudgets: { gone: 100 } }, 2026, 11);
  assert.equal(view.expense, 500);
  assert.equal(view.catBudgets.length, 0);
});
