import { isoDate, monthBounds, parseISO } from './dates.js';

export function inRange(records, startISO, endISO) {
  return records.filter((r) => r.date >= startISO && r.date <= endISO);
}

export function sumType(records, type) {
  let n = 0;
  for (const r of records) if (r.type === type) n += r.amount || 0;
  return n;
}

export function levelOf(ratio) {
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]}和${names[1]}`;
  return `${names.slice(0, -1).join('、')}和${names[names.length - 1]}`;
}

export function dailyExpense(records, y, m, today = new Date()) {
  const b = monthBounds(y, m);
  const isCurrent = today.getFullYear() === y && today.getMonth() + 1 === m;
  const last = isCurrent ? Math.min(today.getDate(), b.days) : b.days;
  const buckets = new Array(Math.max(last, 0)).fill(0);
  const endISO = isCurrent ? isoDate(new Date(y, m - 1, last)) : b.endISO;
  for (const r of records) {
    if (r.type !== 'expense') continue;
    if (r.date < b.startISO || r.date > endISO) continue;
    const day = Number(r.date.slice(8, 10));
    if (day >= 1 && day <= last) buckets[day - 1] += r.amount || 0;
  }
  return { buckets, startISO: b.startISO, endLabelISO: endISO, isCurrent };
}

export function savingsDepositedInMonth(savings, y, m) {
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  let total = 0;
  for (const d of savings?.deposits || []) {
    if (d.at >= start && d.at < end) total += d.amount || 0;
  }
  return total;
}

/** How much of the monthly allowance can be saved. Deposits are not spending. */
export function allowanceSummary({ allowance, budget, spent, deposited }) {
  const allowanceSet = allowance > 0;
  const budgetSet = budget > 0;
  if (!allowanceSet) {
    return { set: false, deposited: deposited || 0, spent: spent || 0, budgetSet };
  }
  return {
    set: true,
    allowance,
    budget: budgetSet ? budget : 0,
    budgetSet,
    planned: budgetSet ? allowance - budget : null,
    actual: allowance - (spent || 0),
    deposited: deposited || 0,
    spent: spent || 0,
  };
}

export function monthView(records, categories, settings, y, m) {
  const b = monthBounds(y, m);
  const list = inRange(records, b.startISO, b.endISO);
  const expense = sumType(list, 'expense');
  const income = sumType(list, 'income');
  const budget = settings?.monthlyBudget || 0;
  const ratio = budget > 0 ? expense / budget : 0;
  const byCat = {};
  for (const r of list) {
    if (r.type !== 'expense') continue;
    byCat[r.categoryId] = (byCat[r.categoryId] || 0) + r.amount;
  }
  const catBudgets = [];
  const expenseCats = categories
    .filter((c) => c.type === 'expense')
    .slice()
    .sort((a, c) => a.order - c.order);
  for (const c of expenseCats) {
    const limit = settings?.categoryBudgets?.[c.id] || 0;
    if (!limit) continue;
    const spent = byCat[c.id] || 0;
    catBudgets.push({
      ...c,
      spent,
      limit,
      ratio: spent / limit,
      level: levelOf(spent / limit),
    });
  }
  const overNames = catBudgets.filter((c) => c.level === 'over').map((c) => c.name);
  let banner = '';
  if (budget > 0 && ratio >= 0.8) {
    const pct = Math.round(ratio * 100);
    const remain = budget - expense;
    banner = `本月预算已用 ${pct}%`;
    banner += remain >= 0 ? `，还剩 ${yuan(remain)}` : `，已超支 ${yuan(-remain)}`;
    if (overNames.length) banner += `。${joinNames(overNames)}已超支`;
    banner += '，记一笔前可以先看一眼。';
  }
  return {
    list,
    expense,
    income,
    balance: income - expense,
    budget,
    remain: budget ? budget - expense : null,
    ratio,
    level: budget ? levelOf(ratio) : '',
    byCat,
    catBudgets,
    overNames,
    banner,
    bannerLevel: ratio > 1 ? 'over' : 'warn',
    count: list.length,
  };
}

function yuan(cents) {
  const n = Math.abs(Math.round(cents));
  const y = Math.floor(n / 100);
  const d = String(n % 100).padStart(2, '0');
  const withComma = String(y).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `¥${withComma}.${d}`;
}

export function categoryShares(records, categories) {
  const totals = new Map();
  for (const r of records) {
    if (r.type !== 'expense') continue;
    totals.set(r.categoryId, (totals.get(r.categoryId) || 0) + r.amount);
  }
  const rows = [];
  for (const [id, amount] of totals) {
    if (!amount) continue;
    const cat = categories.find((c) => c.id === id);
    rows.push({
      id,
      name: cat?.name || '未分类',
      color: cat?.color || '#9AA3AF',
      icon: cat?.icon || 'more',
      amount,
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pcts = percents(rows.map((r) => r.amount), total);
  rows.forEach((r, i) => {
    r.pct = pcts[i];
  });
  return { rows, total };
}

function percents(amounts, total) {
  if (!total) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a / total) * 100);
  const floors = raw.map((x) => Math.floor(x));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => b.f - a.f);
  for (let k = 0; k < left; k += 1) floors[order[k].i] += 1;
  return floors;
}

export function groupByDay(records) {
  const map = new Map();
  const sorted = records.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ta = a.time || '';
    const tb = b.time || '';
    if (ta !== tb) return ta < tb ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  for (const r of sorted) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date).push(r);
  }
  return [...map.entries()];
}

export function dayTotals(list) {
  return {
    expense: sumType(list, 'expense'),
    income: sumType(list, 'income'),
  };
}

export function todayISO(now = new Date()) {
  return isoDate(now);
}

export function recordTimeOK(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '');
}

export { parseISO };
