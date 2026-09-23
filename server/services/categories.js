import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { ownerClause } from '../utils/ownership.js';

function parseEssentialCategories(value) {
  if (!value) return [];
  try {
    const categories = JSON.parse(value);
    return Array.isArray(categories) ? categories.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function getEmergencyCategoryNames(userId = null) {
  const owner = userId == null
    ? { sql: 'id = 1', args: [] }
    : { sql: 'user_id = ?', args: [userId] };
  const result = await db.execute({
    sql: `SELECT essential_categories FROM emergency_settings WHERE ${owner.sql}`,
    args: owner.args,
  });
  return parseEssentialCategories(result.rows[0]?.essential_categories);
}

export async function listCategories(userId = null) {
  const result = await db.execute({
    sql: `SELECT categories.id,
                 categories.name,
                 categories.sort_order,
                 COALESCE(category_automation_settings.enabled, 0) AS automation_enabled,
                 COALESCE(category_automation_settings.frequency, 'monthly') AS automation_frequency,
                 COUNT(expenses.id) AS usage_count
          FROM categories
          LEFT JOIN category_automation_settings ON category_automation_settings.category_id = categories.id
          LEFT JOIN expenses
            ON expenses.category = categories.name COLLATE NOCASE
           AND expenses.deleted_at IS NULL${userId == null ? '' : ' AND expenses.user_id = categories.user_id'}
          ${userId == null ? '' : 'WHERE categories.user_id = ?'}
          GROUP BY categories.id, categories.name, categories.sort_order, category_automation_settings.enabled, category_automation_settings.frequency
          ORDER BY categories.sort_order ASC, categories.id ASC`,
    args: userId == null ? [] : [userId],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    sort_order: Number(row.sort_order),
    usage_count: Number(row.usage_count),
    automation_enabled: Boolean(row.automation_enabled),
    automation_frequency: row.automation_frequency,
  }));
}

export async function createCategory(name, userId = null) {
  const owner = ownerClause(userId);
  const duplicate = await db.execute({
    sql: `SELECT id FROM categories WHERE name = ? COLLATE NOCASE${owner.sql}`,
    args: [name, ...owner.args],
  });
  if (duplicate.rows.length > 0) {
    const error = new Error('A category with that name already exists.');
    error.statusCode = 409;
    throw error;
  }

  const orderResult = await db.execute({
    sql: `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM categories${userId == null ? '' : ' WHERE user_id = ?'}`,
    args: owner.args,
  });
  const enabled = ['rent', 'subscription', 'insurance'].includes(name.toLowerCase()) ? 1 : 0;
  await db.batch([
    userId == null
      ? { sql: 'INSERT INTO categories (name, sort_order) VALUES (?, ?)', args: [name, Number(orderResult.rows[0].next_order)] }
      : { sql: 'INSERT INTO categories (user_id, name, sort_order) VALUES (?, ?, ?)', args: [userId, name, Number(orderResult.rows[0].next_order)] },
    {
      sql: `INSERT INTO category_automation_settings (category_id, enabled, frequency, updated_at)
            VALUES (last_insert_rowid(), ?, 'monthly', ?)`,
      args: [enabled, nowUTC8()],
    },
  ], 'write');
}

export async function renameCategory(id, name, userId = null) {
  const owner = ownerClause(userId);
  const categoryResult = await db.execute({
    sql: `SELECT name FROM categories WHERE id = ?${owner.sql}`,
    args: [id, ...owner.args],
  });
  const category = categoryResult.rows[0];
  if (!category) return false;

  const duplicate = await db.execute({
    sql: `SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?${owner.sql}`,
    args: [name, id, ...owner.args],
  });
  if (duplicate.rows.length > 0) {
    const error = new Error('A category with that name already exists.');
    error.statusCode = 409;
    throw error;
  }

  const essentialCategories = await getEmergencyCategoryNames(userId);
  const renamedEssentialCategories = [...new Set(essentialCategories.map((item) => (
    item.localeCompare(category.name, undefined, { sensitivity: 'accent' }) === 0 ? name : item
  )))];

  const emergencyWhere = userId == null ? 'id = 1' : 'user_id = ?';
  await db.batch([
    { sql: `UPDATE categories SET name = ? WHERE id = ?${owner.sql}`, args: [name, id, ...owner.args] },
    { sql: `UPDATE expenses SET category = ? WHERE category = ? COLLATE NOCASE${owner.sql}`, args: [name, category.name, ...owner.args] },
    { sql: `UPDATE recurring_expense_rules SET category = ?, updated_at = ? WHERE category = ? COLLATE NOCASE${owner.sql}`, args: [name, nowUTC8(), category.name, ...owner.args] },
    {
      sql: `UPDATE emergency_settings SET essential_categories = ?, updated_at = ? WHERE ${emergencyWhere}`,
      args: userId == null
        ? [JSON.stringify(renamedEssentialCategories), nowUTC8()]
        : [JSON.stringify(renamedEssentialCategories), nowUTC8(), userId],
    },
  ], 'write');
  return true;
}

export async function deleteCategory(id, userId = null) {
  const categories = await listCategories(userId);
  if (categories.length <= 1) {
    const error = new Error('At least one category must remain.');
    error.statusCode = 400;
    throw error;
  }

  const category = categories.find((item) => item.id === id);
  if (!category) return false;

  const essentialCategories = await getEmergencyCategoryNames(userId);
  const remainingEssentialCategories = essentialCategories.filter((item) => (
    item.localeCompare(category.name, undefined, { sensitivity: 'accent' }) !== 0
  ));
  const owner = ownerClause(userId);
  const emergencyWhere = userId == null ? 'id = 1' : 'user_id = ?';

  await db.batch([
    { sql: 'DELETE FROM category_automation_settings WHERE category_id = ?', args: [id] },
    { sql: `UPDATE recurring_expense_rules SET status = 'cancelled', updated_at = ? WHERE category = ? COLLATE NOCASE AND status <> 'cancelled'${owner.sql}`, args: [nowUTC8(), category.name, ...owner.args] },
    { sql: `DELETE FROM categories WHERE id = ?${owner.sql}`, args: [id, ...owner.args] },
    {
      sql: `UPDATE emergency_settings SET essential_categories = ?, updated_at = ? WHERE ${emergencyWhere}`,
      args: userId == null
        ? [JSON.stringify(remainingEssentialCategories), nowUTC8()]
        : [JSON.stringify(remainingEssentialCategories), nowUTC8(), userId],
    },
  ], 'write');
  return true;
}

export async function updateCategoryAutomation(id, enabled, frequency, userId = null) {
  const owner = ownerClause(userId);
  const category = await db.execute({ sql: `SELECT id FROM categories WHERE id = ?${owner.sql}`, args: [id, ...owner.args] });
  if (category.rows.length === 0) return false;

  await db.execute({
    sql: `INSERT INTO category_automation_settings (category_id, enabled, frequency, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(category_id) DO UPDATE SET enabled = excluded.enabled, frequency = excluded.frequency, updated_at = excluded.updated_at`,
    args: [id, enabled ? 1 : 0, frequency, nowUTC8()],
  });
  return true;
}

export async function reorderCategories(ids, userId = null) {
  const categories = await listCategories(userId);
  const existingIds = categories.map((category) => category.id).sort((a, b) => a - b);
  const submittedIds = [...ids].sort((a, b) => a - b);
  const containsEveryCategory = existingIds.length === submittedIds.length
    && existingIds.every((id, index) => id === submittedIds[index]);

  if (!containsEveryCategory) {
    const error = new Error('The category order must include every category exactly once.');
    error.statusCode = 400;
    throw error;
  }

  const owner = ownerClause(userId);
  await db.batch(ids.map((id, index) => ({
    sql: `UPDATE categories SET sort_order = ? WHERE id = ?${owner.sql}`,
    args: [index + 1, id, ...owner.args],
  })), 'write');
}
