import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
const importDatabase = `
  const { default: db, initSchema } = await import('./db/database.js');
  await initSchema();
  db.close();
`;

test('development cannot connect to the production database', () => {
  const developmentDatabase = path.join(tmpdir(), `financial-tracker-dev-${randomUUID()}.db`);

  try {
    const development = spawnSync(process.execPath, ['--input-type=module', '--eval', importDatabase], {
      cwd: serverDirectory,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DB_PATH: developmentDatabase,
        TURSO_DATABASE_URL: 'libsql://production.invalid',
        TURSO_AUTH_TOKEN: 'ignored-development-token',
      },
      encoding: 'utf8',
    });

    assert.equal(development.status, 0, development.stderr);
    assert.equal(existsSync(developmentDatabase), true);

    const production = spawnSync(process.execPath, ['--input-type=module', '--eval', importDatabase], {
      cwd: serverDirectory,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TURSO_DATABASE_URL: pathToFileURL(developmentDatabase).href,
        TURSO_AUTH_TOKEN: 'production-test-token',
      },
      encoding: 'utf8',
    });

    assert.notEqual(production.status, 0);
    assert.match(production.stderr, /Production TURSO_DATABASE_URL must use libsql: or https:/);

    const productionCors = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "await import('./middleware/security.js')"],
      {
        cwd: serverDirectory,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          CLIENT_ORIGIN: 'http://localhost:5173',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(productionCors.status, 0);
    assert.match(productionCors.stderr, /cannot be loopback/);
  } finally {
    rmSync(developmentDatabase, { force: true });
  }
});
