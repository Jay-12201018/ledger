/** Money is integer cents. Display helpers stay timezone-agnostic. */

export function formatYuan(cents, opts = {}) {
  const n = Math.round(Number(cents) || 0);
  const neg = n < 0;
  const body = `¥${formatAbs(Math.abs(n))}`;
  if (opts.sign === 'always') return `${neg ? '-' : '+'}${body}`;
  if (opts.sign === 'expense') return `-${body}`;
  if (neg) return `-${body}`;
  return body;
}

function formatAbs(cents) {
  const y = Math.floor(cents / 100);
  const d = String(cents % 100).padStart(2, '0');
  const withComma = String(y).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${withComma}.${d}`;
}

/** Parse a bill or form amount into signed cents. Null if it isn't a number. */
export function parseAmountToCents(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const sign = raw < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(raw) * 100);
  }
  let s = String(raw ?? '').trim();
  s = s.replace(/[`'"\s¥￥元,，]/g, '');
  if (!s || s === '/' || s === '-' || s === '--') return null;
  let sign = 1;
  if (s[0] === '+' || s[0] === '-') {
    if (s[0] === '-') sign = -1;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  const frac = (b + '00').slice(0, 2);
  let cents = parseInt(a, 10) * 100 + parseInt(frac || '0', 10);
  const extra = b[2];
  if (extra && extra >= '5') cents += 1;
  return sign * cents;
}

/** Empty string → null (unset). Invalid → undefined. */
export function parseYuanField(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  return parseAmountToCents(t);
}

export function centsToYuanInput(cents) {
  if (cents == null || cents === '') return '';
  const n = Math.round(Number(cents));
  const neg = n < 0;
  const a = Math.abs(n);
  const y = Math.floor(a / 100);
  const d = a % 100;
  const body = d === 0 ? String(y) : `${y}.${String(d).padStart(2, '0')}`;
  return neg ? `-${body}` : body;
}
