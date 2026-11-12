import { buildPresetCategories, defaultSettings } from './categories.js';

const APP = '个人账本';

export function serializeBackup({ categories, records, settings }) {
  return JSON.stringify({
    app: APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    records,
    settings: { ...settings, key: 'settings' },
  }, null, 2);
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '这个文件不是可读的备份。' };
  }
  if (!isObj(data) || (data.app !== APP && data.app !== 'ledger') || data.version !== 1) {
    return { ok: false, error: '这不是个人账本的备份文件。' };
  }
  if (!Array.isArray(data.categories) || !Array.isArray(data.records)) {
    return { ok: false, error: '备份内容不完整。' };
  }
  const categories = [];
  for (const c of data.categories) {
    if (!isObj(c) || !c.id || !c.name || (c.type !== 'expense' && c.type !== 'income')) continue;
    categories.push({
      id: String(c.id),
      type: c.type,
      name: String(c.name).slice(0, 12),
      icon: String(c.icon || 'more'),
      color: String(c.color || '#9AA3AF'),
      isFallback: !!c.isFallback,
      order: Number.isFinite(c.order) ? c.order : 0,
    });
  }
  for (const type of ['expense', 'income']) {
    if (!categories.some((c) => c.type === type && c.isFallback)) {
      const preset = buildPresetCategories().find((c) => c.type === type && c.isFallback);
      if (preset && !categories.some((c) => c.type === type && c.name === '其他')) categories.push(preset);
      else if (preset) {
        const hit = categories.find((c) => c.type === type && c.name === '其他');
        if (hit) hit.isFallback = true;
        else categories.push(preset);
      }
    }
  }
  const records = [];
  for (const r of data.records) {
    if (!isObj(r) || !r.id) continue;
    if (r.type !== 'expense' && r.type !== 'income') continue;
    const amount = Math.round(Number(r.amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) continue;
    records.push({
      id: String(r.id),
      type: r.type,
      amount,
      categoryId: String(r.categoryId || ''),
      date: r.date,
      time: String(r.time || '').slice(0, 5),
      note: String(r.note || '').slice(0, 80),
      payMethod: ['wechat', 'alipay', 'cash', 'card', ''].includes(r.payMethod) ? r.payMethod : '',
      source: ['manual', 'wechat', 'alipay'].includes(r.source) ? r.source : 'manual',
      externalId: String(r.externalId || ''),
      counterparty: String(r.counterparty || '').slice(0, 80),
      createdAt: Number(r.createdAt) || Date.now(),
      updatedAt: Number(r.updatedAt) || Date.now(),
    });
  }
  const base = defaultSettings();
  const s = isObj(data.settings) ? data.settings : {};
  const settings = {
    ...base,
    monthlyBudget: s.monthlyBudget == null ? null : Math.round(Number(s.monthlyBudget)) || null,
    categoryBudgets: isObj(s.categoryBudgets) ? s.categoryBudgets : {},
    savings: normalizeSavings(s.savings),
    lastBackupAt: s.lastBackupAt || null,
    lastPayMethod: s.lastPayMethod || '',
    key: 'settings',
  };
  if (settings.monthlyBudget != null && settings.monthlyBudget <= 0) settings.monthlyBudget = null;
  return { ok: true, data: { categories, records, settings } };
}

function normalizeSavings(s) {
  if (!isObj(s) || !s.name || !(Number(s.target) > 0)) return null;
  return {
    name: String(s.name).slice(0, 20),
    target: Math.round(Number(s.target)),
    saved: Math.max(0, Math.round(Number(s.saved) || 0)),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(s.deadline || '') ? s.deadline : '',
    note: String(s.note || '').slice(0, 40),
    deposits: Array.isArray(s.deposits)
      ? s.deposits.slice(0, 50).map((d) => ({
        id: String(d.id || ''),
        amount: Math.round(Number(d.amount) || 0),
        at: Number(d.at) || Date.now(),
      })).filter((d) => d.amount > 0)
      : [],
  };
}
