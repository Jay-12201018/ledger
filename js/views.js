import { svg, ICON_CHOICES } from './icons.js';
import { formatYuan } from './money.js';
import {
  monthTitle, dayHeading, isoDate, shortMD, periodOf, formatClock, formatDeadline, parseISO,
} from './dates.js';
import { displayText, expressionText } from './keypad.js';
import { PAY_METHODS, payName, safeColor, safeIcon, PALETTE } from './categories.js';
import {
  monthView, dailyExpense, categoryShares, groupByDay, dayTotals, inRange, sumType,
  allowanceSummary, savingsDepositedInMonth,
} from './stats.js';
import { FLAG_LABEL } from './import-parse.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function catOf(categories, id) {
  return categories.find((c) => c.id === id);
}

function bubble(cat, size = 18) {
  const color = safeColor(cat?.color);
  const icon = safeIcon(cat?.icon);
  return `<span class="bubble" style="background:${color}">${svg(icon, size)}</span>`;
}

let sheetEnter = false;

export function renderApp(state) {
  sheetEnter = !!state.sheetEnter;
  if (!state.ready) {
    return `<div class="boot"><div class="boot-logo">账</div><p>${esc(state.error || '个人账本')}</p></div>`;
  }
  const pageClass = [
    'page',
    state.sub ? 'subpage' : '',
    state.sub?.name === 'preview' ? 'pad-dock' : '',
  ].filter(Boolean).join(' ');
  return `<div class="app">
    <main class="${pageClass}">${pageHtml(state)}</main>
    ${state.sub ? '' : tabbar(state)}
    ${sheetHtml(state)}
    ${dialogHtml(state)}
    ${state.busy ? `<div class="overlay busy-layer"><div class="busy">${esc(state.busy)}</div></div>` : ''}
    ${state.toast ? `<div class="toast ${state.sheet ? 'on-sheet' : ''}">${esc(state.toast)}</div>` : ''}
  </div>`;
}

function pageHtml(state) {
  if (state.sub?.name === 'categories') return categoriesPage(state);
  if (state.sub?.name === 'import') return importPage();
  if (state.sub?.name === 'preview') return previewPage(state);
  if (state.sub?.name === 'catDetail') return catDetailPage(state);
  if (state.tab === 'report') return reportPage(state);
  if (state.tab === 'budget') return budgetPage(state);
  if (state.tab === 'me') return mePage(state);
  return ledgerPage(state);
}

function tabbar(state) {
  const tab = (id, icon, label) => `<button type="button" class="tab ${state.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${svg(icon, 22)}<span>${label}</span></button>`;
  return `<nav class="tabbar">
    ${tab('ledger', 'list', '明细')}
    ${tab('report', 'pie', '报表')}
    <div class="tab tab-slot"><button type="button" class="add-btn" data-act="add" aria-label="记一笔">${svg('plus', 28, 2.4)}</button></div>
    ${tab('budget', 'wallet', '预算')}
    ${tab('me', 'user', '我的')}
  </nav>`;
}

function ledgerPage(state) {
  const today = new Date();
  const todayISO = isoDate(today);
  const { y, m } = state.month;
  const view = monthView(state.records, state.categories, state.settings, y, m);
  const spark = dailyExpense(state.records, y, m, today);
  const heroCls = view.level === 'over' ? 'over' : '';
  const remainCls = view.level === 'over' ? 'over' : view.level === 'warn' ? 'warn' : '';
  const balCls = view.balance < 0 ? 'over' : '';
  const groups = groupByDay(view.list);
  return `<header class="top">
      <button type="button" class="title-btn" data-act="month-open">${esc(monthTitle(y, m, today))}${svg('chevron', 18)}</button>
      <button type="button" class="icon-btn" data-act="jump-today" aria-label="回到本月">${svg('calendar', 22)}</button>
    </header>
    <section class="card summary">
      <div class="k">本月已花</div>
      <div class="hero ${heroCls}"><span class="yen">¥</span>${esc(formatYuan(view.expense).slice(1))}</div>
      <div class="stats">
        <div class="stat"><span>本月收入</span><b>${esc(formatYuan(view.income))}</b></div>
        <div class="stat"><span>预算剩余</span><b class="${remainCls}">${view.budget ? esc(formatYuan(view.remain)) : '未设置'}</b></div>
        <div class="stat"><span>本月结余</span><b class="${balCls}">${esc(formatYuan(view.balance))}</b></div>
      </div>
      ${view.budget ? budgetLine(view) : `<button type="button" class="text-link" data-act="go-budget">设置月预算，花超了会提醒你</button>`}
      ${sparkBlock(spark, m)}
    </section>
    ${view.banner ? `<div class="banner ${view.bannerLevel}">${svg('warning', 18)}<p>${esc(view.banner)}</p></div>` : ''}
    ${groups.length ? groups.map(([date, list]) => dayBlock(date, list, state, todayISO)).join('') : emptyLedger()}`;
}

