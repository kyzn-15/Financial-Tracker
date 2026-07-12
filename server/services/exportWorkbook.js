import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import db from '../db/database.js';
import { RECEIPTS_UPLOAD_DIR } from './receiptCleanup.js';
import { buildEmergencySummary } from './emergencyFund.js';
import { nowUTC8 } from '../utils/datetime.js';

const MONEY_FORMAT = '#,##0.00';
const INTEGER_FORMAT = '#,##0';
const IMAGE_EXTENSIONS = new Map([
  ['.jpg', 'jpeg'],
  ['.jpeg', 'jpeg'],
  ['.png', 'png'],
]);

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeText(value) {
  if (value == null || value === '') return '-';
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function addSheet(workbook, name, columns) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(1).height = 22;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  return sheet;
}

function styleRows(sheet) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } },
      };
    });
  });
}

function addKeyValueRows(sheet, rows) {
  rows.forEach(([label, value]) => {
    sheet.addRow({ label, value: safeText(value) });
  });
}

function addOverviewSheet(workbook, expenses, receipts, emergency) {
  const sheet = addSheet(workbook, 'Overview', [
    { header: 'Section', key: 'label', width: 34 },
    { header: 'Value', key: 'value', width: 72 },
  ]);

  const totalMyr = expenses.reduce((sum, item) => sum + (money(item.price_myr) || 0), 0);
  const totalIdr = expenses.reduce((sum, item) => sum + (money(item.price_idr) || 0), 0);

  addKeyValueRows(sheet, [
    ['Export generated at', nowUTC8()],
    ['Expense record count', expenses.length],
    ['Total expense amount (MYR)', totalMyr],
    ['Total expense amount (IDR)', totalIdr],
    ['Receipt count', receipts.length],
    ['Emergency fund status', emergency.status?.label],
    ['Emergency fund coverage months', emergency.coverageMonths],
    ['Emergency fund coverage days', emergency.coverageDays],
    ['Emergency target months', emergency.targetMonths],
    ['Emergency readiness score', `${emergency.analytics?.readinessScore?.score ?? 0}/100`],
    ['Emergency data basis', emergency.dataBasis?.message],
  ]);

  sheet.getColumn('value').numFmt = MONEY_FORMAT;
  styleRows(sheet);
}

function addExpensesSheet(workbook, expenses) {
  const sheet = addSheet(workbook, 'Expense Records', [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Date/Time (UTC+8)', key: 'timestamp', width: 24 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Original Currency', key: 'original_currency', width: 18 },
    { header: 'Amount (MYR)', key: 'price_myr', width: 16 },
    { header: 'Amount (IDR)', key: 'price_idr', width: 18 },
    { header: 'Exchange Rate Used', key: 'exchange_rate_used', width: 20 },
    { header: 'Created At', key: 'created_at', width: 24 },
  ]);

  expenses.forEach((expense) => {
    sheet.addRow({
      ...expense,
      name: safeText(expense.name),
      category: safeText(expense.category),
      price_myr: money(expense.price_myr),
      price_idr: money(expense.price_idr),
      exchange_rate_used: money(expense.exchange_rate_used),
    });
  });

  sheet.getColumn('price_myr').numFmt = MONEY_FORMAT;
  sheet.getColumn('price_idr').numFmt = INTEGER_FORMAT;
  sheet.getColumn('exchange_rate_used').numFmt = MONEY_FORMAT;
  styleRows(sheet);
}

