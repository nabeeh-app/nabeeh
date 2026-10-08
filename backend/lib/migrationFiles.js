const fs = require('fs');

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function assertLocalDatabase(url) {
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      'Refusing to run: database/run_migration.js is dev-only and targets local Postgres only'
    );
  }
}

function listMigrationFiles(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const strays = files.filter((file) => file.endsWith('.rollback.sql'));
  if (strays.length > 0) {
    throw new Error(
      `Refusing to run: rollback files belong in database/rollbacks/, found in migrations/: ${strays.join(', ')}`
    );
  }

  return files;
}

module.exports = { listMigrationFiles, isLocalDatabaseUrl, assertLocalDatabase };
