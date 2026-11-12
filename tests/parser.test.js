import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBillBuffer, parseCsv, matrixToRows } from '../js/import-parse.js';

function buf(path) {
  const b = readFileSync(new URL(path, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function byId(rows, id) {
  return rows.find((r) => r.txId === id);
}

test('wechat csv skips the preamble and maps columns by header name', async () => {
  const text = new TextDecoder('utf-8').decode(readFileSync(new URL('../samples/wechat.csv', import.meta.url)));
  const headerAt = text.split(/\n/).findIndex((line) => line.includes('交易时间'));
  assert.ok(headerAt >= 16, `header row was ${headerAt}`);
  const { rows, error } = await parseBillBuffer(buf('../samples/wechat.csv'), 'wechat', '微信支付账单.csv');
  assert.equal(error, '');
  const lunch = byId(rows, 'TX100');
  assert.equal(lunch.cents, 1600);
  assert.equal(lunch.type, 'expense');
  assert.equal(lunch.categoryName, '餐饮');
  assert.equal(lunch.payMethod, 'wechat');
  assert.equal(lunch.date, '2026-11-12');
  assert.equal(lunch.time.slice(0, 5), '12:30');
  assert.equal(lunch.checked, true);

  const movie = byId(rows, 'TX102');
  assert.equal(movie.product, '电影票,学生场');
  assert.equal(movie.cents, 5000);
  assert.equal(movie.categoryName, '娱乐');
  assert.equal(movie.payMethod, 'card');

  const dupId = rows.filter((r) => r.txId === 'TX103');
  assert.equal(dupId.length, 2);
  assert.equal(dupId[0].checked, true);
  assert.ok(dupId[1].flags.includes('duplicate'));
  assert.equal(dupId[1].checked, false);

  const metro = rows.filter((r) => r.txId === 'TX104' || r.txId === 'TX105');
  assert.equal(metro[0].categoryName, '交通');
  assert.equal(metro[0].cents, 400);
  assert.ok(metro[1].flags.includes('duplicate'));

  const refund = byId(rows, 'TX106');
  assert.equal(refund.type, 'income');
  assert.ok(refund.flags.includes('refund'));
  assert.equal(refund.checked, false);

  const cashout = byId(rows, 'TX107');
  assert.ok(cashout.flags.includes('neutral'));
  assert.equal(cashout.checked, false);

  const transfer = byId(rows, 'TX108');
  assert.ok(transfer.flags.includes('transfer'));
  assert.equal(transfer.checked, false);
  assert.equal(transfer.status.includes('转账') || transfer.kind.includes('转账'), true);

  const failed = byId(rows, 'TX109');
  assert.ok(failed.flags.includes('failed'));
  assert.equal(failed.categoryName, '学习');
  assert.equal(failed.checked, false);

  assert.equal(byId(rows, 'TX110').categoryName, '交通');
  assert.equal(byId(rows, 'TX110').cents, 2250);
  assert.equal(byId(rows, 'TX111').categoryName, '红包');
  assert.equal(byId(rows, 'TX111').type, 'income');
  assert.equal(byId(rows, 'TX111').checked, true);
  assert.equal(byId(rows, 'TX112').cents, 150000);
  assert.equal(byId(rows, 'TX112').categoryName, '奖助学金');

  const coffee = byId(rows, 'TX113');
  assert.equal(coffee.cents, 1250);
  assert.equal(coffee.categoryName, '餐饮');
  assert.equal(coffee.counterparty, '瑞幸咖啡');
});

test('existing transaction id or same amount and time is a duplicate', async () => {
  const { rows } = await parseBillBuffer(buf('../samples/wechat.csv'), 'wechat', 'a.csv', [
    { externalId: 'TX100', amount: 1600, date: '2026-11-12', time: '12:30', type: 'expense' },
    { externalId: '', amount: 1800, date: '2026-11-12', time: '15:10', type: 'expense' },
  ]);
  assert.ok(byId(rows, 'TX100').flags.includes('duplicate'));
  assert.ok(byId(rows, 'TX101').flags.includes('duplicate'));
  assert.equal(byId(rows, 'TX102').flags.includes('duplicate'), false);
});

test('alipay gbk csv uses header names and keyword categories', async () => {
  const { rows, error } = await parseBillBuffer(buf('../samples/alipay.csv'), 'alipay', 'alipay.csv');
  assert.equal(error, '');
  const metro = rows.find((r) => r.txId === 'ALI001');
  assert.equal(metro.categoryName, '交通');
  assert.equal(metro.cents, 300);
  assert.equal(metro.payMethod, 'alipay');
  assert.equal(metro.counterparty, '大连地铁');
  const food = rows.find((r) => r.txId === 'ALI002' && !r.flags.includes('duplicate'));
  assert.equal(food.cents, 1881);
  assert.equal(food.categoryName, '餐饮');
  assert.equal(food.payMethod, 'alipay');
  assert.equal(rows.filter((r) => r.txId === 'ALI002')[1].flags.includes('duplicate'), true);
  assert.ok(rows.find((r) => r.txId === 'ALI003').flags.includes('transfer'));
  assert.ok(rows.find((r) => r.txId === 'ALI004').flags.includes('neutral'));
  const refund = rows.find((r) => r.txId === 'ALI005');
  assert.equal(refund.type, 'income');
  assert.ok(refund.flags.includes('refund'));
  assert.equal(refund.checked, false);
  assert.ok(rows.find((r) => r.txId === 'ALI006').flags.includes('failed'));
  assert.equal(rows.find((r) => r.txId === 'ALI008').categoryName, '学习');
});

test('wechat xlsx reads shared strings, numbers, excel dates and long ids', async () => {
  const { rows, error } = await parseBillBuffer(buf('../samples/wechat.xlsx'), 'wechat', '账单.xlsx');
  assert.equal(error, '');
  const lunch = rows.find((r) => r.counterparty === '美团');
  assert.equal(lunch.cents, 1600);
  assert.equal(lunch.date, '2026-11-12');
  assert.equal(lunch.time.slice(0, 5), '12:30');
  assert.equal(lunch.categoryName, '餐饮');
  assert.equal(lunch.txId, '4200001700002303201406599120');
  const ride = rows.find((r) => r.counterparty === '滴滴出行');
  assert.equal(ride.date, '2026-11-01');
  assert.equal(ride.time, '08:15:00');
  assert.equal(ride.cents, 2250);
  assert.equal(ride.categoryName, '交通');
});

test('legacy alipay headers and shuffled columns are detected by name', () => {
  const legacy = [
    '支付宝交易记录明细查询',
    '账号:[a@b.c]',
    '---------------------------------交易记录明细列表------------------------------------',
    '交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态',
    '20261102001,T1,2026-11-02 09:23:11,2026-11-02 09:23:13,2026-11-02 09:23:13,支付宝,即时到账,美团,美团外卖订单,38.50,支出,交易成功,0.00,0.00,,已支出',
    '20261102002,T2,2026-11-01 10:00:00,2026-11-01 10:00:02,2026-11-01 10:00:02,支付宝,即时到账,商家,已退款商品,20.00,支出,交易成功,0.00,20.00,,已支出',
  ].join('\n');
  const rows = matrixToRows(parseCsv(legacy), 'alipay');
  assert.equal(rows[0].date, '2026-11-02');
  assert.equal(rows[0].time, '09:23:13');
  assert.equal(rows[0].cents, 3850);
  assert.equal(rows[0].categoryName, '餐饮');
  assert.equal(rows[0].txId, '20261102001');
  assert.ok(rows[1].flags.includes('refund'));

  const shuffled = [
    '金额,交易对方,收/支,商品,交易时间,交易单号',
    '9.90,瑞幸咖啡,支出,拿铁,2026-11-03 08:00:00,ZX1',
  ].join('\n');
  const one = matrixToRows(parseCsv(shuffled), 'wechat');
  assert.equal(one[0].cents, 990);
  assert.equal(one[0].counterparty, '瑞幸咖啡');
  assert.equal(one[0].categoryName, '餐饮');
  assert.equal(one[0].txId, 'ZX1');
});

test('old xls and a file without a table are rejected', async () => {
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
  const bad = await parseBillBuffer(ole.buffer, 'wechat', 'a.xls');
  assert.match(bad.error, /xls/);
  const text = new TextEncoder().encode('你好，这不是账单\n');
  const none = await parseBillBuffer(text.buffer, 'alipay', 'note.csv');
  assert.match(none.error, /表头/);
});
