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

const configuredNodeEnv = process.env.NODE_ENV?.trim() || 'development';
if (!['development', 'test', 'production'].includes(configuredNodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

process.env.NODE_ENV = configuredNodeEnv;
loadEnvFile(configuredNodeEnv === 'production' ? '.env.production' : '.env');

export const isProduction = configuredNodeEnv === 'production';
export const isTest = configuredNodeEnv === 'test';
