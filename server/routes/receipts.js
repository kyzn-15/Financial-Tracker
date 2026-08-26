import { Router } from 'express';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import db from '../db/database.js';
import { nowUTC8, addDaysUTC8 } from '../utils/datetime.js';
import { createReceiptToken } from '../utils/auth.js';
import { RETENTION_DAYS } from '../services/receiptCleanup.js';
import { softDeleteReceipt } from '../services/recycleBin.js';
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

if (!fs.existsSync(RECEIPTS_UPLOAD_DIR)) {
  try {
    fs.mkdirSync(RECEIPTS_UPLOAD_DIR, { recursive: true });
  } catch {
    // Ignore in read-only environments
  }
}

function detectImageMimeType(input) {
  const bytes = Buffer.isBuffer(input)
    ? input
    : typeof input === 'string'
      ? fs.readFileSync(input)
      : null;
  if (!bytes || bytes.length < 3) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
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
  const mimeType = detectImageMimeType(file.buffer);
  if (!mimeType || !RECEIPT_MIME_TYPES.has(mimeType)) {
    throw new Error('Uploaded file is not a supported image.');
  }
  file.mimetype = mimeType;
}

const storage = multer.memoryStorage();

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

export function toReceiptResponse(row, sessionId) {
  const id = Number(row.id);
  const token = sessionId ? createReceiptToken(id, sessionId) : '';
  return {
    id,
    uploaded_at: row.uploaded_at,
    expires_at: row.expires_at,
    mime_type: row.mime_type,
    image_url: token ? `/api/receipts/${id}/image?token=${token}` : `/api/receipts/${id}/image`,
  };
}

router.get('/', async (req, res) => {
  try {
    // Soft-deleted receipts live in the Recycle Bin, not the receipts tab.
    const result = await db.execute({
      sql: `SELECT id, filename, mime_type, uploaded_at, expires_at
            FROM receipts
            WHERE deleted_at IS NULL
            ORDER BY uploaded_at DESC`,
      args: [],
    });
    const rows = result.rows;

    res.json(rows.map((row) => toReceiptResponse(row, req.auth?.sessionId)));
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    try {
      verifyUploadedImage(req.file);
      const ext = EXT_BY_MIME[req.file.mimetype] || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      const uploadedAt = nowUTC8();
      const expiresAt = addDaysUTC8(new Date(), RETENTION_DAYS);

      try {
        const filePath = resolveReceiptFilePath(filename);
        fs.writeFileSync(filePath, req.file.buffer);
      } catch {
        // Best-effort local file write
      }

      const result = await db.execute({
        sql: `INSERT INTO receipts (filename, mime_type, uploaded_at, expires_at, image_data)
              VALUES (?, ?, ?, ?, ?)`,
        args: [filename, req.file.mimetype, uploadedAt, expiresAt, req.file.buffer],
      });

      const createdResult = await db.execute({
        sql: `SELECT id, filename, mime_type, uploaded_at, expires_at
              FROM receipts WHERE id = ?`,
        args: [result.lastInsertRowid],
      });
      const created = createdResult.rows[0];

      res.status(201).json(toReceiptResponse(created, req.auth?.sessionId));
    } catch (insertErr) {
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
      sql: 'SELECT filename, mime_type, image_data FROM receipts WHERE id = ?',
      args: [id],
    });
    const receipt = result.rows[0];
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    let buffer = null;
    if (receipt.image_data != null) {
      if (Buffer.isBuffer(receipt.image_data)) {
        buffer = receipt.image_data;
      } else if (receipt.image_data instanceof ArrayBuffer) {
        buffer = Buffer.from(receipt.image_data);
      } else if (ArrayBuffer.isView(receipt.image_data)) {
        buffer = Buffer.from(receipt.image_data.buffer, receipt.image_data.byteOffset, receipt.image_data.byteLength);
      }
    }

    // Fallback for legacy records stored on disk
    if (!buffer && receipt.filename) {
      try {
        const filePath = resolveReceiptFilePath(receipt.filename);
        if (fs.existsSync(filePath)) {
          buffer = fs.readFileSync(filePath);
        }
      } catch {
        // file path resolution error
      }
    }

    if (!buffer) {
      return res.status(404).json({ error: 'Receipt image not found' });
    }

    // Set CORP header to allow cross-origin <img> rendering from trusted frontend
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, no-cache, no-store');
    res.type(receipt.mime_type || 'image/jpeg');
    return res.send(buffer);
  } catch (err) {
    console.error('GET /api/receipts/:id/image error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseReceiptId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid receipt id.' });

    // Normal deletion is a soft delete: metadata and image data stay
    // recoverable in the Recycle Bin until retention cleanup removes them.
    const deleted = await softDeleteReceipt(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/receipts/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function parseReceiptId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default router;