function budgetLine(view) {
  const pct = Math.round(view.ratio * 100);
  const width = Math.min(100, Math.max(0, pct));
  const pill = view.level === 'over' ? '<em class="pill over">已超支</em>' : view.level === 'warn' ? '<em class="pill warn">接近上限</em>' : '';
  return `<div class="budget-line">
    <div class="budget-meta"><span>月预算 ${esc(formatYuan(view.budget))} · 已用 ${pct}%</span>${pill}</div>
    <div class="bar ${view.level}"><i style="width:${width}%"></i></div>
  </div>`;
}

function sparkBlock(spark, m) {
  if (!spark.buckets.length) return '';
  const max = Math.max(...spark.buckets, 0);
  const cols = spark.buckets.map((v) => {
    const h = max <= 0 || v <= 0 ? 8 : Math.max(10, Math.round((v / max) * 100));
    return `<div class="spark-col"><i style="height:${h}%"></i></div>`;
  }).join('');
  const end = spark.isCurrent ? '今天' : `${m}月${spark.buckets.length}日`;
  return `<div class="spark" role="img" aria-label="每日支出">${cols}</div>
    <div class="spark-labels"><span>${m}月1日</span><span>${esc(end)}</span></div>`;
}

function dayBlock(date, list, state, todayISO) {
  const t = dayTotals(list);
  const bits = [];
  if (t.expense) bits.push(`支出 ${formatYuan(t.expense)}`);
  if (t.income) bits.push(`收入 ${formatYuan(t.income)}`);
  return `<section class="day">
    <div class="day-head"><span>${esc(dayHeading(date, todayISO))}</span><span>${esc(bits.join(' · '))}</span></div>
    ${list.map((r) => txRow(r, state.categories)).join('')}
  </section>`;
}

function txRow(r, categories) {
  const cat = catOf(categories, r.categoryId);
  const bits = [];
  if (r.note) bits.push(r.note);
  else if (r.counterparty) bits.push(r.counterparty);
  const tail = [payName(r.payMethod), r.time].filter(Boolean).join(' ');
  if (tail) bits.push(tail);
  const amt = r.type === 'income' ? formatYuan(r.amount, { sign: 'always' }) : formatYuan(r.amount);
  return `<button type="button" class="tx" data-act="open-record" data-id="${esc(r.id)}">
    ${bubble(cat, 18)}
    <span class="tx-main">
      <span class="tx-title">${esc(cat?.name || '未分类')}</span>
      ${bits.length ? `<span class="tx-sub">${esc(bits.join(' · '))}</span>` : ''}
    </span>
    <span class="tx-amt ${r.type}">${esc(amt)}</span>
  </button>`;
}

function emptyLedger() {
  return `<div class="empty">
    <div class="boot-logo sm">账</div>
    <p>这个月还没有账单</p>
    <span>点下方的加号，记第一笔</span>
  </div>`;
}

function reportPage(state) {
  const period = periodOf(state.reportMode, state.anchor);
  const list = inRange(state.records, period.startISO, period.endISO);
  const expense = sumType(list, 'expense');
  const income = sumType(list, 'income');
  const shares = categoryShares(list, state.categories);
  const word = state.reportMode === 'week' ? '本周' : '本月';
  const legend = shares.rows.slice(0, 5);
  return `<header class="top"><h1>报表</h1></header>
    <div class="seg-row">
      <div class="seg">
        <button type="button" class="${state.reportMode === 'week' ? 'on' : ''}" data-act="report-mode" data-mode="week">周</button>
        <button type="button" class="${state.reportMode === 'month' ? 'on' : ''}" data-act="report-mode" data-mode="month">月</button>
      </div>
      <button type="button" class="icon-btn" data-act="report-today" aria-label="回到当前">${svg('calendar', 22)}</button>
    </div>
    <div class="period">
      <button type="button" class="icon-btn" data-act="period" data-dir="-1" aria-label="上一期">${svg('chevL', 22)}</button>
      <span>${esc(period.label)}</span>
      <button type="button" class="icon-btn" data-act="period" data-dir="1" aria-label="下一期">${svg('chevR', 22)}</button>
    </div>
    <section class="card summary">
      <div class="split">
        <div>
          <div class="k">${word}支出</div>
          <div class="hero sm"><span class="yen">¥</span>${esc(formatYuan(expense).slice(1))}</div>
        </div>
        <div class="side-stats">
          <div><span>收入</span><b>${esc(formatYuan(income))}</b></div>
          <div><span>结余</span><b>${esc(formatYuan(income - expense))}</b></div>
          <div><span>笔数</span><b>共 ${list.length} 笔</b></div>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="donut-row">
        ${donutSVG(shares.rows, shares.total, `${word}支出`)}
        <div class="legend">
          ${legend.length ? legend.map((r) => `<div class="leg"><i style="background:${safeColor(r.color)}"></i><span>${esc(r.name)}</span><b>${r.pct}%</b></div>`).join('') : '<p class="muted">这段时间还没有支出</p>'}
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-h">分类排行</div>
      ${shares.rows.length ? shares.rows.map((r) => `<button type="button" class="rank" data-act="open-cat" data-id="${esc(r.id)}">
        <div class="rank-top"><span><i style="background:${safeColor(r.color)}"></i>${esc(r.name)}</span><span class="muted">${r.pct}%</span><b>${esc(formatYuan(r.amount))}</b></div>
        <div class="bar"><i style="width:${Math.max(r.pct, 2)}%;background:${safeColor(r.color)}"></i></div>
      </button>`).join('') : '<p class="muted pad">还没有可排的分类</p>'}
    </section>`;
}

