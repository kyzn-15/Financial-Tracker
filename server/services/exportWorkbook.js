import ExcelJS from 'exceljs';
import db from '../db/database.js';
import { nowUTC8 } from '../utils/datetime.js';
import { isReceiptFilename, RECEIPT_MIME_TYPES } from '../utils/receiptFiles.js';

const BACKUP_FORMAT = 'financial-tracker-database-backup';
const BACKUP_VERSION = 1;
const MANIFEST_SHEET = '__Manifest';
const ROW_MARKER_COLUMN = '__backup_row__';
const BLOB_PREFIX = '__FINTRACKER_BLOB_BASE64__:';
const BIGINT_PREFIX = '__FINTRACKER_BIGINT__:';
const ESCAPED_TEXT_PREFIX = '__FINTRACKER_TEXT__:';
const MAX_TABLES = 100;
const MAX_COLUMNS_PER_TABLE = 16_000;
const MAX_ROWS_PER_TABLE = 1_000_000;
const MAX_TOTAL_IMPORT_CELLS = 1_000_000;
const INSERT_BATCH_SIZE = 250;
const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export class BackupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function schemaSignature(columns) {
  return columns.map((column) => ({
    name: column.name,
    type: column.type,
    notNull: column.notNull,
    primaryKey: column.primaryKey,
  }));
}

async function getDatabaseSchema() {
  const tablesResult = await db.execute({
    sql: `SELECT name
          FROM sqlite_schema
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
            AND sql IS NOT NULL
          ORDER BY name`,
    args: [],
  });

  if (tablesResult.rows.length > MAX_TABLES) {
    throw new Error(`Database has more than ${MAX_TABLES} application tables.`);
  }

  const tables = [];
  for (const tableRow of tablesResult.rows) {
    const tableName = String(tableRow.name);
    const columnsResult = await db.execute(`PRAGMA table_xinfo(${quoteIdentifier(tableName)})`);
    const foreignKeysResult = await db.execute(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`);
    const columns = columnsResult.rows
      .filter((column) => Number(column.hidden || 0) === 0)
      .map((column) => ({
        name: String(column.name),
        type: String(column.type || '').toUpperCase(),
        notNull: Number(column.notnull || 0) === 1,
        primaryKey: Number(column.pk || 0),
      }));

    if (columns.length === 0 || columns.length > MAX_COLUMNS_PER_TABLE) {
      throw new Error(`Table "${tableName}" has an unsupported column count.`);
    }

    tables.push({
      name: tableName,
      columns,
      parentTables: [...new Set(
        foreignKeysResult.rows
          .map((foreignKey) => String(foreignKey.table))
          .filter((parent) => parent && parent !== tableName)
      )],
    });
  }

  return tables;
}

function createWorksheetName(tableName, usedNames) {
  const sanitized = tableName.replace(/[\\/?*:[\]]/g, '_').replace(/^'+|'+$/g, '') || 'Table';
  const base = sanitized.slice(0, 31);
  let name = base;
  let suffix = 1;

  while (usedNames.has(name.toLowerCase())) {
    const tag = `_${suffix}`;
    name = `${base.slice(0, 31 - tag.length)}${tag}`;
    suffix += 1;
  }

  usedNames.add(name.toLowerCase());
  return name;
}

function encodeCellValue(value) {
  if (value == null) return null;
  if (typeof value === 'bigint') return `${BIGINT_PREFIX}${value}`;
  if (value instanceof ArrayBuffer) return `${BLOB_PREFIX}${Buffer.from(value).toString('base64')}`;
  if (ArrayBuffer.isView(value)) {
    return `${BLOB_PREFIX}${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64')}`;
  }
  if (typeof value === 'string' && (
    value.startsWith(BLOB_PREFIX) ||
    value.startsWith(BIGINT_PREFIX) ||
    value.startsWith(ESCAPED_TEXT_PREFIX) ||
    FORMULA_PREFIX_PATTERN.test(value)
  )) {
    return `${ESCAPED_TEXT_PREFIX}${value}`;
  }
  return value;
}

function styleDataSheet(sheet, visibleColumnCount) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 22;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: visibleColumnCount },
  };
  sheet.getColumn(visibleColumnCount + 1).hidden = true;
}

