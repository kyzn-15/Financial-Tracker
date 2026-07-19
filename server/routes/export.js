import { Router } from 'express';
import multer from 'multer';
import {
  BackupValidationError,
  buildDatabaseExportWorkbook,
  importDatabaseWorkbook,
} from '../services/exportWorkbook.js';
import { nowUTC8 } from '../utils/datetime.js';
import { backupImportLimiter, exportLimiter } from '../middleware/security.js';

const router = Router();
const MAX_BACKUP_SIZE = 10 * 1024 * 1024;
const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_BACKUP_SIZE },
  fileFilter: (_req, file, callback) => {
    const hasXlsxName = file.originalname.toLowerCase().endsWith('.xlsx');
    callback(null, hasXlsxName && (!file.mimetype || XLSX_MIME_TYPES.has(file.mimetype)));
  },
});

router.get('/records', exportLimiter, async (_req, res) => {
  try {
    const buffer = await buildDatabaseExportWorkbook();
    const datePart = nowUTC8().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="financial-tracker-database-backup-${datePart}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('GET /api/export/records error:', err);
    res.status(500).json({ error: 'Failed to export database backup' });
  }
});

router.post('/records/import', backupImportLimiter, (req, res) => {
  upload.single('backup')(req, res, async (uploadError) => {
    if (uploadError instanceof multer.MulterError) {
      const message = uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'Database backup must be 10 MB or smaller.'
        : 'Only one XLSX database backup can be imported at a time.';
      return res.status(400).json({ error: message });
    }
    if (uploadError) {
      return res.status(400).json({ error: 'Could not read the uploaded database backup.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a valid Financial Tracker XLSX database backup.' });
    }

    try {
      const result = await importDatabaseWorkbook(req.file.buffer);
      res.json({ message: 'Database backup imported successfully.', ...result });
    } catch (error) {
      if (error instanceof BackupValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('POST /api/export/records/import error:', error);
      res.status(500).json({ error: 'Failed to import database backup. No data was changed.' });
    }
  });
});

export default router;