function donutSVG(rows, total, centerLabel) {
  const r = 40;
  const c = 2 * Math.PI * r;
  if (!total || !rows.length) {
    return `<svg viewBox="0 0 120 120" class="donut"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#EEF1F4" stroke-width="14"/><text x="60" y="64" text-anchor="middle" fill="#8B919A" font-size="11">暂无支出</text></svg>`;
  }
  let offset = 0;
  const arcs = rows.map((seg) => {
    if (rows.length === 1) {
      return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${safeColor(seg.color)}" stroke-width="14"/>`;
    }
    const len = (seg.amount / total) * c;
    const gap = 2;
    const dash = Math.max(len - gap, 0.4);
    const el = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${safeColor(seg.color)}" stroke-width="14" stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}"/>`;
    offset += len;
    return el;
  }).join('');
  return `<svg viewBox="0 0 120 120" class="donut">
    <g transform="rotate(-90 60 60)">${arcs}</g>
    <text x="60" y="56" text-anchor="middle" fill="#8B919A" font-size="10">${esc(centerLabel)}</text>
    <text x="60" y="74" text-anchor="middle" fill="#1C1F24" font-size="12" font-weight="700">${esc(formatYuan(total))}</text>
  </svg>`;
}

function catDetailPage(state) {
  const cat = catOf(state.categories, state.sub.categoryId);
  const period = periodOf(state.reportMode, state.anchor);
  const list = inRange(state.records, period.startISO, period.endISO)
    .filter((r) => r.categoryId === state.sub.categoryId && r.type === 'expense')
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : (a.date < b.date ? 1 : -1)));
  const total = list.reduce((s, r) => s + r.amount, 0);
  return `${subHead(cat?.name || '分类')}
    <section class="card summary">
      <div class="k">${esc(period.label)}</div>
      <div class="hero sm"><span class="yen">¥</span>${esc(formatYuan(total).slice(1))}</div>
      <div class="k">${list.length} 笔支出</div>
    </section>
    <section class="day flat">${list.length ? list.map((r) => txRow(r, state.categories)).join('') : '<div class="empty"><p>这段时间没有这个分类的账单</p></div>'}</section>`;
}

function budgetPage(state) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const view = monthView(state.records, state.categories, state.settings, y, m);
  const savings = state.settings.savings;
  const plan = allowanceSummary({
    allowance: state.settings.monthlyAllowance,
    budget: state.settings.monthlyBudget,
    spent: view.expense,
    deposited: savingsDepositedInMonth(savings, y, m),
  });
  const configured = view.budget || plan.set;
  return `<header class="top">
      <h1>预算</h1>
      <button type="button" class="text-btn" data-act="edit-budget">${configured ? '编辑' : '设置'}</button>
    </header>
    ${view.budget ? budgetHero(view) : `<section class="card empty-card">
      <p>先给每个月定一个花费上限</p>
      <button type="button" class="primary" data-act="edit-budget">设置月预算</button>
    </section>`}
    ${allowanceCard(plan)}
    ${view.banner ? `<div class="banner ${view.bannerLevel}">${svg('warning', 18)}<p>${esc(view.banner)}</p></div>` : ''}
    <section class="card">
      <div class="card-h"><span>分类预算</span><button type="button" class="text-btn" data-act="edit-budget">设置</button></div>
      ${view.catBudgets.length ? view.catBudgets.map((c) => catBudgetRow(c)).join('') : '<p class="muted pad">可以按分类再设上限，比如餐饮、娱乐。</p>'}
    </section>
    ${savings ? savingsCard(savings) : `<button type="button" class="card goal-empty" data-act="edit-savings">
      <span class="bubble teal">${svg('wallet', 18)}</span>
      <span class="tx-main"><span class="tx-title">设一个存钱目标</span><span class="tx-sub">比如新耳机、回家的车票</span></span>
    </button>`}`;
}

function allowanceCard(plan) {
  if (!plan.set) {
    return `<button type="button" class="card allow-empty" data-act="edit-budget">
      <span class="tx-title">填上每月生活费</span>
      <span class="tx-sub">就能看出这个月计划能存多少、实际还剩多少</span>
    </button>`;
  }
  const planned = plan.planned == null
    ? '<b class="muted">未设置</b>'
    : `<b class="${plan.planned < 0 ? 'over' : 'ok'}">${esc(formatYuan(plan.planned))}</b>`;
  const remainCls = plan.remaining < 0 ? 'over' : 'ok';
  return `<section class="card allow">
    <div class="card-h">这个月能存下多少</div>
    <div class="allow-grid">
      <div><span>每月生活费</span><b>${esc(formatYuan(plan.allowance))}</b></div>
      <div><span>月预算</span><b>${plan.budgetSet ? esc(formatYuan(plan.budget)) : '未设置'}</b></div>
    </div>
    <div class="allow-plan">
      <span>计划可存</span>
      ${planned}
      <em>${plan.planned != null && plan.planned < 0 ? '预算比生活费高，按预算来花这个月存不下' : '生活费 − 月预算'}</em>
    </div>
    <div class="allow-grid">
      <div><span>本月还能存</span><b class="${remainCls}">${esc(formatYuan(plan.remaining))}</b></div>
      <div><span>本月已存</span><b>${esc(formatYuan(plan.deposited))}</b></div>
    </div>
    <p class="hint">预算留给花销，剩下的才是能存的；花超预算的部分会从这里扣。存入不算花掉。</p>
    ${plan.remaining < 0 ? '<p class="hint warn-text">花超预算的部分，加上已经存入的，已经把能存的用完了。</p>' : ''}
  </section>`;
}

function budgetHero(view) {
  const over = view.remain < 0;
  const label = over ? '本月已超支' : '本月剩余预算';
  const big = over ? -view.remain : view.remain;
  return `<section class="card ring-card">
    ${ring(view.ratio, view.level)}
    <div>
      <div class="k">${label}</div>
      <div class="hero sm ${over ? 'over' : ''}"><span class="yen">¥</span>${esc(formatYuan(big).slice(1))}</div>
      <div class="ring-meta"><span>已花 ${esc(formatYuan(view.expense))}</span><span>月预算 ${esc(formatYuan(view.budget))}</span></div>
    </div>
  </section>`;
}

function ring(ratio, level) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(ratio || 0, 1));
  const color = level === 'over' ? '#F25767' : level === 'warn' ? '#F5A524' : '#1FCB8C';
  const dash = shown * c;
  const label = `${Math.round((ratio || 0) * 100)}%`;
  return `<svg viewBox="0 0 88 88" class="ring">
    <circle cx="44" cy="44" r="${r}" fill="none" stroke="#F0F2F5" stroke-width="8"/>
    <circle cx="44" cy="44" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash} ${c - dash}" transform="rotate(-90 44 44)"/>
    <text x="44" y="48" text-anchor="middle" fill="#1C1F24" font-size="13" font-weight="700">${label}</text>
  </svg>`;
}

function catBudgetRow(c) {
  const width = Math.min(100, Math.round(c.ratio * 100));
  const tag = c.level === 'over' ? '<em class="pill over">超支</em>' : '';
  return `<div class="cbrow">
    <div class="rank-top">${bubble(c, 16)}<span class="grow">${esc(c.name)}</span>${tag}<b>${esc(formatYuan(c.spent))} / ${esc(formatYuan(c.limit))}</b></div>
    <div class="bar ${c.level}"><i style="width:${Math.max(width, c.spent ? 2 : 0)}%"></i></div>
  </div>`;
}

function savingsCard(s) {
  const ratio = s.target > 0 ? s.saved / s.target : 0;
  const pct = Math.round(ratio * 100);
  const width = Math.min(100, pct);
  const sub = s.note || (s.deadline ? `在 ${formatDeadline(s.deadline)} 前` : '慢慢存就好');
  const late = s.deadline && s.saved < s.target && s.deadline < isoDate(new Date());
  return `<section class="card goal">
    <div class="card-h"><span class="with-ico"><span class="bubble teal">${svg('wallet', 16)}</span>存钱目标 · ${esc(s.name)}</span>
      <button type="button" class="text-btn" data-act="edit-savings">编辑</button></div>
    <p class="muted ${late ? 'warn-text' : ''}">${esc(late ? `已过 ${formatDeadline(s.deadline)}` : sub)}</p>
    <div class="goal-top"><b>${Math.min(pct, 999)}%</b><span>已存 ${esc(formatYuan(s.saved))}</span><span>目标 ${esc(formatYuan(s.target))}</span></div>
    <div class="bar ok"><i style="width:${width}%"></i></div>
    ${(s.deposits || []).slice(0, 3).map((d) => `<div class="dep">${esc(formatClock(d.at))} 存入 ${esc(formatYuan(d.amount))}</div>`).join('')}
    <button type="button" class="primary ghost" data-act="deposit">存入一笔</button>
  </section>`;
}

function mePage(state) {
  const n = state.records.length;
  const last = state.settings.lastBackupAt;
  return `<header class="top"><h1>我的</h1></header>
    <section class="card note-card">
      <p>账单都记在这台手机上。卸掉或清除浏览器数据就会丢失，换手机前先导出一份备份。</p>
      <p class="muted">已记 ${n} 笔 · ${last ? `上次备份 ${esc(formatClock(last))}` : '还没有备份过'}</p>
    </section>
    <section class="card list-card">
      ${tool('go-categories', 'book', '分类管理', '新增、改名、排序')}
      ${tool('go-import', 'download', '账单导入', '微信或支付宝导出的文件')}
      ${tool('export', 'upload', '导出备份', '保存一份 JSON')}
      ${tool('restore', 'backup', '恢复备份', '用备份覆盖这台手机')}
    </section>
    <p class="foot">个人账本 v1 · 不包含自动识别记账</p>`;
}

function tool(act, icon, title, sub) {
  return `<button type="button" class="tool" data-act="${act}">
    <span class="bubble soft">${svg(icon, 18)}</span>
    <span class="tx-main"><span class="tx-title">${title}</span><span class="tx-sub">${sub}</span></span>
    ${svg('chevR', 18)}
  </button>`;
}

function subHead(title) {
  return `<header class="top sub">
    <button type="button" class="icon-btn" data-act="back" aria-label="返回">${svg('back', 22)}</button>
    <h1>${esc(title)}</h1>
    <span class="icon-btn placeholder"></span>
  </header>`;
}

function categoriesPage(state) {
  const type = state.catTab;
  const cats = state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
  return `${subHead('分类管理')}
    <div class="seg wide">
      <button type="button" class="${type === 'expense' ? 'on' : ''}" data-act="cat-tab" data-type="expense">支出</button>
      <button type="button" class="${type === 'income' ? 'on' : ''}" data-act="cat-tab" data-type="income">收入</button>
    </div>
    <section class="card list-card cat-list">
      ${cats.map((c) => {
        const count = state.records.filter((r) => r.categoryId === c.id).length;
        return `<div class="cat-row" data-cat-row="${esc(c.id)}">
          ${bubble(c, 18)}
          <span class="cat-name">${esc(c.name)}</span>
          <span class="cat-count">${count} 笔</span>
          <button type="button" class="icon-btn" data-act="cat-edit" data-id="${esc(c.id)}" aria-label="编辑">${svg('pencil', 18)}</button>
          <button type="button" class="icon-btn danger" data-act="cat-delete" data-id="${esc(c.id)}" aria-label="删除">${svg('trash', 18)}</button>
          <button type="button" class="icon-btn grip" data-drag="1" aria-label="拖动排序">${svg('grip', 18)}</button>
        </div>`;
      }).join('')}
    </section>
    <button type="button" class="dash-add" data-act="cat-add">+ 新增分类</button>
    <p class="hint">按右侧横线拖动可调整顺序，常用分类会排在记一笔的前面。</p>`;
}

function importPage() {
  return `${subHead('导入账单')}
    <p class="lead">把微信或支付宝导出的账单文件导进来，预览确认后再入账。支持 csv / xlsx。</p>
    <button type="button" class="src-card" data-act="pick-source" data-source="wechat">
      <span class="bubble wechat">微</span>
      <span class="tx-main">
        <span class="tx-title">微信支付账单</span>
        <span class="tx-sub">微信 → 我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单</span>
      </span>
      ${svg('chevR', 18)}
    </button>
    <button type="button" class="src-card" data-act="pick-source" data-source="alipay">
      <span class="bubble alipay">支</span>
      <span class="tx-main">
        <span class="tx-title">支付宝账单</span>
        <span class="tx-sub">支付宝 → 我的 → 账单 → 右上角 … → 开具交易流水</span>
      </span>
      ${svg('chevR', 18)}
    </button>
    <section class="card steps">
      <div class="card-h">导入前会帮你做这些</div>
      <div class="step"><em>1</em><div><b>解析文件里的每一笔</b><span>识别日期、金额、商户和收支方向</span></div></div>
      <div class="step"><em>2</em><div><b>标出重复和退款</b><span>已经记过的会跳过，退款单独确认</span></div></div>
      <div class="step"><em>3</em><div><b>预映射分类，你可以改</b><span>确认后才真正写入明细</span></div></div>
    </section>
    <p class="hint">请选「用于个人对账」。邮件里的压缩包有密码，先解压再选里面的 csv 或 xlsx。证明材料 PDF 读不了。</p>`;
}

function previewPage(state) {
  const rows = state.sub.rows || [];
  const checked = rows.filter((r) => r.checked && r.cents > 0);
  const dupSkip = rows.filter((r) => r.flags.includes('duplicate') && !r.checked).length;
  const refundWait = rows.filter((r) => r.flags.includes('refund') && !r.checked).length;
  const expense = checked.filter((r) => r.type !== 'income').reduce((s, r) => s + r.cents, 0);
  const income = checked.filter((r) => r.type === 'income').reduce((s, r) => s + r.cents, 0);
  let btn = `确认导入 ${checked.length} 笔`;
  if (checked.length && income && expense) btn += ` · 支出 ${formatYuan(expense)} · 收入 ${formatYuan(income)}`;
  else if (checked.length && income) btn += ` · 收入 ${formatYuan(income)}`;
  else if (checked.length) btn += ` · ${formatYuan(expense)}`;
  return `${subHead('预览并导入')}
    <section class="card imp-stats">
      <div><b class="ok">${checked.length}</b><span>将导入</span></div>
      <div><b>${dupSkip}</b><span>重复已跳过</span></div>
      <div><b class="warn-text">${refundWait}</b><span>退款待确认</span></div>
    </section>
    <div class="imp-list">
      ${rows.map((r, i) => previewRow(r, i, state)).join('')}
    </div>
    <p class="hint">没勾上的是重复、退款、转账、不计收支或失败的记录。确认之后才会写入。</p>
    <div class="dock">
      <button type="button" class="primary block" data-act="imp-import" ${checked.length ? '' : 'disabled'}>${esc(btn)}</button>
    </div>`;
}

function previewRow(r, i, state) {
  const type = r.type === 'income' ? 'income' : 'expense';
  const cats = state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
  const cat = catOf(state.categories, r.categoryId) || cats[0];
  const badges = r.flags.map((f) => `<em class="badge ${f}">${FLAG_LABEL[f] || f}</em>`).join('');
  const title = rowTitle(r);
  const amt = r.type === 'income'
    ? formatYuan(r.cents, { sign: 'always' })
    : r.type === 'neutral'
      ? formatYuan(r.cents)
      : formatYuan(r.cents, { sign: 'expense' });
  const pay = payName(r.payMethod) || (state.sub.source === 'alipay' ? '支付宝' : '微信');
  return `<div class="imp-row ${r.checked ? '' : 'dim'}">
    <button type="button" class="check ${r.checked ? 'on' : ''}" data-act="imp-toggle" data-i="${i}" aria-label="选择">${r.checked ? svg('check', 14, 2.4) : ''}</button>
    ${bubble(cat, 16)}
    <div class="imp-main">
      <div class="imp-title">${esc(title)}${badges}</div>
      <div class="imp-sub">${esc(shortMD(r.date, r.time))} · ${esc(pay)}</div>
      <label class="imp-cat">分类
        ${cats.length ? `<select data-field="imp-cat" data-i="${i}">
          ${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === r.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>` : '<span>还没有分类，请先新增</span>'}
      </label>
    </div>
    <div class="imp-amt ${r.type}">${esc(amt)}</div>
  </div>`;
}

function rowTitle(r) {
  const p = (r.product || '').trim();
  const c = (r.counterparty || '').trim();
  if (p && c && p !== c) {
    const combo = `${p} ${c}`;
    return combo.length <= 22 ? combo : p;
  }
  return p || c || '未命名';
}

function sheetHtml(state) {
  if (!state.sheet) return '';
  const s = state.sheet;
  if (s.type === 'entry') return entrySheet(state, s);
  if (s.type === 'categoryForm') return categorySheet(s);
  if (s.type === 'budget') return budgetSheet(state, s);
  if (s.type === 'savings') return savingsSheet(s);
  if (s.type === 'deposit') return depositSheet(s);
  if (s.type === 'month') return monthSheet(state, s);
  if (s.type === 'backup') return backupSheet(s);
  if (s.type === 'moveCat') return moveCatSheet(state, s);
  return '';
}

function sheetWrap(inner, extra = '') {
  const cls = ['sheet', extra, sheetEnter ? 'rise' : ''].filter(Boolean).join(' ');
  return `<div class="overlay"><button type="button" class="backdrop" data-act="sheet-close" aria-label="关闭"></button><div class="${cls}" role="dialog">${inner}</div></div>`;
}

function entrySheet(state, s) {
  const cats = state.categories.filter((c) => c.type === s.direction).sort((a, b) => a.order - b.order);
  const today = isoDate(new Date());
  const dateLabel = s.date === today ? '今天' : shortMD(s.date);
  const pay = payName(s.payMethod);
  const keys = ['1', '2', '3', '+', '4', '5', '6', '-', '7', '8', '9', 'back', '.', '0', '00', 'done'];
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <div class="seg small">
        <button type="button" class="${s.direction === 'expense' ? 'on' : ''}" data-act="dir" data-dir="expense">支出</button>
        <button type="button" class="${s.direction === 'income' ? 'on' : ''}" data-act="dir" data-dir="income">收入</button>
      </div>
      <span class="icon-btn placeholder"></span>
    </div>
    <div class="expr">${esc(expressionText(s.keypad)) || '&nbsp;'}</div>
    <div class="amount ${s.direction}"><span class="yen">¥</span><span class="num">${esc(displayText(s.keypad))}</span></div>
    <div class="cats">
      ${cats.map((c) => `<button type="button" class="cat ${c.id === s.categoryId ? 'on' : ''}" data-act="pick-cat" data-id="${esc(c.id)}" style="--c:${safeColor(c.color)}">
        <span class="bubble lg" style="background:${safeColor(c.color)}">${svg(safeIcon(c.icon), 22)}</span>
        <span>${esc(c.name)}</span>
      </button>`).join('')}
      <button type="button" class="cat" data-act="new-cat">
        <span class="bubble lg dash">${svg('plus', 20)}</span>
        <span>新增</span>
      </button>
    </div>
    <div class="meta-row">
      <label class="chip grow">
        ${svg('smile', 16)}
        <input class="note-input" data-field="note" maxlength="80" placeholder="写备注" value="${esc(s.note || '')}">
      </label>
      <label class="chip">
        ${svg('calendar', 16)}
        <span>${esc(dateLabel)}</span>
        <input type="date" data-field="date" value="${esc(s.date)}">
      </label>
      <button type="button" class="chip ${s.payMethod ? 'on' : ''}" data-act="pay-toggle">${pay ? esc(pay) : '方式'}</button>
    </div>
    ${s.payOpen ? `<div class="pay-pop">
      <button type="button" data-act="pay" data-pay="">不选</button>
      ${PAY_METHODS.map((p) => `<button type="button" class="${s.payMethod === p.id ? 'on' : ''}" data-act="pay" data-pay="${p.id}">${p.name}</button>`).join('')}
    </div>` : ''}
    ${s.mode === 'edit' ? `<button type="button" class="link-danger" data-act="ask-delete">删除这笔账单</button>` : ''}
    ${s.source && s.source !== 'manual' ? `<p class="hint tight">来自${s.source === 'wechat' ? '微信' : '支付宝'}账单${s.externalId ? ` · ${esc(s.externalId)}` : ''}</p>` : ''}
    <div class="keypad">
      ${keys.map((k) => {
        if (k === 'done') return `<button type="button" class="key go" tabindex="-1" data-act="done">${s.mode === 'edit' ? '保存' : '完成'}</button>`;
        const face = k === 'back' ? svg('backspace', 22) : k === '-' ? '−' : k;
        return `<button type="button" class="key" tabindex="-1" data-act="key" data-key="${k}">${face}</button>`;
      }).join('')}
    </div>`, 'entry');
}

