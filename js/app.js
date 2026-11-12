import { renderApp } from './views.js';
import * as db from './db.js';
import {
  buildPresetCategories, categoryDeleteChoice, defaultSettings, newId, resolveCategoryId,
} from './categories.js';
import { commitCents, displayText, emptyKeypad, expressionText, keypadFromCents, pressKey } from './keypad.js';
import { isoDate, shiftAnchor } from './dates.js';
import { allowanceSummary, monthView, savingsDepositedInMonth } from './stats.js';
import { parseYuanField, centsToYuanInput, formatYuan } from './money.js';
import { parseBillBuffer } from './import-parse.js';
import { parseBackup, serializeBackup } from './backup.js';

const state = {
  ready: false,
  error: '',
  tab: 'ledger',
  sub: null,
  month: currentMonth(),
  reportMode: 'month',
  anchor: isoDate(new Date()),
  catTab: 'expense',
  categories: [],
  records: [],
  settings: defaultSettings(),
  sheet: null,
  dialog: null,
  toast: '',
  busy: '',
  importSource: 'wechat',
  entryHold: null,
};

let toastTimer = 0;
let drag = null;
let saving = false;
let sheetWasOpen = false;
let keypadPointer = null;
let keypadPointerAt = 0;

function currentMonth(d = new Date()) {
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function render(opts = {}) {
  const keep = !!opts.keepScroll;
  const y = keep ? (document.scrollingElement?.scrollTop || 0) : 0;
  const open = !!state.sheet;
  state.sheetEnter = open && !sheetWasOpen;
  sheetWasOpen = open;
  const root = document.getElementById('root');
  root.innerHTML = renderApp(state);
  document.body.classList.toggle('noscroll', !!(state.sheet || state.dialog || state.busy));
  if (document.scrollingElement) document.scrollingElement.scrollTop = keep ? y : 0;
}

function paintEntryAmount() {
  const sheet = state.sheet;
  if (!sheet || sheet.type !== 'entry') return;
  const expr = document.querySelector('.sheet.entry .expr');
  const num = document.querySelector('.sheet.entry .amount .num');
  if (expr) expr.textContent = expressionText(sheet.keypad) || '\u00a0';
  if (num) num.textContent = displayText(sheet.keypad);
}

function applyKeypadKey(el) {
  if (!state.sheet || state.sheet.type !== 'entry') return;
  const act = el.dataset.act;
  if (act === 'key') {
    state.sheet.keypad = pressKey(state.sheet.keypad, el.dataset.key);
    touchSheet();
    paintEntryAmount();
    return;
  }
  if (act === 'done') handle('done', el).catch(() => toast('没能完成，请再试一次'));
}

function toast(msg) {
  state.toast = msg;
  render({ keepScroll: true });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = '';
    render({ keepScroll: true });
  }, 2200);
}

function hist() {
  return {
    tab: state.tab,
    sub: state.sub?.name || null,
    categoryId: state.sub?.categoryId || null,
    anchor: state.anchor,
    reportMode: state.reportMode,
    month: state.month,
  };
}

function remember() {
  history.replaceState(hist(), '');
}

function pushSub(sub) {
  state.sub = sub;
  history.pushState(hist(), '');
  render();
}

function applyHist(s) {
  if (!s) return;
  state.tab = s.tab || 'ledger';
  state.anchor = s.anchor || state.anchor;
  state.reportMode = s.reportMode || 'month';
  if (s.month) state.month = s.month;
  if (s.sub === 'categories') state.sub = { name: 'categories' };
  else if (s.sub === 'import') state.sub = { name: 'import' };
  else if (s.sub === 'preview') {
    if (!state.sub || state.sub.name !== 'preview') state.sub = { name: 'import' };
  } else if (s.sub === 'catDetail' && s.categoryId) state.sub = { name: 'catDetail', categoryId: s.categoryId };
  else state.sub = null;
}

function upsert(rec) {
  const i = state.records.findIndex((r) => r.id === rec.id);
  if (i >= 0) state.records[i] = rec;
  else state.records.push(rec);
}

function touchSheet() {
  if (state.sheet) state.sheet.touched = true;
}

