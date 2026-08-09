import assert from 'node:assert/strict';
import test from 'node:test';
import { isSupportedReceipt, nowUTC8 } from './utils.js';

test('uses the server timestamp format and only accepts receipt formats the server supports', () => {
  assert.match(nowUTC8(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  assert.equal(isSupportedReceipt('image/jpeg'), true);
  assert.equal(isSupportedReceipt('image/avif'), false);
});
