import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import db from '../db/database.js';
import { nowUTC8, addDaysUTC8 } from '../utils/datetime.js';
import { RETENTION_DAYS } from '../services/receiptCleanup.js';
import { RECEIPTS_UPLOAD_DIR, RECEIPT_MIME_TYPES, resolveReceiptFilePath } from '../utils/receiptFiles.js';
import { receiptUploadLimiter } from '../middleware/security.js';

const router = Router();

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function detectImageMimeType(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

function verifyUploadedImage(file) {
  const mimeType = detectImageMimeType(file.path);
  if (!mimeType || !RECEIPT_MIME_TYPES.has(mimeType)) {
    throw new Error('Uploaded file is not a supported image.');
  }

  const extension = EXT_BY_MIME[mimeType];
  const targetPath = path.join(path.dirname(file.path), `${path.parse(file.filename).name}${extension}`);
  if (targetPath !== file.path) {
    fs.renameSync(file.path, targetPath);
    file.filename = path.basename(targetPath);
  }
  file.mimetype = mimeType;
}
if (!fs.existsSync(RECEIPTS_UPLOAD_DIR)) {
  fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: RECEIPTS_UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (RECEIPT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, or HEIC images are allowed'));
    }
  },
});

function toReceiptResponse(row) {
  return {
    id: row.id,
    uploaded_at: row.uploaded_at,
    expires_at: row.expires_at,
    mime_type: row.mime_type,
    image_url: `/api/receipts/${row.id}/image`,
  };
}

router.get('/', async (_req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT id, filename, mime_type, uploaded_at, expires_at
            FROM receipts
            ORDER BY uploaded_at DESC`,
      args: [],
    });
    const rows = result.rows;

    res.json(rows.map(toReceiptResponse));
  } catch (err) {
    console.error('GET /api/receipts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', receiptUploadLimiter, async (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 10 MB or smaller'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (err) {
      return res.status(400).json({ error: 'Invalid receipt upload.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    try {
      verifyUploadedImage(req.file);
      const uploadedAt = nowUTC8();
      const expiresAt = addDaysUTC8(new Date(), RETENTION_DAYS);

      const result = await db.execute({
        sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
              VALUES (?, ?, ?, ?)`,
        args: [req.file.filename, req.file.mimetype, uploadedAt, expiresAt],
      });

      const createdResult = await db.execute({
        sql: `SELECT id, filename, mime_type, uploaded_at, expires_at
              FROM receipts WHERE id = ?`,
        args: [result.lastInsertRowid],
      });
      const created = createdResult.rows[0];

      res.status(201).json(toReceiptResponse(created));
    } catch (insertErr) {
      if (req.file?.filename) {
        deleteReceiptFile(req.file.filename);
      }
      console.error('POST /api/receipts error:', insertErr);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

router.get('/:id/image', async (req, res) => {
  try {
    const id = parseReceiptId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid receipt id.' });
    const result = await db.execute({
      sql: 'SELECT filename, mime_type FROM receipts WHERE id = ?',
      args: [id],
    });
    const receipt = result.rows[0];
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    let filePath;
    try {
      filePath = resolveReceiptFilePath(receipt.filename);
    } catch {
      return res.status(404).json({ error: 'Receipt image not found' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Receipt image not found' });
    }

    res.type(receipt.mime_type);
    res.sendFile(filePath);
  } catch (err) {
    console.error('GET /api/receipts/:id/image error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseReceiptId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid receipt id.' });
    const result = await db.execute({
      sql: 'SELECT id, filename FROM receipts WHERE id = ?',
      args: [id],
    });
    const receipt = result.rows[0];
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    deleteReceiptFile(receipt.filename);
    await db.execute({ sql: 'DELETE FROM receipts WHERE id = ?', args: [receipt.id] });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/receipts/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function deleteReceiptFile(filename) {
  let filePath;
  try {
    filePath = resolveReceiptFilePath(filename);
  } catch {
    return;
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function parseReceiptId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default router;