function forceCloseSheet() {
  if (state.sheet?.type === 'backup' && state.sheet.href) URL.revokeObjectURL(state.sheet.href);
  const hold = state.entryHold;
  state.entryHold = null;
  state.sheet = hold || null;
}

function tryCloseSheet() {
  const s = state.sheet;
  if (!s) return;
  if (s.touched && (s.type === 'entry' || s.type === 'categoryForm' || s.type === 'budget' || s.type === 'savings' || s.type === 'deposit')) {
    state.dialog = {
      title: '放弃这次编辑？',
      message: '还没保存的内容会丢掉。',
      confirmText: '放弃',
      danger: true,
      action: 'discard-sheet',
    };
    render({ keepScroll: true });
    return;
  }
  forceCloseSheet();
  render({ keepScroll: true });
}

function firstCat(type) {
  return state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order)[0];
}

function openEntry(rec) {
  if (rec) {
    state.sheet = {
      type: 'entry',
      mode: 'edit',
      id: rec.id,
      direction: rec.type,
      categoryId: rec.categoryId,
      date: rec.date,
      note: rec.note || '',
      payMethod: rec.payMethod || '',
      payOpen: false,
      keypad: keypadFromCents(rec.amount),
      source: rec.source || 'manual',
      externalId: rec.externalId || '',
      counterparty: rec.counterparty || '',
      time: rec.time || '',
      createdAt: rec.createdAt,
      touched: false,
    };
  } else {
    const direction = 'expense';
    const cat = firstCat(direction);
    state.sheet = {
      type: 'entry',
      mode: 'create',
      id: null,
      direction,
      categoryId: cat?.id || '',
      date: isoDate(new Date()),
      note: '',
      payMethod: state.settings.lastPayMethod || '',
      payOpen: false,
      keypad: emptyKeypad(),
      source: 'manual',
      externalId: '',
      counterparty: '',
      time: '',
      createdAt: null,
      touched: false,
    };
  }
  render({ keepScroll: true });
}

