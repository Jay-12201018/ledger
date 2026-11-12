import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup, serializeBackup } from '../js/backup.js';
import { buildPresetCategories, defaultSettings } from '../js/categories.js';

test('backup roundtrip keeps records and cents', () => {
  const categories = buildPresetCategories();
  const records = [{
    id: 'r1', type: 'expense', amount: 1600, categoryId: categories[0].id,
    date: '2026-11-12', time: '12:30', note: '食堂', payMethod: 'wechat',
    source: 'manual', externalId: '', counterparty: '', createdAt: 1, updatedAt: 1,
  }];
  const settings = { ...defaultSettings(), monthlyBudget: 200000 };
  const text = serializeBackup({ categories, records, settings });
  const parsed = parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.records[0].amount, 1600);
  assert.equal(parsed.data.settings.monthlyBudget, 200000);
  assert.equal(parsed.data.categories.length, categories.length);
});

test('rejects files that are not a ledger backup', () => {
  assert.equal(parseBackup('not json').ok, false);
  assert.equal(parseBackup('{"app":"other","version":1}').ok, false);
  assert.equal(parseBackup('{"app":"个人账本","version":2,"categories":[],"records":[]}').ok, false);
});

test('drops broken rows and keeps a fallback category', () => {
  const parsed = parseBackup(JSON.stringify({
    app: '个人账本',
    version: 1,
    categories: [{ id: 'c1', type: 'expense', name: '餐饮', icon: 'utensils', color: '#FF8A34', order: 0 }],
    records: [
      { id: 'ok', type: 'expense', amount: 100, categoryId: 'c1', date: '2026-11-01' },
      { id: 'bad', type: 'expense', amount: 0, categoryId: 'c1', date: '2026-11-01' },
      { id: 'nodate', type: 'income', amount: 100, categoryId: 'c1', date: '' },
    ],
    settings: {},
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.records.length, 1);
  assert.ok(parsed.data.categories.some((c) => c.type === 'expense' && c.isFallback));
  assert.ok(parsed.data.categories.some((c) => c.type === 'income' && c.isFallback));
});