function categorySheet(s) {
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <h2>${s.mode === 'edit' ? '编辑分类' : '新增分类'}</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <label class="field"><span>名称</span>
      <input data-field="name" maxlength="12" placeholder="例如 医疗" value="${esc(s.name || '')}">
    </label>
    <div class="field-label">颜色</div>
    <div class="swatches">
      ${PALETTE.map((c) => `<button type="button" class="swatch ${s.color === c ? 'on' : ''}" style="background:${c}" data-act="cat-color" data-color="${c}" aria-label="${c}"></button>`).join('')}
    </div>
    <div class="field-label">图标</div>
    <div class="icon-pick">
      ${ICON_CHOICES.map((name) => `<button type="button" class="ip ${s.icon === name ? 'on' : ''}" data-act="cat-icon" data-icon="${name}" style="--c:${safeColor(s.color)}">${svg(name, 20)}</button>`).join('')}
    </div>
    <button type="button" class="primary block" data-act="save-cat">保存</button>`);
}

function budgetSheet(state, s) {
  const cats = state.categories.filter((c) => c.type === 'expense').sort((a, b) => a.order - b.order);
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <h2>每月预算</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <p class="hint tight">这一档每个月都生效，直到你再改。只统计支出。</p>
    <label class="field"><span>每月生活费（元）</span>
      <input data-field="allowance" inputmode="decimal" placeholder="不设就留空，例如 2500" value="${esc(s.allowance || '')}">
    </label>
    <label class="field"><span>每月总预算（元）</span>
      <input data-field="total" inputmode="decimal" placeholder="不设就留空，例如 1800" value="${esc(s.total)}">
    </label>
    <p class="hint tight">生活费是每个月到手的钱，预算是打算花掉的上限。相减就是计划能存下的。预算可以比生活费高。</p>
    <div class="field-label">分类预算（元，可留空）</div>
    ${cats.map((c) => `<label class="field inline">
      ${bubble(c, 16)}
      <span>${esc(c.name)}</span>
      <input data-cat-budget="${esc(c.id)}" inputmode="decimal" placeholder="不设" value="${esc(s.cats[c.id] || '')}">
    </label>`).join('')}
    <button type="button" class="primary block" data-act="save-budget">保存</button>`);
}

