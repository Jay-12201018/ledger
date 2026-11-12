/** Custom money keypad. Accumulator is integer cents; the operand being typed is a string. */

export function emptyKeypad() {
  return { acc: null, op: null, current: '' };
}

export function centsToInput(cents) {
  const a = Math.abs(Math.round(Number(cents) || 0));
  const y = Math.floor(a / 100);
  const d = a % 100;
  if (d === 0) return String(y);
  if (d % 10 === 0) return `${y}.${d / 10}`;
  return `${y}.${String(d).padStart(2, '0')}`;
}

export function keypadFromCents(cents) {
  return { acc: null, op: null, current: centsToInput(cents) };
}

function currentToCents(current) {
  if (current == null || current === '' || current === '.') return null;
  const [a, b = ''] = String(current).split('.');
  if (!/^\d*$/.test(a) || !/^\d*$/.test(b)) return null;
  const frac = (b + '00').slice(0, 2);
  return parseInt(a || '0', 10) * 100 + parseInt(frac || '0', 10);
}

export function evaluateCents(state) {
  const cur = currentToCents(state.current);
  if (state.acc == null) return cur;
  if (!state.op || cur == null) return cur == null ? state.acc : cur;
  if (state.op === '+') return state.acc + cur;
  return state.acc - cur;
}

export function commitCents(state) {
  const v = evaluateCents(state);
  if (v == null || v <= 0) return null;
  if (v > 999999999) return null;
  return v;
}

function formatTyping(s) {
  if (!s) return '0';
  if (s === '.') return '0.';
  const [a, b] = s.split('.');
  const intNum = (a === '' ? '0' : a).replace(/^0+(?=\d)/, '') || '0';
  const withComma = intNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (s.includes('.')) return `${withComma}.${b ?? ''}`;
  return withComma;
}

function formatCentsTrim(cents) {
  const neg = cents < 0;
  const body = formatTyping(centsToInput(Math.abs(cents)));
  return neg ? `-${body}` : body;
}

export function displayText(state) {
  if (state.current) return formatTyping(state.current);
  if (state.acc != null) return formatCentsTrim(state.acc);
  return '0';
}

export function expressionText(state) {
  if (state.acc == null || !state.op) return '';
  const a = formatCentsTrim(state.acc);
  if (!state.current) return `${a} ${state.op}`;
  const cur = currentToCents(state.current) || 0;
  const result = state.op === '+' ? state.acc + cur : state.acc - cur;
  return `${a} ${state.op} ${formatTyping(state.current)} = ${formatCentsTrim(result)}`;
}

function appendDigits(current, digits) {
  let cur = current || '';
  if (cur === '0') {
    if (/^0+$/.test(digits)) return cur;
    digits = digits.replace(/^0+/, '');
    cur = '';
  }
  if (cur.includes('.')) {
    const dec = cur.split('.')[1] || '';
    const room = 2 - dec.length;
    if (room <= 0) return cur;
    const add = digits.slice(0, room);
    if (!add) return cur;
    return cur + add;
  }
  if ((cur + digits).length > 7) return cur;
  return (cur + digits).replace(/^0+(\d)/, '$1');
}

export function pressKey(state, key) {
  const s = { acc: state.acc, op: state.op, current: state.current || '' };
  if (key === 'back') {
    if (s.current) {
      s.current = s.current.slice(0, -1);
      return s;
    }
    if (s.op) {
      s.op = null;
      if (s.acc != null) {
        s.current = centsToInput(s.acc);
        s.acc = null;
      }
      return s;
    }
    if (s.acc != null) {
      s.current = centsToInput(s.acc);
      s.acc = null;
    }
    return s;
  }
  if (key === '+' || key === '-') {
    if (s.current && s.current !== '.') {
      const cur = currentToCents(s.current);
      if (cur == null) return s;
      if (s.acc != null && s.op) s.acc = s.op === '+' ? s.acc + cur : s.acc - cur;
      else s.acc = cur;
      s.current = '';
      s.op = key;
      return s;
    }
    if (s.acc != null) s.op = key;
    return s;
  }
  if (key === '.') {
    if (!s.current.includes('.')) s.current = `${s.current || '0'}.`;
    return s;
  }
  if (key === '00' || /^[0-9]$/.test(key)) {
    s.current = appendDigits(s.current, key);
    return s;
  }
  return s;
}