async function saveEntry() {
  const s = state.sheet;
  if (!s || s.type !== 'entry' || saving) return;
  const cents = commitCents(s.keypad);
  if (!cents) {
    toast(evaluateNegative(s.keypad) ? '算出来要大于 0' : '请输入大于 0 的金额');
    return;
  }
  if (!s.categoryId) {
    toast('选一个分类');
    return;
  }
  saving = true;
  const now = new Date();
  const rec = {
    id: s.id || newId(),
    type: s.direction,
    amount: cents,
    categoryId: s.categoryId,
    date: s.date || isoDate(now),
    time: s.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    note: (s.note || '').trim().slice(0, 80),
    payMethod: s.payMethod || '',
    source: s.source || 'manual',
    externalId: s.externalId || '',
    counterparty: s.counterparty || '',
    createdAt: s.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  try {
    await db.putRecord(rec);
    upsert(rec);
    state.settings.lastPayMethod = rec.payMethod;
    await db.putSettings(state.settings);
    const created = s.mode === 'create';
    state.sheet = null;
    if (created) {
      const [y, m] = rec.date.split('-').map(Number);
      state.month = { y, m };
      state.tab = 'ledger';
      state.sub = null;
      remember();
    }
    toast(created ? '已记下' : '已保存');
  } finally {
    saving = false;
  }
}

function evaluateNegative(k) {
  const cur = k.current;
  if (k.acc == null || !k.op || !cur) return false;
  const n = Number(cur);
  if (!Number.isFinite(n)) return false;
  const v = k.op === '+' ? k.acc / 100 + n : k.acc / 100 - n;
  return v <= 0;
}

async function removeRecord(id) {
  await db.deleteRecord(id);
  state.records = state.records.filter((r) => r.id !== id);
  state.sheet = null;
  state.dialog = null;
  toast('已删除');
}

function openBudget() {
  const cats = {};
  for (const c of state.categories) {
    if (c.type !== 'expense') continue;
    const v = state.settings.categoryBudgets?.[c.id];
    cats[c.id] = v ? centsToYuanInput(v) : '';
  }
  state.sheet = {
    type: 'budget',
    allowance: state.settings.monthlyAllowance ? centsToYuanInput(state.settings.monthlyAllowance) : '',
    total: state.settings.monthlyBudget ? centsToYuanInput(state.settings.monthlyBudget) : '',
    cats,
    touched: false,
  };
  render({ keepScroll: true });
}

async function saveBudget() {
  const s = state.sheet;
  const allowance = parseYuanField(s.allowance);
  if (allowance === undefined) {
    toast('生活费请填数字，比如 2500');
    return;
  }
  const total = parseYuanField(s.total);
  if (total === undefined) {
    toast('总预算请填数字，比如 1800');
    return;
  }
  const categoryBudgets = {};
  for (const [id, raw] of Object.entries(s.cats || {})) {
    const v = parseYuanField(raw);
    if (v === undefined) {
      toast('分类预算里有填错的金额');
      return;
    }
    if (v) categoryBudgets[id] = v;
  }
  state.settings.monthlyAllowance = allowance > 0 ? allowance : null;
  state.settings.monthlyBudget = total > 0 ? total : null;
  state.settings.categoryBudgets = categoryBudgets;
  await db.putSettings(state.settings);
  state.sheet = null;
  state.tab = 'budget';
  toast('预算已保存');
}

function openSavings() {
  const s = state.settings.savings;
  state.sheet = {
    type: 'savings',
    name: s?.name || '',
    target: s ? centsToYuanInput(s.target) : '',
    saved: s ? centsToYuanInput(s.saved) : '',
    deadline: s?.deadline || '',
    note: s?.note || '',
    existed: !!s,
    touched: false,
  };
  render({ keepScroll: true });
}

async function saveSavings() {
  const s = state.sheet;
  const name = (s.name || '').trim().slice(0, 20);
  const target = parseYuanField(s.target);
  const saved = parseYuanField(s.saved || '0');
  if (!name) {
    toast('先给目标起个名字');
    return;
  }
  if (!target) {
    toast('目标金额要大于 0');
    return;
  }
  if (saved === undefined || saved == null) {
    toast('已存金额填数字，或留空');
    return;
  }
  const prev = state.settings.savings;
  state.settings.savings = {
    name,
    target,
    saved: saved || 0,
    deadline: s.deadline || '',
    note: (s.note || '').trim().slice(0, 40),
    deposits: prev?.deposits || [],
  };
  await db.putSettings(state.settings);
  state.sheet = null;
  toast('存钱目标已保存');
}

async function saveDeposit(force) {
  const amount = parseYuanField(state.sheet?.amount);
  if (!amount) {
    toast('请输入要存入的金额');
    return;
  }
  const goal = state.settings.savings;
  if (!goal) return;
  const room = state.sheet.room;
  if (!force && room != null && amount > room) {
    state.dialog = {
      title: '这个月可能存多了',
      message: `这次想存 ${formatYuan(amount)}，本月还能存 ${formatYuan(room)}。可以存，只是比还能存的多一点。`,
      confirmText: '仍然存入',
      danger: false,
      action: 'deposit-over',
    };
    render({ keepScroll: true });
    return;
  }
  goal.saved += amount;
  goal.deposits = [{ id: newId(), amount, at: Date.now() }, ...(goal.deposits || [])].slice(0, 50);
  await db.putSettings(state.settings);
  state.dialog = null;
  state.sheet = null;
  toast(`已存入 ${centsToYuanInput(amount)} 元`);
}

async function saveCategory() {
  const s = state.sheet;
  const name = (s.name || '').trim().slice(0, 12);
  if (!name) {
    toast('先写个名字');
    return;
  }
  if (state.categories.some((c) => c.type === s.catType && c.name === name && c.id !== s.id)) {
    toast('已经有这个分类了');
    return;
  }
  let cat;
  if (s.mode === 'edit') {
    cat = state.categories.find((c) => c.id === s.id);
    if (!cat) return;
    cat.name = name;
    cat.color = s.color;
    cat.icon = s.icon;
    delete cat.isFallback;
    await db.putCategory(cat);
  } else {
    const order = state.categories.filter((c) => c.type === s.catType).length;
    cat = {
      id: newId(), type: s.catType, name, color: s.color, icon: s.icon, order,
    };
    state.categories.push(cat);
    await db.putCategory(cat);
  }
  const hold = state.entryHold;
  state.sheet = null;
  state.entryHold = null;
  if (hold) {
    hold.categoryId = cat.id;
    hold.direction = cat.type;
    hold.touched = true;
    state.sheet = hold;
  }
  toast('分类已保存');
}

function confirmDeleteCat(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  const n = state.records.filter((r) => r.categoryId === id).length;
  const choice = categoryDeleteChoice(cat, state.categories, n);
  const kind = cat.type === 'income' ? '收入' : '支出';
  if (choice.action === 'blocked') {
    state.dialog = {
      title: `先留着「${cat.name}」`,
      message: `这是最后一个${kind}分类，下面还有 ${n} 笔账单。先新增一个分类，才能把这些账单挪走再删除。`,
      confirmText: '知道了',
      danger: false,
      action: 'noop',
    };
    render({ keepScroll: true });
    return;
  }
  if (choice.action === 'move') {
    state.sheet = {
      type: 'moveCat',
      id: cat.id,
      name: cat.name,
      catType: cat.type,
      count: n,
      targetId: choice.others[0].id,
    };
    render({ keepScroll: true });
    return;
  }
  state.dialog = {
    title: `删除「${cat.name}」？`,
    message: '分类删掉后不能恢复。',
    confirmText: '删除',
    danger: true,
    action: 'delete-cat',
    payload: { id },
  };
  render({ keepScroll: true });
}

async function deleteCat(id, targetId) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  const moved = state.records.filter((r) => r.categoryId === id);
  let target = null;
  if (moved.length) {
    target = state.categories.find((c) => c.id === targetId && c.type === cat.type && c.id !== id);
    if (!target) {
      toast(categoryDeleteChoice(cat, state.categories, moved.length).action === 'blocked'
        ? '这是最后一个分类，先新增一个再删除'
        : '请选一个分类来接收这些账单');
      return;
    }
    const now = Date.now();
    for (const r of moved) {
      r.categoryId = target.id;
      r.updatedAt = now;
    }
    await db.bulkPutRecords(moved);
  }
  await db.deleteCategory(id);
  state.categories = state.categories.filter((c) => c.id !== id);
  if (state.settings.categoryBudgets?.[id]) {
    delete state.settings.categoryBudgets[id];
    await db.putSettings(state.settings);
  }
  state.dialog = null;
  state.sheet = null;
  toast(target ? `已删除，${moved.length} 笔改记到「${target.name}」` : '分类已删除');
}

