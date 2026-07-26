import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECEIPT_FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|heic|heif)$/i;

export const RECEIPTS_UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'receipts');
export const RECEIPT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function isReceiptFilename(filename) {
  return typeof filename === 'string' && RECEIPT_FILENAME_PATTERN.test(filename);
}

export function resolveReceiptFilePath(filename) {
  if (!isReceiptFilename(filename)) throw new Error('Invalid receipt filename.');

  const filePath = path.resolve(RECEIPTS_UPLOAD_DIR, filename);
  if (path.dirname(filePath) !== RECEIPTS_UPLOAD_DIR) throw new Error('Invalid receipt path.');
  return filePath;
}