function savingsSheet(s) {
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <h2>存钱目标</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <label class="field"><span>名称</span><input data-field="name" maxlength="20" placeholder="例如 新耳机" value="${esc(s.name || '')}"></label>
    <label class="field"><span>目标金额（元）</span><input data-field="target" inputmode="decimal" placeholder="800" value="${esc(s.target || '')}"></label>
    <label class="field"><span>已经存了（元）</span><input data-field="saved" inputmode="decimal" placeholder="0" value="${esc(s.saved || '')}"></label>
    <label class="field"><span>截止日期，可不填</span><input data-field="deadline" type="date" value="${esc(s.deadline || '')}"></label>
    <label class="field"><span>一句备注</span><input data-field="note" maxlength="40" placeholder="例如 希望暑假前存满" value="${esc(s.note || '')}"></label>
    <button type="button" class="primary block" data-act="save-savings">保存</button>
    ${s.existed ? '<button type="button" class="link-danger" data-act="ask-delete-savings">删除这个目标</button>' : ''}`);
}

function depositSheet(s) {
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <h2>存入</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <label class="field"><span>金额（元）</span><input data-field="amount" inputmode="decimal" placeholder="例如 100" value="${esc(s.amount || '')}"></label>
    ${s.room != null ? `<p class="hint tight">本月还能存 ${esc(formatYuan(s.room))}。超过这个数会提醒你，仍然可以存。存入不算花掉。</p>` : ''}
    <button type="button" class="primary block" data-act="save-deposit">存入</button>`);
}

