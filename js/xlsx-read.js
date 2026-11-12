/** Minimal xlsx reader: ZIP (store or deflate) + first sheet that looks like a table. No CDN. */

function findEOCD(bytes, view) {
  const start = Math.max(0, bytes.length - (22 + 65535));
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(data) {
  if (!data.byteLength) return new Uint8Array();
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEOCD(bytes, view);
  if (eocd < 0) throw new Error('bad zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map();
  let encrypted = false;
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) break;
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    if (flags & 1) encrypted = true;
    if (!encrypted && localOff + 30 < bytes.length && view.getUint32(localOff, true) === 0x04034b50) {
      const localNameLen = view.getUint16(localOff + 26, true);
      const localExtraLen = view.getUint16(localOff + 28, true);
      const dataOff = localOff + 30 + localNameLen + localExtraLen;
      const comp = bytes.slice(dataOff, dataOff + compSize);
      let data;
      if (method === 0) data = comp;
      else if (method === 8) data = await inflateRaw(comp);
      else throw new Error('bad method');
      files.set(name.replace(/^\//, ''), data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { files, encrypted };
}

function decodeXml(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const body = m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<phoneticPr\b[^>]*\/>/g, '');
    const texts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tRe.exec(body))) texts.push(decodeXml(t[1]));
    out.push(texts.join(''));
  }
  return out;
}

function colIndex(ref) {
  const letters = String(ref).match(/[A-Z]+/i);
  if (!letters) return null;
  let n = 0;
  for (const ch of letters[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseSheetMatrix(xml, shared) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    let seq = 0;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1];
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      let idx = ref ? colIndex(ref) : seq;
      if (idx == null) idx = seq;
      seq = idx + 1;
      let value = '';
      if (t === 'inlineStr') {
        const texts = [];
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tm;
        while ((tm = tRe.exec(inner))) texts.push(decodeXml(tm[1]));
        value = texts.join('');
      } else {
        const vm = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        if (vm) {
          const raw = decodeXml(vm[1].trim());
          if (t === 's') value = shared[Number(raw)] ?? '';
          else value = raw;
        }
      }
      cells[idx] = value;
    }
    const width = cells.length;
    const line = [];
    for (let i = 0; i < width; i += 1) line.push(cells[i] == null ? '' : String(cells[i]));
    rows.push(line);
  }
  return rows;
}

function findFile(files, suffix) {
  for (const [name, data] of files) {
    if (name === suffix || name.endsWith(`/${suffix}`) || name.endsWith(suffix)) return data;
  }
  return null;
}

export async function readXlsxMatrices(arrayBuffer) {
  const { files, encrypted } = await unzip(arrayBuffer);
  if (encrypted) {
    const err = new Error('encrypted');
    err.code = 'encrypted';
    throw err;
  }
  const sharedXml = findFile(files, 'xl/sharedStrings.xml');
  const shared = sharedXml ? parseSharedStrings(xmlText(sharedXml)) : [];
  const sheets = [];
  for (const [name, data] of files) {
    if (/xl\/worksheets\/sheet\d+\.xml$/i.test(name)) {
      sheets.push(parseSheetMatrix(xmlText(data), shared));
    }
  }
  const csvName = [...files.keys()].find((n) => /\.csv$/i.test(n));
  return {
    sheets,
    csvText: csvName ? new TextDecoder('utf-8').decode(files.get(csvName)) : '',
    isXlsx: sheets.length > 0 || !!findFile(files, 'xl/workbook.xml'),
  };
}
