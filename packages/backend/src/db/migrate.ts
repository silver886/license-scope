import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Migrator, type Migration, type MigrationProvider } from 'kysely';
import { createDb } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/licensescope.db';

  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });

  const db = createDb(dbPath);

  const migrationFolder = path.join(__dirname, 'migrations');
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations(): Promise<Record<string, Migration>> {
        const files = await fs.readdir(migrationFolder);
        const migrations: Record<string, Migration> = {};
        for (const file of files) {
          if (file.endsWith('.d.ts') || file.endsWith('.d.mts')) continue;
          if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
          const filePath = path.join(migrationFolder, file);
          const migration = await import(pathToFileURL(filePath).href);
          const key = file.replace(/\.(ts|js)$/, '');
          migrations[key] = migration;
        }
        return migrations;
      },
    } satisfies MigrationProvider,
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`Migration "${result.migrationName}" was executed successfully`);
    } else if (result.status === 'Error') {
      console.error(`Failed to execute migration "${result.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate:', error);
    process.exit(1);
  }

  await db.destroy();
  console.log('Migrations completed successfully');
}

migrate();