function monthSheet(state, s) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <div class="year-row">
        <button type="button" class="icon-btn" data-act="month-year" data-dir="-1" aria-label="上一年">${svg('chevL', 18)}</button>
        <h2>${s.year}年</h2>
        <button type="button" class="icon-btn" data-act="month-year" data-dir="1" aria-label="下一年">${svg('chevR', 18)}</button>
      </div>
      <span class="icon-btn placeholder"></span>
    </div>
    <div class="month-grid">
      ${months.map((m) => {
        const on = state.month.y === s.year && state.month.m === m;
        return `<button type="button" class="mbtn ${on ? 'on' : ''}" data-act="month-pick" data-m="${m}">${m}月</button>`;
      }).join('')}
    </div>`);
}

function moveCatSheet(state, s) {
  const others = state.categories
    .filter((c) => c.type === s.catType && c.id !== s.id)
    .sort((a, b) => a.order - b.order);
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="取消">${svg('close', 20)}</button>
      <h2>删除「${esc(s.name)}」</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <p class="lead">有 ${s.count} 笔账单在用它。要改记到哪个分类？关掉这个窗口就不会删除。</p>
    <div class="move-list">
      ${others.map((c) => `<button type="button" class="move-opt ${c.id === s.targetId ? 'on' : ''}" data-act="move-target" data-id="${esc(c.id)}">
        ${bubble(c, 16)}<span>${esc(c.name)}</span>
      </button>`).join('')}
    </div>
    <button type="button" class="primary block" data-act="confirm-move-cat">删除并转移</button>`);
}

function backupSheet(s) {
  return sheetWrap(`<div class="sheet-bar">
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="关闭">${svg('close', 20)}</button>
      <h2>保存备份</h2>
      <span class="icon-btn placeholder"></span>
    </div>
    <p class="lead">如果没有自动下载，点下面的链接。iPhone 上也可以长按链接，选“下载链接的文件”或分享到“文件”。</p>
    <a class="primary block linkish" href="${esc(s.href)}" download="${esc(s.filename)}">保存 ${esc(s.filename)}</a>`);
}

function dialogHtml(state) {
  const d = state.dialog;
  if (!d) return '';
  return `<div class="overlay dialog-layer">
    <div class="backdrop" data-act="dialog-cancel"></div>
    <div class="dialog" role="dialog">
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.message)}</p>
      <div class="dialog-actions">
        <button type="button" data-act="dialog-cancel">取消</button>
        <button type="button" class="${d.danger ? 'danger' : ''}" data-act="dialog-ok">${esc(d.confirmText || '确定')}</button>
      </div>
    </div>
  </div>`;
}
