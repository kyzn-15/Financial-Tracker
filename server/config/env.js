import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filename) {
  const result = dotenv.config({ path: path.resolve(__dirname, '..', filename) });
  if (result.error && result.error.code !== 'ENOENT') {
    throw result.error;
  }
}

loadEnvFile('.env');
if (process.env.NODE_ENV === 'production') {
  loadEnvFile('.env.production');
}

export const isProduction = process.env.NODE_ENV === 'production';