function addReceiptsSheet(workbook, receipts) {
  const sheet = addSheet(workbook, 'Receipts', [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Uploaded At (UTC+8)', key: 'uploaded_at', width: 24 },
    { header: 'Expires At (UTC+8)', key: 'expires_at', width: 24 },
    { header: 'MIME Type', key: 'mime_type', width: 18 },
    { header: 'Stored Filename', key: 'filename', width: 42 },
    { header: 'File Status', key: 'file_status', width: 20 },
    { header: 'Preview', key: 'preview', width: 34 },
  ]);

  receipts.forEach((receipt, index) => {
    const rowNumber = index + 2;
    const filePath = path.join(RECEIPTS_UPLOAD_DIR, receipt.filename);
    const fileExists = fs.existsSync(filePath);
    const imageType = IMAGE_EXTENSIONS.get(path.extname(receipt.filename).toLowerCase());

    sheet.addRow({
      ...receipt,
      file_status: fileExists ? (imageType ? 'Embedded' : 'Listed only') : 'Missing file',
      preview: imageType && fileExists ? '' : 'Image format cannot be embedded in XLSX preview',
    });

    if (fileExists && imageType) {
      const imageId = workbook.addImage({
        filename: filePath,
        extension: imageType,
      });
      sheet.getRow(rowNumber).height = 120;
      sheet.addImage(imageId, {
        tl: { col: 6.1, row: rowNumber - 0.9 },
        ext: { width: 180, height: 140 },
        editAs: 'oneCell',
      });
    }
  });

  styleRows(sheet);
}

function addEmergencySheets(workbook, emergency) {
  const summarySheet = addSheet(workbook, 'Emergency Summary', [
    { header: 'Metric', key: 'label', width: 42 },
    { header: 'Value', key: 'value', width: 72 },
  ]);

  addKeyValueRows(summarySheet, [
    ['Current savings (MYR)', emergency.currentSavingsMyr],
    ['Reserved funds (MYR)', emergency.reservedFundsMyr],
    ['Available emergency savings (MYR)', emergency.availableSavingsMyr],
    ['Average monthly essential expense (MYR)', emergency.averageMonthlyEssentialExpenseMyr],
    ['Target months', emergency.targetMonths],
    ['Target savings (MYR)', emergency.targetSavingsMyr],
    ['Remaining savings needed (MYR)', emergency.remainingSavingsMyr],
    ['Coverage months', emergency.coverageMonths],
    ['Coverage days', emergency.coverageDays],
    ['Progress percent', `${emergency.progressPercent}%`],
    ['Status', emergency.status?.label],
    ['Essential categories', emergency.settings?.essential_categories?.join(', ')],
    ['Settings updated at', emergency.settings?.updated_at],
    ['Data basis', emergency.dataBasis?.message],
  ]);
  styleRows(summarySheet);

  const categorySheet = addSheet(workbook, 'Emergency Categories', [
    { header: 'Category', key: 'category', width: 28 },
    { header: 'Average Monthly Amount (MYR)', key: 'average_myr', width: 28 },
    { header: 'Essential', key: 'is_essential', width: 14 },
  ]);
  emergency.analytics?.categoryAverages?.forEach((item) => {
    categorySheet.addRow({
      category: safeText(item.category),
      average_myr: money(item.average_myr),
      is_essential: item.is_essential ? 'Yes' : 'No',
    });
  });
  categorySheet.getColumn('average_myr').numFmt = MONEY_FORMAT;
  styleRows(categorySheet);

  const monthlySheet = addSheet(workbook, 'Emergency Monthly Basis', [
    { header: 'Month', key: 'month', width: 18 },
    { header: 'Essential Total (MYR)', key: 'total_myr', width: 24 },
  ]);
  emergency.monthlyTotals?.forEach((item) => {
    monthlySheet.addRow({
      month: item.month,
      total_myr: money(item.total_myr),
    });
  });
  monthlySheet.getColumn('total_myr').numFmt = MONEY_FORMAT;
  styleRows(monthlySheet);

  const insightSheet = addSheet(workbook, 'Emergency Insights', [
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Detail', key: 'body', width: 90 },
  ]);
  emergency.insights?.forEach((item) => insightSheet.addRow(item));
  styleRows(insightSheet);
}

export async function buildRecordsExportWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Financial Tracker';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const expenses = db.prepare('SELECT * FROM expenses ORDER BY timestamp DESC, id DESC').all();
  const receipts = db.prepare('SELECT * FROM receipts ORDER BY uploaded_at DESC, id DESC').all();
  const emergency = buildEmergencySummary();

  addOverviewSheet(workbook, expenses, receipts, emergency);
  addExpensesSheet(workbook, expenses);
  addReceiptsSheet(workbook, receipts);
  addEmergencySheets(workbook, emergency);

  return workbook.xlsx.writeBuffer();
}
