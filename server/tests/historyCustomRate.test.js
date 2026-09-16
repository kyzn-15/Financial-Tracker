import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectStoredExpenseAmount } from '../../client/src/utils/historyAmount.js';

test('history display uses stored counterpart amounts, not a live rate', () => {
  const customKurs = 3210;
  const liveRate = 4500;
  const priceMyr = 18.4;
  const expense = {
    price_myr: priceMyr,
    price_idr: priceMyr * customKurs,
  };

  assert.notEqual(customKurs, liveRate);
  assert.equal(selectStoredExpenseAmount(expense, 'IDR'), expense.price_idr);
  assert.notEqual(selectStoredExpenseAmount(expense, 'IDR'), expense.price_myr * liveRate);
  assert.equal(selectStoredExpenseAmount(expense, 'MYR'), expense.price_myr);
});
