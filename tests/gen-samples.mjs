import { deflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dateToExcelSerial } from '../js/dates.js';

mkdirSync(new URL('../samples/', import.meta.url), { recursive: true });

function csvEscape(value) {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvLine(cols) {
  return cols.map(csvEscape).join(',');
}

const header = ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号', '商户单号', '备注'];
const wechatRows = [
  ['2026-11-12 12:30:00', '商户消费', '美团', '食堂午餐', '支出', '¥16.00', '零钱', '支付成功', 'TX100', 'M100', '/'],
  ['2026-11-12 15:10:00', '商户消费', '喜茶', '多肉葡萄', '支出', '¥18.00', '零钱', '支付成功', 'TX101', 'M101', '/'],
  ['2026-11-12 19:20:00', '商户消费', '万达影城', '电影票,学生场', '支出', '¥50.00', '招商银行储蓄卡(8899)', '支付成功', 'TX102', 'M102', '/'],
  ['2026-11-11 12:40:00', '商户消费', '海底捞', '火锅AA', '支出', '¥68.00', '零钱', '支付成功', 'TX103', 'M103', '/'],
  ['2026-11-11 12:40:00', '商户消费', '海底捞', '火锅AA', '支出', '¥68.00', '零钱', '支付成功', 'TX103', 'M103', '/'],
  ['2026-11-11 21:05:00', '商户消费', '北京地铁', '地铁出行', '支出', '¥4.00', '零钱', '支付成功', 'TX104', 'M104', '/'],
  ['2026-11-11 21:05:00', '商户消费', '北京地铁', '地铁出行', '支出', '¥4.00', '零钱', '支付成功', 'TX105', 'M105', '/'],
  ['2026-11-09 14:02:00', '退款', '喜茶', '退款-错付奶茶', '收入', '¥16.00', '零钱', '已退款', 'TX106', 'M106', '/'],
  ['2026-11-08 10:00:00', '提现', '零钱提现', '/', '不计收支', '¥200.00', '招商银行储蓄卡(8899)', '提现已到账', 'TX107', 'M107', '/'],
  ['2026-11-08 09:00:00', '转账', '同学', '转账备注:AA', '支出', '¥30.00', '零钱', '已转账', 'TX108', 'M108', '/'],
  ['2026-11-07 18:00:00', '商户消费', '打印店', '打印讲义', '支出', '¥8.00', '零钱', '支付失败', 'TX109', 'M109', '/'],
  ['2026-11-06 11:00:00', '商户消费', '滴滴出行', '快车', '支出', '¥22.50', '零钱', '支付成功', 'TX110', 'M110', '/'],
  ['2026-11-05 20:00:00', '微信红包', '妈妈', '微信红包', '收入', '¥200.00', '零钱', '已存入零钱', 'TX111', 'M111', '/'],
  ['2026-11-04 09:00:00', '其他', '学校', '奖学金', '收入', '¥1,500.00', '零钱', '已存入零钱', 'TX112', 'M112', '/'],
];

const preamble = [
  '微信支付账单明细',
  '微信昵称：[示例同学]',
  '起始时间：[2026-11-01 00:00:00] 终止时间：[2026-11-12 23:59:59]',
  '导出类型：[全部]',
  '导出时间：[2026-11-12 21:00:00]',
  '',
  '共14笔记录',
  '收入：2笔 1700.00元',
  '支出：10笔 232.50元',
  '中性交易：1笔 200.00元',
  '注：',
  '1. 充值/提现/理财通购买/零钱通存取/信用卡还款等交易，将计入中性交易',
  '2. 本明细仅展示当前账单中的交易，不包括已删除的记录',
  '3. 本明细仅供个人对账使用',
  '',
  '----------------------微信支付账单明细列表--------------------',
];

const backtick = ['2026-11-03 08:00:00', '商户消费', '瑞幸咖啡', '拿铁', '支出', '¥12.50', '零钱', '支付成功', 'TX113', 'M113', '/']
  .map((v) => `\`${v}`).join(',');

const wechat = `\uFEFF${preamble.join('\n')}\n${csvLine(header)}\n${wechatRows.map(csvLine).join('\n')}\n${backtick}\n`;
writeFileSync(new URL('../samples/wechat.csv', import.meta.url), wechat);

const aliHeader = ['交易时间', '交易分类', '交易对方', '对方账号', '商品说明', '收/支', '金额', '收/付款方式', '交易状态', '交易订单号', '商家订单号', '备注'];
const aliRows = [
  ['2026-11-02 08:40:44', '交通出行', '大连地铁', 'dt@example.com', '公交-地铁', '支出', '3.00', '余额宝', '交易成功', 'ALI001', 'S001', ''],
  ['2026-11-02 12:00:00', '餐饮美食', '美团', 'mt@example.com', '外卖订单', '支出', '18.81', '花呗', '交易成功', 'ALI002', 'S002', ''],
  ['2026-11-01 09:00:00', '转账红包', '张三', 'zs@example.com', '转账', '支出', '50.00', '账户余额', '交易成功', 'ALI003', 'S003', ''],
  ['2026-10-30 10:00:00', '投资理财', '余额宝', 'yeb@example.com', '收益发放', '不计收支', '0.83', '余额宝', '交易成功', 'ALI004', 'S004', ''],
  ['2026-10-29 15:00:00', '餐饮美食', '喜茶', 'xc@example.com', '退款-错付奶茶', '收入', '16.00', '余额宝', '退款成功', 'ALI005', 'S005', ''],
  ['2026-10-28 11:00:00', '日用百货', '便利店', 'shop@example.com', '日用品', '支出', '20.00', '账户余额', '交易关闭', 'ALI006', 'S006', ''],
  ['2026-11-02 12:00:01', '餐饮美食', '美团', 'mt@example.com', '外卖订单', '支出', '18.81', '花呗', '交易成功', 'ALI002', 'S002', ''],
  ['2026-10-27 19:00:00', '教育培训', '得到', 'dd@example.com', '课程', '支出', '99.00', '花呗', '交易成功', 'ALI008', 'S008', ''],
];
const aliPreamble = [
  '支付宝交易记录明细查询',
  '账号:[student@example.com]',
  '起始日期:[2026-10-01 00:00:00]    终止日期:[2026-11-12 23:59:59]',
  '------------------------------------',
  '导出信息：',
  '姓名：示例同学',
  '支付宝账户：138****0000',
  '起始时间：[2026-10-01 00:00:00] 终止时间：[2026-11-12 23:59:59]',
  '导出交易类型：[全部]',
  '导出时间：[2026-11-12 21:08:00]',
  '共8笔记录',
  '收入：1笔 16.00元',
  '支出：6笔 209.81元',
  '不计收支：1笔 0.83元',
  '',
  '特别提示：',
  '1.本回单仅供个人对账使用；',
  '2.部分账单如充值提现、账户转存不计入收入或支出，记为不计收支；',
  '3.请勿将本回单作为收款凭据；',
  '4.本明细不包括已删除的记录；',
  '5.因统计逻辑不同，明细累加可能和汇总不一致；',
  '6.禁止将本回单用于非法用途；',
  '7.退款成功的记录请单独确认后再入账；',
  '8.文件编码为 GBK。',
  '',
  '------------------------支付宝（中国）网络技术有限公司 电子客户回单------------------------',
];
const aliText = `${aliPreamble.join('\r\n')}\r\n${csvLine(aliHeader)}\r\n${aliRows.map(csvLine).join('\r\n')}\r\n`;
execFileSync('python3', ['-c', `
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_bytes(sys.stdin.buffer.read().decode('utf-8').encode('gbk'))
`, new URL('../samples/alipay.csv', import.meta.url).pathname], { input: aliText });

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const data = Buffer.from(f.data);
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}

