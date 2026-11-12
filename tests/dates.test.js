import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isoDate, startOfWeek, monthBounds, periodOf, excelSerialToParts, dateToExcelSerial,
} from '../js/dates.js';

test('weeks run Monday through Sunday', () => {
  const thu = new Date(2026, 10, 12);
  const start = startOfWeek(thu);
  assert.equal(isoDate(start), '2026-11-09');
  const period = periodOf('week', '2026-11-12');
  assert.equal(period.startISO, '2026-11-09');
  assert.equal(period.endISO, '2026-11-15');
  assert.match(period.label, /11月9日/);
});

test('weeks can cross the new year and months end on the last day', () => {
  const first = periodOf('week', '2026-01-01');
  assert.equal(first.startISO, '2025-12-29');
  assert.equal(first.endISO, '2026-01-04');
  const last = periodOf('week', '2026-12-31');
  assert.equal(last.startISO, '2026-12-28');
  assert.equal(last.endISO, '2027-01-03');
  assert.equal(monthBounds(2026, 2).endISO, '2026-02-28');
  assert.equal(monthBounds(2026, 11).startISO, '2026-11-01');
  assert.equal(monthBounds(2026, 11).endISO, '2026-11-30');
});

test('sunday belongs to the week that started monday', () => {
  const period = periodOf('week', '2026-11-15');
  assert.equal(period.startISO, '2026-11-09');
});

test('months cover the 1st through the last day', () => {
  assert.equal(monthBounds(2026, 11).days, 30);
  assert.equal(monthBounds(2026, 11).startISO, '2026-11-01');
  assert.equal(monthBounds(2026, 11).endISO, '2026-11-30');
  assert.equal(monthBounds(2024, 2).days, 29);
  assert.equal(monthBounds(2026, 2).days, 28);
  const month = periodOf('month', '2026-11-12');
  assert.equal(month.startISO, '2026-11-01');
  assert.equal(month.endISO, '2026-11-30');
});

test('excel serial epoch', () => {
  assert.deepEqual(excelSerialToParts(25569), { date: '1970-01-01', time: '' });
  assert.equal(excelSerialToParts(25569.5).time, '12:00:00');
  const serial = dateToExcelSerial(2026, 11, 1, 8, 15, 0);
  const parts = excelSerialToParts(serial);
  assert.equal(parts.date, '2026-11-01');
  assert.equal(parts.time, '08:15:00');
});
