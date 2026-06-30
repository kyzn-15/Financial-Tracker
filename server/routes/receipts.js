import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import db from '../db/database.js';
import { nowUTC8, addDaysUTC8 } from '../utils/datetime.js';
import { RECEIPTS_UPLOAD_DIR, RETENTION_DAYS } from '../services/receiptCleanup.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

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
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
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

router.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, filename, mime_type, uploaded_at, expires_at
      FROM receipts
      ORDER BY uploaded_at DESC
    `).all();

    res.json(rows.map(toReceiptResponse));
  } catch (err) {
    console.error('GET /api/receipts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 10 MB or smaller'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    try {
      const uploadedAt = nowUTC8();
      const expiresAt = addDaysUTC8(new Date(), RETENTION_DAYS);

      const result = db.prepare(`
        INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(req.file.filename, req.file.mimetype, uploadedAt, expiresAt);

      const created = db.prepare(`
        SELECT id, filename, mime_type, uploaded_at, expires_at
        FROM receipts WHERE id = ?
      `).get(result.lastInsertRowid);

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

router.get('/:id/image', (req, res) => {
  try {
    const receipt = db.prepare('SELECT filename, mime_type FROM receipts WHERE id = ?').get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const filePath = path.join(RECEIPTS_UPLOAD_DIR, receipt.filename);
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

router.delete('/:id', (req, res) => {
  try {
    const receipt = db.prepare('SELECT id, filename FROM receipts WHERE id = ?').get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    deleteReceiptFile(receipt.filename);
    db.prepare('DELETE FROM receipts WHERE id = ?').run(receipt.id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/receipts/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function deleteReceiptFile(filename) {
  const filePath = path.join(RECEIPTS_UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export default router;