async function reorderCategories(from, to) {
  const type = state.catTab;
  const list = state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  list.forEach((c, i) => { c.order = i; });
  await db.bulkPutCategories(list);
  render({ keepScroll: true });
}

async function runImport(file) {
  state.busy = '正在解析账单…';
  render({ keepScroll: true });
  await new Promise((r) => setTimeout(r, 40));
  try {
    const buf = await file.arrayBuffer();
    const { rows, error } = await parseBillBuffer(buf, state.importSource || 'wechat', file.name, state.records);
    state.busy = '';
    if (error) {
      toast(error);
      return;
    }
    const withCats = rows.map((row) => ({
      ...row,
      categoryId: resolveCategoryId(
        row.categoryName,
        row.type === 'income' ? 'income' : 'expense',
        state.categories,
      ),
    }));
    pushSub({
      name: 'preview',
      source: state.importSource,
      fileName: file.name,
      rows: withCats,
    });
  } catch (e) {
    state.busy = '';
    toast('解析失败，请换一个文件试试');
  }
}

async function confirmImport() {
  const sub = state.sub;
  if (!sub || sub.name !== 'preview' || saving) return;
  const chosen = sub.rows.filter((r) => r.checked && r.cents > 0);
  if (!chosen.length) return;
  const loose = chosen.filter((r) => {
    const kind = r.type === 'income' ? 'income' : 'expense';
    return !state.categories.some((c) => c.id === r.categoryId && c.type === kind);
  });
  if (loose.length) {
    toast(`有 ${loose.length} 笔还没有分类。先新增一个分类，或在预览里选好再导入。`);
    return;
  }
  saving = true;
  const now = Date.now();
  const recs = chosen.map((r) => ({
    id: newId(),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: r.cents,
    categoryId: r.categoryId || resolveCategoryId('其他', r.type === 'income' ? 'income' : 'expense', state.categories),
    date: r.date,
    time: (r.time || '').slice(0, 5),
    note: (r.product || r.remark || '').slice(0, 80),
    payMethod: r.payMethod || '',
    source: sub.source === 'alipay' ? 'alipay' : 'wechat',
    externalId: r.txId || '',
    counterparty: (r.counterparty || '').slice(0, 80),
    createdAt: now,
    updatedAt: now,
  }));
  try {
    await db.bulkPutRecords(recs);
    state.records.push(...recs);
    const newest = recs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (newest) {
      const [y, m] = newest.date.split('-').map(Number);
      state.month = { y, m };
    }
    state.tab = 'ledger';
    state.sub = null;
    remember();
    toast(`已导入 ${recs.length} 笔`);
  } finally {
    saving = false;
  }
}

