import { rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../db/schema.js';

export function startCleanupScheduler(db: Kysely<DatabaseSchema>): NodeJS.Timeout {
  const cloneDir = path.join(os.tmpdir(), 'licensescope');

  async function cleanup() {
    console.log('Running cleanup task...');

    try {
      // Delete analyses older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deleted = await db
        .deleteFrom('analyses')
        .where('created_at', '<', sevenDaysAgo.toISOString())
        .executeTakeFirst();

      console.log(
        `Deleted ${deleted.numDeletedRows ?? 0} analyses older than 7 days`
      );
    } catch (err) {
      console.error('Error cleaning up old analyses:', err);
    }

    // Clean up orphaned files in the temp clone directory
    try {
      const entries = await readdir(cloneDir);
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

      for (const entry of entries) {
        const entryPath = path.join(cloneDir, entry);
        try {
          const stats = await stat(entryPath);
          if (stats.mtimeMs < twoHoursAgo) {
            await rm(entryPath, { recursive: true, force: true });
            console.log(`Cleaned up orphaned directory: ${entryPath}`);
          }
        } catch {
          // Ignore errors for individual entries
        }
      }
    } catch {
      // Clone directory might not exist yet
    }

    console.log('Cleanup task completed');
  }

  // Run every hour
  return setInterval(cleanup, 60 * 60 * 1000);
}
