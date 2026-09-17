import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOLDER_NAME_DISPLAY_MAX, NEW_FOLDER_VALUE, folderSelectAfterChange, truncateFolderName } from '../../client/src/utils/folderSelect.js';
import { unfilteredExpenseQuery } from '../../client/src/utils/expenseQueries.js';

test('leaving New folder clears creating even when picking the current folder', () => {
  const stayOnCurrent = folderSelectAfterChange(4, '4');
  assert.equal(stayOnCurrent.creating, false);
  assert.equal(stayOnCurrent.nextId, 4);
  assert.equal(stayOnCurrent.shouldAssign, false);

  const ungroup = folderSelectAfterChange(4, '');
  assert.equal(ungroup.creating, false);
  assert.equal(ungroup.nextId, null);
  assert.equal(ungroup.shouldAssign, true);

  const move = folderSelectAfterChange(4, '9');
  assert.equal(move.creating, false);
  assert.equal(move.nextId, 9);
  assert.equal(move.shouldAssign, true);
});

test('choosing New folder enters create mode without assigning', () => {
  const next = folderSelectAfterChange(null, NEW_FOLDER_VALUE);
  assert.equal(next.creating, true);
  assert.equal('shouldAssign' in next, false);
});

test('settings expense query does not carry history filters', () => {
  const query = unfilteredExpenseQuery();
  assert.equal('name' in query, false);
  assert.equal('category' in query, false);
  assert.equal('folderId' in query, false);
  assert.equal('startDate' in query, false);
  assert.equal('endDate' in query, false);
  assert.equal(query.sort, 'timestamp');
  assert.equal(query.order, 'desc');
});

test('long folder names are truncated with an ellipsis for the dropdown', () => {
  const shortName = 'Trip';
  assert.equal(truncateFolderName(shortName), shortName);

  const longName = 'Malaysian Day Trip Awesome Adventure';
  const truncated = truncateFolderName(longName);
  assert.equal(truncated.endsWith('...'), true);
  assert.equal(truncated, `${longName.slice(0, FOLDER_NAME_DISPLAY_MAX).trimEnd()}...`);
  assert.equal(truncated.includes(longName), false);
});

test('leaving New folder for No folder ungroups when currently assigned', () => {
  const fromAssigned = folderSelectAfterChange(2, '');
  assert.equal(fromAssigned.creating, false);
  assert.equal(fromAssigned.nextId, null);
  assert.equal(fromAssigned.shouldAssign, true);

  const alreadyUngrouped = folderSelectAfterChange(null, '');
  assert.equal(alreadyUngrouped.creating, false);
  assert.equal(alreadyUngrouped.nextId, null);
  assert.equal(alreadyUngrouped.shouldAssign, false);
});
