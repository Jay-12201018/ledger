import { excelSerialToParts } from './dates.js';
import { parseAmountToCents } from './money.js';
import { mapPayMethod, suggestCategoryName } from './categories.js';
import { readXlsxMatrices } from './xlsx-read.js';

export const FLAG_LABEL = {
  duplicate: '重复',
  refund: '退款',
  transfer: '转账',
  neutral: '不计收支',
  failed: '失败',
};

function cleanField(s) {
  return String(s ?? '').replace(/^\uFEFF/, '').replace(/`/g, '').trim();
}

export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) {
      row.push(cleanField(field));
      field = '';
    } else if (c === '\n') {
      row.push(cleanField(field));
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(cleanField(field));
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).slice(0, 80);
  let best = ',';
  let bestScore = 0;
  for (const line of lines) {
    if (!/交易时间|交易创建时间|付款时间/.test(line)) continue;
    for (const d of [',', '\t', ';']) {
      const score = line.split(d).length;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
  }
  return best;
}

export function normHeader(s) {
  return cleanField(s).replace(/[\s\t]/g, '').replace(/（/g, '(').replace(/）/g, ')');
}

function indexOfHeader(headers, names) {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

function looksLikeBill(text) {
  return /交易时间|交易创建时间|付款时间/.test(text) && /金额|收\/支/.test(text);
}

export function decodeBillText(bytes) {
  const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let utf8 = null;
  try {
    utf8 = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    utf8 = null;
  }
  if (utf8 && looksLikeBill(utf8)) return utf8.replace(/^\uFEFF/, '');
  let gbk = null;
  try {
    gbk = new TextDecoder('gbk').decode(raw);
  } catch {
    gbk = null;
  }
  if (gbk && looksLikeBill(gbk)) return gbk.replace(/^\uFEFF/, '');
  return (utf8 || gbk || '').replace(/^\uFEFF/, '');
}

function cell(row, i) {
  if (i < 0) return '';
  return row[i] == null ? '' : String(row[i]);
}

function parseDirection(raw) {
  const t = cleanField(raw).replace(/\s/g, '');
  if (!t || t === '/' || t === '-' || t === '--') return 'neutral';
  if (t.includes('不计') || t.includes('中性') || t === '其它' || t === '其他') return 'neutral';
  if (t.includes('收入') || t === '入') return 'income';
  if (t.includes('支出') || t === '支') return 'expense';
  return 'unknown';
}

function parseDateTime(raw) {
  const s = cleanField(raw);
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      const parts = excelSerialToParts(n);
      return parts;
    }
  }
  const m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T日](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const time = m[4] != null
    ? `${String(m[4]).padStart(2, '0')}:${m[5]}:${String(m[6] || '00').padStart(2, '0')}`
    : '';
  return { date, time };
}

function findHeader(matrix) {
  for (let i = 0; i < matrix.length; i += 1) {
    const headers = (matrix[i] || []).map(normHeader);
    const time = indexOfHeader(headers, ['交易时间', '付款时间', '交易创建时间']);
    const amount = indexOfHeader(headers, ['金额(元)', '金额']);
    if (time >= 0 && amount >= 0) {
      return {
        index: i,
        time,
        amount,
        dir: indexOfHeader(headers, ['收/支']),
        counterparty: indexOfHeader(headers, ['交易对方']),
        product: indexOfHeader(headers, ['商品说明', '商品名称', '商品']),
        status: indexOfHeader(headers, ['当前状态', '交易状态']),
        tx: indexOfHeader(headers, ['交易单号', '交易订单号', '交易号']),
        kind: indexOfHeader(headers, ['交易分类', '交易类型', '类型']),
        pay: indexOfHeader(headers, ['支付方式', '收/付款方式']),
        remark: indexOfHeader(headers, ['备注']),
        refund: indexOfHeader(headers, ['成功退款(元)']),
      };
    }
  }
  return null;
}

function cleanId(s) {
  const t = cleanField(s).replace(/\s/g, '');
  if (!t || t === '/' || t === '-' || t === '0') return '';
  return t;
}

function flagsFor(row) {
  const flags = [];
  const status = row.status || '';
  const kind = row.kind || '';
  const blob = `${kind} ${row.product || ''} ${row.counterparty || ''} ${status} ${row.remark || ''}`;
  if (/失败|交易关闭|已关闭|已取消|取消|未付款|待付款|等待付款|付款失败|已撤销|未支付/.test(status)) {
    flags.push('failed');
  }
  if (/退款/.test(blob) || row.refundCents > 0) flags.push('refund');
  if (row.direction === 'neutral' || /提现|零钱通|理财通|信用卡还款|花呗还款|余额宝-转入|转入余额宝|转出到银行卡|账户存取/.test(`${kind} ${row.product || ''}`)) {
    if (!flags.includes('neutral')) flags.push('neutral');
  }
  if (/转账/.test(kind) || /转账/.test(row.product || '')) flags.push('transfer');
  return flags;
}

export function matrixToRows(matrix, source) {
  const header = findHeader(matrix);
  if (!header) return null;
  const rows = [];
  for (let i = header.index + 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    if (!line.some((c) => cleanField(c))) continue;
    const when = parseDateTime(cell(line, header.time));
    if (!when) continue;
    const signed = parseAmountToCents(cell(line, header.amount));
    if (signed == null) continue;
    const cents = Math.abs(signed);
    const direction = header.dir >= 0 ? parseDirection(cell(line, header.dir)) : (signed < 0 ? 'expense' : 'unknown');
    const type = direction === 'income' ? 'income' : direction === 'neutral' ? 'neutral' : 'expense';
    const refundRaw = header.refund >= 0 ? parseAmountToCents(cell(line, header.refund)) : null;
    const row = {
      date: when.date,
      time: when.time,
      type,
      direction,
      cents,
      counterparty: cleanField(cell(line, header.counterparty)),
      product: cleanField(cell(line, header.product)).replace(/^\/$/, ''),
      remark: cleanField(cell(line, header.remark)).replace(/^\/$/, ''),
      kind: cleanField(cell(line, header.kind)),
      status: cleanField(cell(line, header.status)),
      txId: cleanId(cell(line, header.tx)),
      payRaw: cleanField(cell(line, header.pay)),
      refundCents: refundRaw == null ? 0 : Math.abs(refundRaw),
    };
    row.payMethod = mapPayMethod(row.payRaw, source);
    row.flags = flagsFor(row);
    if (row.direction === 'neutral' && !row.flags.includes('neutral')) row.flags.push('neutral');
    const text = [row.counterparty, row.product, row.remark].filter(Boolean).join(' ');
    row.categoryName = suggestCategoryName({
      type: row.type === 'income' ? 'income' : 'expense',
      text,
      kind: row.kind,
    });
    rows.push(row);
  }
  return rows;
}

function sigOf(type, cents, date, time) {
  if (!date || !time || !cents || type === 'neutral') return '';
  return `${type}|${cents}|${date}|${String(time).slice(0, 5)}`;
}

export function applyDuplicateFlags(rows, existing = []) {
  const ids = new Set((existing || []).map((r) => cleanId(r.externalId)).filter(Boolean));
  const times = new Set();
  for (const r of existing || []) {
    const s = sigOf(r.type, r.amount, r.date, r.time);
    if (s) times.add(s);
  }
  const seenIds = new Set();
  const seenSig = new Set();
  return rows.map((r) => {
    const flags = (r.flags || []).filter((f) => f !== 'duplicate');
    let dup = false;
    if (r.txId) {
      if (ids.has(r.txId) || seenIds.has(r.txId)) dup = true;
      seenIds.add(r.txId);
    }
    const s = sigOf(r.type, r.cents, r.date, r.time);
    if (s) {
      if (times.has(s) || seenSig.has(s)) dup = true;
      seenSig.add(s);
    }
    if (dup) flags.push('duplicate');
    const checked = flags.length === 0 && r.cents > 0;
    return { ...r, flags, checked };
  });
}

function isZip(bytes) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isOle(bytes) {
  return bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

async function loadMatrix(buffer, filename) {
  const bytes = new Uint8Array(buffer);
  const name = filename || '';
  if (isOle(bytes)) {
    return { error: '暂不支持旧版 xls，请导出 csv 或 xlsx。' };
  }
  if (isZip(bytes) || /\.xlsx$/i.test(name)) {
    try {
      const book = await readXlsxMatrices(buffer);
      if (!book.isXlsx) {
        if (book.csvText) return { matrix: parseCsv(book.csvText, detectDelimiter(book.csvText)) };
        return { error: '这像是一个压缩包。请先用邮件里的密码解压，再选择里面的 csv 或 xlsx。' };
      }
      return { matrices: book.sheets };
    } catch (e) {
      if (e && e.code === 'encrypted') {
        return { error: '文件有密码。请先解压，再选择里面的 csv 或 xlsx。' };
      }
      return { error: '没能读开这个文件。请确认是 csv 或 xlsx，且没有打开密码。' };
    }
  }
  if (bytes.length > 20 * 1024 * 1024) {
    return { error: '文件太大了，请缩短导出的时间范围。' };
  }
  const text = decodeBillText(bytes);
  if (!text) return { error: '没能识别文件编码。' };
  return { matrix: parseCsv(text, detectDelimiter(text)) };
}

/**
 * Parse a WeChat or Alipay export.
 * source: 'wechat' | 'alipay' — used for default payment method.
 * existing: records already on the device, for duplicate detection.
 */
export async function parseBillBuffer(buffer, source, filename = '', existing = []) {
  if (buffer.byteLength > 20 * 1024 * 1024) {
    return { rows: [], error: '文件太大了，请缩短导出的时间范围。' };
  }
  const loaded = await loadMatrix(buffer, filename);
  if (loaded.error) return { rows: [], error: loaded.error };
  let parsed = null;
  const matrices = loaded.matrices || (loaded.matrix ? [loaded.matrix] : []);
  for (const matrix of matrices) {
    const rows = matrixToRows(matrix, source);
    if (rows && (!parsed || rows.length > parsed.length)) parsed = rows;
  }
  if (!parsed) {
    return { rows: [], error: '没有识别到表头。请用「用于个人对账」导出 csv 或 xlsx，不要选证明材料 PDF。' };
  }
  if (!parsed.length) return { rows: [], error: '表格里没有可以导入的交易。' };
  return { rows: applyDuplicateFlags(parsed, existing), error: '' };
}
