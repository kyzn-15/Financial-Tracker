import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';

const VALID_INTERVALS = [1, 14, 30];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isReminderDue(lastBackupAt, intervalDays) {
  if (!lastBackupAt) return true;
  const lastBackupTime = new Date(lastBackupAt).getTime();
  return !Number.isFinite(lastBackupTime) || Date.now() >= lastBackupTime + intervalDays * MS_PER_DAY;
}

function formatPreferences(row) {
  const reminderIntervalDays = VALID_INTERVALS.includes(Number(row.reminder_interval_days))
    ? Number(row.reminder_interval_days)
    : 30;

  return {
    reminder_interval_days: reminderIntervalDays,
    last_backup_at: row.last_backup_at || null,
    reminder_due: isReminderDue(row.last_backup_at, reminderIntervalDays),
  };
}

export async function getBackupPreferences(username) {
  let result = await db.execute({
    sql: 'SELECT reminder_interval_days, last_backup_at FROM backup_preferences WHERE username = ?',
    args: [username],
  });

  if (!result.rows[0]) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO backup_preferences (username, reminder_interval_days, last_backup_at, updated_at)
            VALUES (?, 30, NULL, ?)`,
      args: [username, nowUTC8()],
    });
    result = await db.execute({
      sql: 'SELECT reminder_interval_days, last_backup_at FROM backup_preferences WHERE username = ?',
      args: [username],
    });
  }

  return formatPreferences(result.rows[0]);
}

export async function updateBackupReminderInterval(username, reminderIntervalDays) {
  const interval = Number(reminderIntervalDays);
  if (!VALID_INTERVALS.includes(interval)) {
    throw Object.assign(new Error('reminder_interval_days must be 1, 14, or 30'), { statusCode: 400 });
  }

  await getBackupPreferences(username);
  await db.execute({
    sql: `UPDATE backup_preferences
          SET reminder_interval_days = ?, updated_at = ?
          WHERE username = ?`,
    args: [interval, nowUTC8(), username],
  });

  return getBackupPreferences(username);
}

export async function recordBackup(username) {
  await getBackupPreferences(username);
  const backupTime = nowUTC8();
  await db.execute({
    sql: `UPDATE backup_preferences
          SET last_backup_at = ?, updated_at = ?
          WHERE username = ?`,
    args: [backupTime, backupTime, username],
  });

  return getBackupPreferences(username);
}

export async function resetLastBackup(username) {
  await getBackupPreferences(username);
  await db.execute({
    sql: `UPDATE backup_preferences
          SET last_backup_at = NULL, updated_at = ?
          WHERE username = ?`,
    args: [nowUTC8(), username],
  });

  return getBackupPreferences(username);
}