function colName(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const strings = [];
function sid(text) {
  const s = String(text);
  let i = strings.indexOf(s);
  if (i < 0) {
    strings.push(s);
    i = strings.length - 1;
  }
  return i;
}

const serial = dateToExcelSerial(2026, 11, 1, 8, 15, 0);
const longId = '4200001700002303201406599120';
const xHeader = ['金额(元)', '交易时间', '收/支', '交易对方', '商品', '交易类型', '当前状态', '支付方式', '交易单号'];
const xRows = [
  ['微信支付账单明细'],
  ['微信昵称：[示例]'],
  ['起始时间：[2026-11-01] 终止时间：[2026-11-12]'],
  xHeader,
  [16, '2026-11-12 12:30:00', '支出', '美团', '食堂午餐', '商户消费', '支付成功', '零钱', longId],
  [22.5, serial, '支出', '滴滴出行', '快车', '商户消费', '支付成功', '零钱', 'TX901'],
];

function cellXml(c, r, value) {
  const ref = `${colName(c)}${r}`;
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="s"><v>${sid(value)}</v></c>`;
}
const sheetRows = xRows.map((row, idx) => {
  const r = idx + 1;
  const cells = row.map((value, c) => cellXml(c, r, value)).join('');
  return `<row r="${r}">${cells}</row>`;
}).join('');
const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${xmlEscape(s)}</t></si>`).join('')}</sst>`;
const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="账单" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;

const xlsx = zipStore([
  { name: '[Content_Types].xml', data: types },
  { name: '_rels/.rels', data: rels },
  { name: 'xl/workbook.xml', data: workbook },
  { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
  { name: 'xl/sharedStrings.xml', data: sst },
  { name: 'xl/worksheets/sheet1.xml', data: sheet },
]);
writeFileSync(new URL('../samples/wechat.xlsx', import.meta.url), xlsx);
console.log('samples written', { serial, strings: strings.length, xlsx: xlsx.length });