async function exportBackup() {
  const json = serializeBackup({
    categories: state.categories,
    records: state.records,
    settings: state.settings,
  });
  const filename = `个人账本备份-${isoDate(new Date())}.json`;
  const file = new File([json], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '个人账本备份' });
      state.settings.lastBackupAt = Date.now();
      await db.putSettings(state.settings);
      toast('备份已导出');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const href = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  state.settings.lastBackupAt = Date.now();
  await db.putSettings(state.settings);
  state.sheet = { type: 'backup', href, filename };
  render({ keepScroll: true });
}

async function restoreBackup(data) {
  await db.replaceAll(data);
  state.categories = data.categories;
  state.records = data.records;
  state.settings = data.settings;
  state.dialog = null;
  state.tab = 'ledger';
  state.sub = null;
  state.month = currentMonth();
  remember();
  toast('已从备份恢复');
}

async function onDialogOk() {
  const d = state.dialog;
  if (!d) return;
  if (d.action === 'discard-sheet') {
    state.dialog = null;
    forceCloseSheet();
    render({ keepScroll: true });
    return;
  }
  if (d.action === 'delete-record') {
    await removeRecord(d.payload.id);
    return;
  }
  if (d.action === 'noop') {
    state.dialog = null;
    render({ keepScroll: true });
    return;
  }
  if (d.action === 'delete-cat') {
    await deleteCat(d.payload.id, d.payload.targetId);
    return;
  }
  if (d.action === 'deposit-over') {
    state.dialog = null;
    await saveDeposit(true);
    return;
  }
  if (d.action === 'delete-savings') {
    state.settings.savings = null;
    await db.putSettings(state.settings);
    state.sheet = null;
    state.dialog = null;
    toast('已删除存钱目标');
    return;
  }
  if (d.action === 'restore') {
    await restoreBackup(state.pendingBackup);
    state.pendingBackup = null;
  }
}

