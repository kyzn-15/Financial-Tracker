import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertAmountForSwap, convertExpenseAmounts, invertKursQuote, toMyrToIdrKurs } from '../utils/currency.js';

test('MYR↔IDR conversion uses the kurs identity in both directions', () => {
  const kurs = 4127.25;
  const myrAmount = 18.4;

  const fromMyr = convertExpenseAmounts(myrAmount, 'MYR', kurs);
  assert.equal(fromMyr.exchangeRateUsed, kurs);
  assert.equal(fromMyr.priceMyr, myrAmount);
  assert.equal(fromMyr.priceIdr, myrAmount * kurs);

  const fromIdr = convertExpenseAmounts(fromMyr.priceIdr, 'IDR', kurs);
  assert.equal(fromIdr.exchangeRateUsed, kurs);
  assert.equal(fromIdr.priceIdr, fromMyr.priceIdr);
  assert.equal(fromIdr.priceMyr, fromMyr.priceIdr / kurs);
});

test('swap converts the visible amount with the same identity', () => {
  const kurs = 4127.25;
  const myrAmount = 18.4;
  const idrAmount = convertAmountForSwap(myrAmount, 'MYR', 'IDR', kurs);
  assert.equal(idrAmount, myrAmount * kurs);
  assert.equal(convertAmountForSwap(idrAmount, 'IDR', 'MYR', kurs), myrAmount);
  assert.equal(convertAmountForSwap(myrAmount, 'MYR', 'MYR', kurs), myrAmount);
});

test('kurs quote swap inverts with 1/Y in both directions', () => {
  const idrToMyr = 0.00023;
  const myrToIdr = invertKursQuote(idrToMyr);
  assert.equal(myrToIdr, 1 / idrToMyr);
  assert.equal(invertKursQuote(myrToIdr), 1 / myrToIdr);
  assert.equal(toMyrToIdrKurs(idrToMyr, 'IDR_MYR'), 1 / idrToMyr);
  assert.equal(toMyrToIdrKurs(myrToIdr, 'MYR_IDR'), myrToIdr);
});
