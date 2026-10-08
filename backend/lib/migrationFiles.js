const fs = require('fs');

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

module.exports = { listMigrationFiles };
