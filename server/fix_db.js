import Database from 'better-sqlite3';

const db = new Database('./db/tracker.db');

const fallbackRate = 4500;

console.log('Fixing expenses with missing exchange rates...');

const expenses = db.prepare('SELECT * FROM expenses WHERE exchange_rate_used IS NULL').all();

console.log(`Found ${expenses.length} expenses to fix.`);

const stmt = db.prepare(`
  UPDATE expenses
  SET price_myr = ?, price_idr = ?, exchange_rate_used = ?
  WHERE id = ?
`);

const updateMany = db.transaction((items) => {
  for (const item of items) {
    const cur = item.original_currency;
    let priceMyr, priceIdr;
    
    // We only know one price since it was not converted correctly. Let's find which one is not null.
    // However, if the API failed, the original route set price_myr=price if cur=MYR, else price_idr=price.
    // Let's rely on that.
    if (cur === 'MYR') {
      priceMyr = item.price_myr;
      priceIdr = item.price_myr * fallbackRate;
    } else {
      priceIdr = item.price_idr;
      priceMyr = item.price_idr / fallbackRate;
    }
    
    stmt.run(priceMyr, priceIdr, fallbackRate, item.id);
  }
});

updateMany(expenses);

console.log('Database fix complete.');
db.close();
