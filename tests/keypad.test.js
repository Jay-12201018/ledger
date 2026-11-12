import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyKeypad, pressKey, commitCents, keypadFromCents } from '../js/keypad.js';
import { parseAmountToCents } from '../js/money.js';

function type(keys, start = emptyKeypad()) {
  return keys.reduce((s, k) => pressKey(s, k), start);
}

test('digits become cents', () => {
  assert.equal(commitCents(type(['1', '6'])), 1600);
  assert.equal(commitCents(type(['1', '6', '.', '5'])), 1650);
  assert.equal(commitCents(type(['0', '.', '1'])), 10);
});

test('addition and subtraction are left to right', () => {
  assert.equal(commitCents(type(['1', '0', '+', '6'])), 1600);
  assert.equal(commitCents(type(['2', '0', '-', '4'])), 1600);
  assert.equal(commitCents(type(['1', '+', '2', '+', '3'])), 600);
});

test('two decimal places and leading zeros', () => {
  const s = type(['1', '.', '2', '5', '9']);
  assert.equal(s.current, '1.25');
  assert.equal(commitCents(type(['0', '0', '8'])), 800);
  assert.equal(type(['0', '0']).current, '0');
});

test('backspace and negative result', () => {
  const s = type(['1', '6', 'back']);
  assert.equal(s.current, '1');
  assert.equal(commitCents(type(['5', '-', '1', '0'])), null);
  assert.equal(commitCents(emptyKeypad()), null);
});

test('0.1 + 0.2 is 30 cents, and decimal amounts do not drift', () => {
  assert.equal(commitCents(type(['0', '.', '1', '+', '0', '.', '2'])), 30);
  assert.equal(parseAmountToCents(0.1 + 0.2), 30);
  assert.equal(parseAmountToCents(1.15), 115);
  assert.equal(parseAmountToCents(8.7), 870);
  assert.equal(parseAmountToCents(19.99), 1999);
  assert.equal(parseAmountToCents(1.005), 101);
  assert.equal(parseAmountToCents('19.99'), 1999);
});

test('edit starts from existing cents', () => {
  assert.equal(commitCents(keypadFromCents(1650)), 1650);
  assert.equal(keypadFromCents(1600).current, '16');
  assert.equal(keypadFromCents(10).current, '0.1');
});