function buildManifestSheet(workbook, tableExports) {
  const sheet = workbook.addWorksheet(MANIFEST_SHEET);
  sheet.getCell('A1').value = 'format';
  sheet.getCell('B1').value = BACKUP_FORMAT;
  sheet.getCell('A2').value = 'format_version';
  sheet.getCell('B2').value = BACKUP_VERSION;
  sheet.getCell('A3').value = 'exported_at_utc8';
  sheet.getCell('B3').value = nowUTC8();
  sheet.getRow(5).values = ['Table', 'Worksheet', 'Columns JSON', 'Row Count'];

  tableExports.forEach((table, index) => {
    sheet.getRow(index + 6).values = [
      table.name,
      table.worksheetName,
      JSON.stringify(schemaSignature(table.columns)),
      table.rowCount,
    ];
  });

  sheet.columns = [
    { width: 34 },
    { width: 34 },
    { width: 90 },
    { width: 16 },
  ];
  sheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  sheet.views = [{ state: 'frozen', ySplit: 5 }];
}

export async function buildDatabaseExportWorkbook() {
  const schema = await getDatabaseSchema();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Financial Tracker';
  workbook.subject = BACKUP_FORMAT;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const usedNames = new Set([MANIFEST_SHEET.toLowerCase()]);
  const tableExports = [];

  for (const table of schema) {
    const worksheetName = createWorksheetName(table.name, usedNames);
    const columnSql = table.columns.map((column) => quoteIdentifier(column.name)).join(', ');
    const rowsResult = await db.execute({
      sql: `SELECT ${columnSql} FROM ${quoteIdentifier(table.name)}`,
      args: [],
    });

    if (rowsResult.rows.length > MAX_ROWS_PER_TABLE) {
      throw new Error(`Table "${table.name}" exceeds the Excel row limit.`);
    }

    const sheet = workbook.addWorksheet(worksheetName);
    sheet.columns = [
      ...table.columns.map((column) => ({
        header: column.name,
        width: Math.min(Math.max(column.name.length + 2, 14), 40),
      })),
      { header: ROW_MARKER_COLUMN, width: 2, hidden: true },
    ];

    rowsResult.rows.forEach((row, index) => {
      sheet.addRow([
        ...table.columns.map((column) => encodeCellValue(row[column.name])),
        index + 1,
      ]);
    });
    styleDataSheet(sheet, table.columns.length);
    tableExports.push({ ...table, worksheetName, rowCount: rowsResult.rows.length });
  }

  buildManifestSheet(workbook, tableExports);
  return workbook.xlsx.writeBuffer();
}

function requiredStringCell(sheet, address, label) {
  const value = sheet.getCell(address).value;
  if (typeof value !== 'string' || !value.trim()) {
    throw new BackupValidationError(`Backup manifest is missing ${label}.`);
  }
  return value;
}

function requiredIntegerCell(sheet, address, label, minimum = 0) {
  const value = Number(sheet.getCell(address).value);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new BackupValidationError(`Backup manifest has an invalid ${label}.`);
  }
  return value;
}

