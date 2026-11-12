const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function monthBounds(y, m) {
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    start,
    end,
    startISO: isoDate(start),
    endISO: isoDate(end),
    days: end.getDate(),
  };
}

export function weekday(iso) {
  return WEEK[parseISO(iso).getDay()];
}

export function monthTitle(y, m, today = new Date()) {
  if (y === today.getFullYear()) return `${m}月`;
  return `${y}年${m}月`;
}

export function dayHeading(iso, todayISO) {
  const d = parseISO(iso);
  const yest = isoDate(addDays(parseISO(todayISO), -1));
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  const w = WEEK[d.getDay()];
  if (iso === todayISO) return `今天 · ${md} ${w}`;
  if (iso === yest) return `昨天 · ${md} ${w}`;
  return `${md} ${w}`;
}

export function shortMD(iso, time = '') {
  const d = parseISO(iso);
  const t = time ? String(time).slice(0, 5) : '';
  return `${d.getMonth() + 1}月${d.getDate()}日${t ? ` ${t}` : ''}`;
}

export function weekLabel(start, end) {
  const sy = start.getFullYear();
  const sm = start.getMonth() + 1;
  const sd = start.getDate();
  const ey = end.getFullYear();
  const em = end.getMonth() + 1;
  const ed = end.getDate();
  if (sy === ey && sm === em) return `${sy}年${sm}月${sd}日 – ${ed}日`;
  if (sy === ey) return `${sy}年${sm}月${sd}日 – ${em}月${ed}日`;
  return `${sy}年${sm}月${sd}日 – ${ey}年${em}月${ed}日`;
}

export function periodOf(mode, anchorISO) {
  const d = parseISO(anchorISO);
  if (mode === 'week') {
    const start = startOfWeek(d);
    const end = addDays(start, 6);
    return { start, end, startISO: isoDate(start), endISO: isoDate(end), label: weekLabel(start, end) };
  }
  const b = monthBounds(d.getFullYear(), d.getMonth() + 1);
  return {
    start: b.start,
    end: b.end,
    startISO: b.startISO,
    endISO: b.endISO,
    label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
  };
}

export function shiftAnchor(mode, anchorISO, dir) {
  const d = parseISO(anchorISO);
  if (mode === 'week') return isoDate(addDays(d, dir * 7));
  const next = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  return isoDate(next);
}

/** Excel serial → calendar parts. Valid for dates after 1900-03-01. */
export function excelSerialToParts(serial) {
  const n = Number(serial);
  const days = Math.floor(n);
  let secs = Math.round((n - days) * 86400);
  const base = Date.UTC(1970, 0, 1) + (days - 25569) * 86400000;
  const d = new Date(base);
  if (secs >= 86400) {
    d.setUTCDate(d.getUTCDate() + 1);
    secs -= 86400;
  }
  if (secs < 0) secs = 0;
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (!secs) return { date, time: '' };
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  return { date, time: `${pad(hh)}:${pad(mm)}:${pad(ss)}` };
}

export function dateToExcelSerial(y, m, d, hh = 0, mm = 0, ss = 0) {
  const ms = Date.UTC(y, m - 1, d, hh, mm, ss);
  const days = (ms - Date.UTC(1970, 0, 1)) / 86400000;
  return days + 25569;
}

export function formatClock(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDeadline(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