async function handle(act, el) {
  if (act === 'tab') {
    state.tab = el.dataset.tab;
    state.sub = null;
    state.sheet = null;
    remember();
    render();
    return;
  }
  if (act === 'add') {
    openEntry();
    return;
  }
  if (act === 'back') {
    history.back();
    return;
  }
  if (act === 'sheet-close' || act === 'backup-close') {
    tryCloseSheet();
    return;
  }
  if (act === 'dialog-cancel') {
    state.dialog = null;
    render({ keepScroll: true });
    return;
  }
  if (act === 'dialog-ok') {
    await onDialogOk();
    return;
  }
  if (act === 'open-record') {
    const rec = state.records.find((r) => r.id === el.dataset.id);
    if (rec) openEntry(rec);
    return;
  }
  if (act === 'dir') {
    const s = state.sheet;
    s.direction = el.dataset.dir;
    const cat = firstCat(s.direction);
    s.categoryId = cat?.id || '';
    touchSheet();
    render({ keepScroll: true });
    return;
  }
  if (act === 'pick-cat') {
    state.sheet.categoryId = el.dataset.id;
    touchSheet();
    render({ keepScroll: true });
    return;
  }
  if (act === 'key') {
    state.sheet.keypad = pressKey(state.sheet.keypad, el.dataset.key);
    touchSheet();
    paintEntryAmount();
    return;
  }
  if (act === 'done') {
    await saveEntry();
    return;
  }
  if (act === 'pay-toggle') {
    state.sheet.payOpen = !state.sheet.payOpen;
    render({ keepScroll: true });
    return;
  }
  if (act === 'pay') {
    state.sheet.payMethod = el.dataset.pay || '';
    state.sheet.payOpen = false;
    touchSheet();
    render({ keepScroll: true });
    return;
  }
  if (act === 'ask-delete') {
    state.dialog = {
      title: '删除这笔账单？',
      message: '删除后不能恢复。',
      confirmText: '删除',
      danger: true,
      action: 'delete-record',
      payload: { id: state.sheet.id },
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'new-cat') {
    state.entryHold = state.sheet;
    state.sheet = {
      type: 'categoryForm',
      mode: 'create',
      id: null,
      catType: state.entryHold.direction,
      name: '',
      color: PALETTE_FIRST(state.entryHold.direction),
      icon: state.entryHold.direction === 'income' ? 'wallet' : 'utensils',
      touched: false,
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'month-open') {
    state.sheet = { type: 'month', year: state.month.y };
    render({ keepScroll: true });
    return;
  }
  if (act === 'month-year') {
    state.sheet.year += Number(el.dataset.dir);
    render({ keepScroll: true });
    return;
  }
  if (act === 'month-pick') {
    state.month = { y: state.sheet.year, m: Number(el.dataset.m) };
    state.sheet = null;
    remember();
    render();
    return;
  }
  if (act === 'jump-today') {
    state.month = currentMonth();
    remember();
    render();
    return;
  }
  if (act === 'go-budget') {
    state.tab = 'budget';
    state.sub = null;
    remember();
    render();
    return;
  }
  if (act === 'report-mode') {
    state.reportMode = el.dataset.mode;
    remember();
    render();
    return;
  }
  if (act === 'period') {
    state.anchor = shiftAnchor(state.reportMode, state.anchor, Number(el.dataset.dir));
    remember();
    render();
    return;
  }
  if (act === 'report-today') {
    state.anchor = isoDate(new Date());
    remember();
    render();
    return;
  }
  if (act === 'open-cat') {
    pushSub({ name: 'catDetail', categoryId: el.dataset.id });
    return;
  }
  if (act === 'edit-budget') {
    openBudget();
    return;
  }
  if (act === 'save-budget') {
    await saveBudget();
    return;
  }
  if (act === 'edit-savings') {
    openSavings();
    return;
  }
  if (act === 'save-savings') {
    await saveSavings();
    return;
  }
  if (act === 'ask-delete-savings') {
    state.dialog = {
      title: '删除存钱目标？',
      message: '已存金额和存入记录会一起清掉，账单不受影响。',
      confirmText: '删除',
      danger: true,
      action: 'delete-savings',
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'deposit') {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const spent = monthView(state.records, state.categories, state.settings, y, m).expense;
    const allowance = state.settings.monthlyAllowance;
    const plan = allowanceSummary({
      allowance,
      budget: state.settings.monthlyBudget,
      spent,
      deposited: savingsDepositedInMonth(state.settings.savings, y, m),
    });
    state.sheet = {
      type: 'deposit',
      amount: '',
      touched: false,
      room: plan.set ? plan.remaining : null,
      savedMonth: plan.deposited,
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'save-deposit') {
    await saveDeposit();
    return;
  }
  if (act === 'go-categories') {
    pushSub({ name: 'categories' });
    return;
  }
  if (act === 'go-import') {
    pushSub({ name: 'import' });
    return;
  }
  if (act === 'pick-source') {
    state.importSource = el.dataset.source;
    document.getElementById('import-file').click();
    return;
  }
  if (act === 'imp-toggle') {
    const row = state.sub.rows[Number(el.dataset.i)];
    if (row) row.checked = !row.checked;
    render({ keepScroll: true });
    return;
  }
  if (act === 'imp-import') {
    await confirmImport();
    return;
  }
  if (act === 'cat-tab') {
    state.catTab = el.dataset.type;
    render({ keepScroll: true });
    return;
  }
  if (act === 'cat-add') {
    state.sheet = {
      type: 'categoryForm',
      mode: 'create',
      id: null,
      catType: state.catTab,
      name: '',
      color: PALETTE_FIRST(state.catTab),
      icon: state.catTab === 'income' ? 'wallet' : 'utensils',
      touched: false,
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'cat-edit') {
    const cat = state.categories.find((c) => c.id === el.dataset.id);
    if (!cat) return;
    state.sheet = {
      type: 'categoryForm',
      mode: 'edit',
      id: cat.id,
      catType: cat.type,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      touched: false,
    };
    render({ keepScroll: true });
    return;
  }
  if (act === 'cat-delete') {
    confirmDeleteCat(el.dataset.id);
    return;
  }
  if (act === 'move-target') {
    if (state.sheet?.type === 'moveCat') {
      state.sheet.targetId = el.dataset.id;
      render({ keepScroll: true });
    }
    return;
  }
  if (act === 'confirm-move-cat') {
    if (state.sheet?.type === 'moveCat') await deleteCat(state.sheet.id, state.sheet.targetId);
    return;
  }
  if (act === 'cat-color') {
    state.sheet.color = el.dataset.color;
    touchSheet();
    render({ keepScroll: true });
    return;
  }
  if (act === 'cat-icon') {
    state.sheet.icon = el.dataset.icon;
    touchSheet();
    render({ keepScroll: true });
    return;
  }
  if (act === 'save-cat') {
    await saveCategory();
    return;
  }
  if (act === 'export') {
    await exportBackup();
    return;
  }
  if (act === 'restore') {
    document.getElementById('restore-file').click();
  }
}

function PALETTE_FIRST(type) {
  return type === 'income' ? '#4C8DFF' : '#FF8A34';
}

function onField(e) {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.catBudget != null && state.sheet?.cats) {
    state.sheet.cats[t.dataset.catBudget] = t.value;
    touchSheet();
    return;
  }
  if (!t.dataset.field || !state.sheet) return;
  state.sheet[t.dataset.field] = t.value;
  touchSheet();
  if (t.dataset.field === 'date' || t.type === 'date') render({ keepScroll: true });
}

function bindDrag() {
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-drag]');
    if (!h) return;
    const row = h.closest('[data-cat-row]');
    const list = row?.parentElement;
    if (!row || !list) return;
    const rows = [...list.querySelectorAll('[data-cat-row]')];
    const index = rows.indexOf(row);
    const hgt = rows.length > 1
      ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top
      : row.getBoundingClientRect().height + 8;
    drag = { index, y: e.clientY, rows, h: hgt || 64, to: index, moved: false };
    h.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    let to = drag.index + Math.round(dy / drag.h);
    to = Math.max(0, Math.min(drag.rows.length - 1, to));
    drag.to = to;
    drag.rows.forEach((row, i) => {
      let y = 0;
      if (i === drag.index) y = dy;
      else if (to > drag.index && i > drag.index && i <= to) y = -drag.h;
      else if (to < drag.index && i < drag.index && i >= to) y = drag.h;
      row.style.transform = `translateY(${y}px)`;
      row.style.zIndex = i === drag.index ? '3' : '1';
    });
  });
  const endDrag = async () => {
    if (!drag) return;
    const { index, to, moved, rows } = drag;
    rows.forEach((row) => {
      row.style.transform = '';
      row.style.zIndex = '';
    });
    drag = null;
    if (moved && index !== to) await reorderCategories(index, to);
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  document.addEventListener('touchmove', (e) => {
    if (drag) e.preventDefault();
  }, { passive: false });
}

function bindSwipe() {
  let start = null;
  document.addEventListener('touchstart', (e) => {
    if (state.tab !== 'report' || state.sub || state.sheet) {
      start = null;
      return;
    }
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    state.anchor = shiftAnchor(state.reportMode, state.anchor, dx < 0 ? 1 : -1);
    remember();
    render();
  }, { passive: true });
}

async function boot() {
  try {
    const loaded = await db.loadAll();
    state.records = loaded.records || [];
    state.categories = loaded.categories || [];
    if (!state.categories.length) {
      state.categories = buildPresetCategories();
      await db.bulkPutCategories(state.categories);
    }
    state.settings = loaded.settings ? { ...defaultSettings(), ...loaded.settings, key: 'settings' } : defaultSettings();
    state.settings.categoryBudgets = state.settings.categoryBudgets || {};
    state.settings.monthlyAllowance = state.settings.monthlyAllowance > 0
      ? Math.round(state.settings.monthlyAllowance)
      : null;
    if (!loaded.settings) await db.putSettings(state.settings);
    const stripped = state.categories.filter((c) => Object.prototype.hasOwnProperty.call(c, 'isFallback'));
    for (const c of stripped) delete c.isFallback;
    if (stripped.length) await db.bulkPutCategories(stripped);
    state.ready = true;
  } catch (e) {
    state.ready = true;
    state.error = '浏览器没有允许本地保存。请关掉无痕模式后再打开。';
  }
  remember();
  render();
  if (new URLSearchParams(location.search).has('e2e')) {
    window.__ledger = {
      state,
      render,
      openEntry,
      saveRecord: async (partial) => {
        const rec = {
          id: partial.id || newId(),
          type: partial.type || 'expense',
          amount: partial.amount,
          categoryId: partial.categoryId,
          date: partial.date,
          time: partial.time || '',
          note: partial.note || '',
          payMethod: partial.payMethod || '',
          source: partial.source || 'manual',
          externalId: partial.externalId || '',
          counterparty: partial.counterparty || '',
          createdAt: partial.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        await db.putRecord(rec);
        upsert(rec);
        return rec;
      },
      putSettings: async (patch) => {
        state.settings = { ...state.settings, ...patch, key: 'settings' };
        await db.putSettings(state.settings);
      },
    };
  }
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch(() => {});
    if (had) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    }
  }
}

function isKeypadControl(node) {
  const el = node && node.closest ? node.closest('.keypad .key') : null;
  return el || null;
}

function bind() {
  const root = document.getElementById('root');
  root.addEventListener('pointerdown', (e) => {
    const key = isKeypadControl(e.target);
    if (!key) return;
    e.preventDefault();
    keypadPointer = { id: e.pointerId, key };
    try { key.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  root.addEventListener('pointerup', (e) => {
    if (!keypadPointer || keypadPointer.id !== e.pointerId) return;
    const key = keypadPointer.key;
    keypadPointer = null;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (hit && (hit === key || key.contains(hit))) {
      keypadPointerAt = performance.now();
      applyKeypadKey(key);
    }
  });
  root.addEventListener('pointercancel', () => { keypadPointer = null; });
  root.addEventListener('touchstart', (e) => {
    if (isKeypadControl(e.target)) e.preventDefault();
  }, { passive: false });
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    if (isKeypadControl(el)) {
      if (performance.now() - keypadPointerAt > 700) applyKeypadKey(el);
      return;
    }
    handle(el.dataset.act, el).catch(() => toast('没能完成，请再试一次'));
  });
  root.addEventListener('input', onField);
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t?.dataset?.field === 'imp-cat' && state.sub?.name === 'preview') {
      const row = state.sub.rows[Number(t.dataset.i)];
      if (row) row.categoryId = t.value;
      render({ keepScroll: true });
      return;
    }
    onField(e);
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) await runImport(file);
  });
  document.getElementById('restore-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    state.pendingBackup = parsed.data;
    state.dialog = {
      title: '用这份备份替换？',
      message: '这台手机上现在的账单、分类和预算会被覆盖。',
      confirmText: '替换',
      danger: true,
      action: 'restore',
    };
    render({ keepScroll: true });
  });
  window.addEventListener('popstate', (e) => {
    if (!e.state) {
      state.sub = null;
      render();
      return;
    }
    applyHist(e.state);
    render();
  });
  bindDrag();
  bindSwipe();
}

bind();
boot();