function parseManifest(workbook) {
  const sheet = workbook.getWorksheet(MANIFEST_SHEET);
  if (!sheet) {
    throw new BackupValidationError('This is not a Financial Tracker database backup: manifest worksheet not found.');
  }
  if (requiredStringCell(sheet, 'B1', 'format identifier') !== BACKUP_FORMAT) {
    throw new BackupValidationError('This workbook was not created by the Financial Tracker database exporter.');
  }
  if (requiredIntegerCell(sheet, 'B2', 'format version', 1) !== BACKUP_VERSION) {
    throw new BackupValidationError('This backup version is not supported by the current app.');
  }

  const expectedHeaders = ['Table', 'Worksheet', 'Columns JSON', 'Row Count'];
  expectedHeaders.forEach((header, index) => {
    if (sheet.getCell(5, index + 1).value !== header) {
      throw new BackupValidationError('Backup manifest headers are invalid or have been changed.');
    }
  });

  const tables = [];
  for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const tableName = sheet.getCell(rowNumber, 1).value;
    const worksheetName = sheet.getCell(rowNumber, 2).value;
    const columnsJson = sheet.getCell(rowNumber, 3).value;
    const rowCount = Number(sheet.getCell(rowNumber, 4).value);

    if (tableName == null && worksheetName == null && columnsJson == null) continue;
    if (typeof tableName !== 'string' || typeof worksheetName !== 'string' || typeof columnsJson !== 'string') {
      throw new BackupValidationError(`Backup manifest row ${rowNumber} is invalid.`);
    }
    if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > MAX_ROWS_PER_TABLE) {
      throw new BackupValidationError(`Backup manifest row count for "${tableName}" is invalid.`);
    }

    let columns;
    try {
      columns = JSON.parse(columnsJson);
    } catch {
      throw new BackupValidationError(`Backup column metadata for "${tableName}" is invalid.`);
    }
    if (!Array.isArray(columns)) {
      throw new BackupValidationError(`Backup column metadata for "${tableName}" is invalid.`);
    }
    tables.push({ name: tableName, worksheetName, columns, rowCount });
  }

  if (tables.length === 0 || tables.length > MAX_TABLES) {
    throw new BackupValidationError('Backup manifest contains an invalid number of tables.');
  }
  return tables;
}

function decodeCellValue(cell, location) {
  const value = cell.value;
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BackupValidationError(`${location} contains an invalid number.`);
    return value;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') {
    throw new BackupValidationError(`${location} contains a formula or unsupported Excel value.`);
  }
  if (value.startsWith(ESCAPED_TEXT_PREFIX)) return value.slice(ESCAPED_TEXT_PREFIX.length);
  if (value.startsWith(BIGINT_PREFIX)) {
    try {
      return BigInt(value.slice(BIGINT_PREFIX.length));
    } catch {
      throw new BackupValidationError(`${location} contains an invalid integer value.`);
    }
  }
  if (value.startsWith(BLOB_PREFIX)) {
    const encoded = value.slice(BLOB_PREFIX.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new BackupValidationError(`${location} contains invalid binary data.`);
    }
    return Buffer.from(encoded, 'base64');
  }
  return value;
}

function compareSchema(manifestTables, currentSchema) {
  const currentByName = new Map(currentSchema.map((table) => [table.name, table]));
  const manifestNames = new Set(manifestTables.map((table) => table.name));

  if (manifestNames.size !== manifestTables.length) {
    throw new BackupValidationError('Backup manifest contains duplicate table entries.');
  }
  if (manifestTables.length !== currentSchema.length || currentSchema.some((table) => !manifestNames.has(table.name))) {
    throw new BackupValidationError('Backup database schema does not match this version of Financial Tracker. No data was imported.');
  }

  manifestTables.forEach((manifestTable) => {
    const currentTable = currentByName.get(manifestTable.name);
    if (JSON.stringify(manifestTable.columns) !== JSON.stringify(schemaSignature(currentTable.columns))) {
      throw new BackupValidationError(`Table "${manifestTable.name}" does not match the current database schema. No data was imported.`);
    }
  });
}

