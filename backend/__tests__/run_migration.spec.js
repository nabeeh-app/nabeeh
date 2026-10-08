const fs = require('fs');
const os = require('os');
const path = require('path');

const { listMigrationFiles } = require('../lib/migrationFiles');

function seed(dir, names) {
  fs.mkdirSync(dir, { recursive: true });
  for (const n of names) fs.writeFileSync(path.join(dir, n), '-- test');
}

describe('run_migration file selection', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  });

  test('lists forward migrations sorted, ignores rollbacks dir', () => {
    seed(root, ['002_b.sql', '001_a.sql']);
    expect(listMigrationFiles(root)).toEqual(['001_a.sql', '002_b.sql']);
  });

  test('refuses a rollback file inside migrations/', () => {
    seed(root, ['021_x.sql', '021_x.rollback.sql']);
    expect(() => listMigrationFiles(root)).toThrow(/rollback files belong in database\/rollbacks/);
  });

  test('real migrations/ dir contains no rollback files', () => {
    const real = path.join(__dirname, '..', '..', 'database', 'migrations');
    expect(() => listMigrationFiles(real)).not.toThrow();
  });
});

describe('assertLocalDatabase', () => {
  const { assertLocalDatabase } = require('../lib/migrationFiles');

  it('allows localhost variants', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@localhost:5432/db')).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1:5432/db')).not.toThrow();
  });

  it('refuses remote urls including supabase', () => {
    expect(() => assertLocalDatabase('https://agzctzcplssulcwsosmo.supabase.co')).toThrow(/dev-only/);
    expect(() => assertLocalDatabase(undefined)).toThrow(/dev-only/);
  });
});
