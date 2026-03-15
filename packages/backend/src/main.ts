import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Migrator, type Migration, type MigrationProvider } from 'kysely';
import { createDb } from './db/schema.js';
import { AnalysisService } from './services/analysis.service.js';
import { processAnalysis } from './workers/analysis.worker.js';
import { startCleanupScheduler } from './workers/cleanup.worker.js';
import analysisRoutes from './routes/analysis.routes.js';
import dependencyRoutes from './routes/dependency.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3001', 10);
  const dbPath = process.env.DATABASE_PATH || './data/licensescope.db';

  // Ensure data directory exists
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Create database connection and run migrations
  const db = createDb(dbPath);

  const migrationFolder = path.join(__dirname, 'db', 'migrations');
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

  const { error: migrationError } = await migrator.migrateToLatest();
  if (migrationError) {
    fastify.log.error(migrationError, 'Migration failed');
    process.exit(1);
  }
  fastify.log.info('Database migrations applied');

  // Create analysis service with in-process job handler
  const analysisService = new AnalysisService(db, (job) => {
    // Fire and forget — process asynchronously
    processAnalysis(db, job).catch((err) => {
      fastify.log.error(err, `Analysis job failed for ${job.analysisId}`);
    });
  });

  // Start cleanup scheduler
  const cleanupTimer = startCleanupScheduler(db);

  // Register routes
  await fastify.register(analysisRoutes, { analysisService });
  await fastify.register(dependencyRoutes, { analysisService });

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Serve frontend static files if the directory exists
  const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'frontend', 'dist');
  try {
    await fs.access(staticDir);
    await fastify.register(fastifyStatic, {
      root: staticDir,
      wildcard: false,
    });
    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
    fastify.log.info(`Serving frontend from ${staticDir}`);
  } catch {
    fastify.log.info('No frontend static directory found, serving API only');
  }

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    clearInterval(cleanupTimer);
    await fastify.close();
    await db.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