function parseTableRows(workbook, manifestTables, currentSchema) {
  const schemaByName = new Map(currentSchema.map((table) => [table.name, table]));
  const expectedSheets = new Set([MANIFEST_SHEET]);
  let totalCells = 0;

  const parsedTables = manifestTables.map((manifestTable) => {
    const table = schemaByName.get(manifestTable.name);
    const sheet = workbook.getWorksheet(manifestTable.worksheetName);
    if (!sheet || expectedSheets.has(manifestTable.worksheetName)) {
      throw new BackupValidationError(`Worksheet for table "${manifestTable.name}" is missing or duplicated.`);
    }
    expectedSheets.add(manifestTable.worksheetName);

    table.columns.forEach((column, index) => {
      if (sheet.getCell(1, index + 1).value !== column.name) {
        throw new BackupValidationError(`Headers for table "${table.name}" do not match the current database.`);
      }
    });
    if (sheet.getCell(1, table.columns.length + 1).value !== ROW_MARKER_COLUMN) {
      throw new BackupValidationError(`Worksheet for table "${table.name}" is missing its safety marker.`);
    }
    if (sheet.actualRowCount !== manifestTable.rowCount + 1) {
      throw new BackupValidationError(`Row count for table "${table.name}" does not match the backup manifest.`);
    }

    totalCells += manifestTable.rowCount * table.columns.length;
    if (totalCells > MAX_TOTAL_IMPORT_CELLS) {
      throw new BackupValidationError('Backup contains too much data to import safely in one operation.');
    }

    const rows = [];
    for (let rowIndex = 0; rowIndex < manifestTable.rowCount; rowIndex += 1) {
      const sheetRow = rowIndex + 2;
      if (sheet.getCell(sheetRow, table.columns.length + 1).value !== rowIndex + 1) {
        throw new BackupValidationError(`Row safety marker is invalid in table "${table.name}".`);
      }
      const values = table.columns.map((column, columnIndex) => {
        const value = decodeCellValue(
          sheet.getCell(sheetRow, columnIndex + 1),
          `Table "${table.name}", row ${rowIndex + 1}, column "${column.name}"`
        );
        if (value == null && (column.notNull || column.primaryKey > 0)) {
          throw new BackupValidationError(`Table "${table.name}" contains a missing required value in column "${column.name}".`);
        }
        return value;
      });
      if (table.name === 'receipts') {
        const filename = values[table.columns.findIndex((column) => column.name === 'filename')];
        const mimeType = values[table.columns.findIndex((column) => column.name === 'mime_type')];
        if (!isReceiptFilename(filename) || !RECEIPT_MIME_TYPES.has(mimeType)) {
          throw new BackupValidationError('Backup contains an invalid receipt file reference.');
        }
      }
      rows.push(values);
    }
    return { ...table, rows };
  });

  if (workbook.worksheets.some((sheet) => !expectedSheets.has(sheet.name))) {
    throw new BackupValidationError('Backup contains worksheets that are not declared in its manifest.');
  }
  return parsedTables;
}

function restoreOrder(tables) {
  const tableNames = new Set(tables.map((table) => table.name));
  const remaining = new Map(tables.map((table) => [table.name, table]));
  const ordered = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((table) => (
      table.parentTables.every((parent) => !tableNames.has(parent) || !remaining.has(parent))
    ));
    if (ready.length === 0) {
      ordered.push(...[...remaining.values()].sort((a, b) => a.name.localeCompare(b.name)));
      break;
    }
    ready.sort((a, b) => a.name.localeCompare(b.name)).forEach((table) => {
      ordered.push(table);
      remaining.delete(table.name);
    });
  }
  return ordered;
}

function isConstraintError(error) {
  return /constraint|foreign key|not null|unique|datatype mismatch/i.test(error?.message || '');
}

async function restoreTables(tables) {
  const ordered = restoreOrder(tables);
  const transaction = await db.transaction('write');

  try {
    await transaction.execute('PRAGMA defer_foreign_keys = ON');
    for (const table of [...ordered].reverse()) {
      await transaction.execute({ sql: `DELETE FROM ${quoteIdentifier(table.name)}`, args: [] });
    }

    for (const table of ordered) {
      if (table.rows.length === 0) continue;
      const columnSql = table.columns.map((column) => quoteIdentifier(column.name)).join(', ');
      const placeholders = table.columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${quoteIdentifier(table.name)} (${columnSql}) VALUES (${placeholders})`;

      for (let index = 0; index < table.rows.length; index += INSERT_BATCH_SIZE) {
        await transaction.batch(
          table.rows.slice(index, index + INSERT_BATCH_SIZE).map((args) => ({ sql, args }))
        );
      }
    }
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    if (isConstraintError(error)) {
      throw new BackupValidationError('Backup data violates current database rules. No data was imported.');
    }
    throw error;
  } finally {
    if (!transaction.closed) transaction.close();
  }
}

export async function importDatabaseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new BackupValidationError('The uploaded file is not a readable XLSX workbook.');
  }

  const manifestTables = parseManifest(workbook);
  const currentSchema = await getDatabaseSchema();
  compareSchema(manifestTables, currentSchema);
  const tables = parseTableRows(workbook, manifestTables, currentSchema);
  await restoreTables(tables);

  return {
    table_count: tables.length,
    row_count: tables.reduce((sum, table) => sum + table.rows.length, 0),
  };
}
