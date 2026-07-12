import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error && result.error.code !== 'ENOENT') {
  throw result.error;
}

export const isProduction = process.env.NODE_ENV === 'production';
