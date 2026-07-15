import './config/env.js';
import db from './db/database.js';

const fallbackRate = 4500;

console.log('Fixing expenses with missing exchange rates...');

const result = await db.execute({
  sql: 'SELECT * FROM expenses WHERE exchange_rate_used IS NULL',
  args: [],
});
const expenses = result.rows;

console.log(`Found ${expenses.length} expenses to fix.`);

const updates = expenses.map((item) => {
  const isMyr = item.original_currency === 'MYR';
  const priceMyr = isMyr ? item.price_myr : item.price_idr / fallbackRate;
  const priceIdr = isMyr ? item.price_myr * fallbackRate : item.price_idr;

  return {
    sql: `UPDATE expenses
          SET price_myr = ?, price_idr = ?, exchange_rate_used = ?
          WHERE id = ?`,
    args: [priceMyr, priceIdr, fallbackRate, item.id],
  };
});

if (updates.length > 0) {
  await db.batch(updates, 'write');
}

console.log('Database fix complete.');
db.close();
