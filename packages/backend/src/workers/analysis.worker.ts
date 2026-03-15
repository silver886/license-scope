import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { type DatabaseSchema, type AnalysisStatus } from '../db/schema.js';
import { cloneRepo, cleanupRepo } from '../services/git.service.js';
import { detectEcosystems } from '../parsers/parser.registry.js';
import { LicenseDetectionService } from '../services/license-detection.service.js';
import { getLicenseCategory } from '../license-data/compatibility-matrix.js';
import { computeForAnalysis } from '../services/license-compatibility.service.js';
import type { Kysely } from 'kysely';

export interface AnalysisJobData {
  analysisId: string;
  repoUrl: string;
  ref: string | null;
}

async function updateAnalysis(
  db: Kysely<DatabaseSchema>,
  analysisId: string,
  updates: Partial<{
    status: AnalysisStatus;
    progress: number;
    commit_sha: string;
    ecosystems: string;
    error: string;
    completed_at: string;
  }>
): Promise<void> {
  await db
    .updateTable('analyses')
    .set(updates)
    .where('id', '=', analysisId)
    .execute();
}

export async function processAnalysis(
  db: Kysely<DatabaseSchema>,
  job: AnalysisJobData
): Promise<void> {
  const { analysisId, repoUrl } = job;
  const clonePath = path.join(os.tmpdir(), 'licensescope', randomUUID());
  const licenseService = new LicenseDetectionService(db);

  try {
    // Step 1: Cloning
    await updateAnalysis(db, analysisId, {
      status: 'cloning',
      progress: 10,
    });

    const commitSha = await cloneRepo(repoUrl, clonePath);
    await updateAnalysis(db, analysisId, { commit_sha: commitSha });

    // Step 2: Parsing
    await updateAnalysis(db, analysisId, {
      status: 'parsing',
      progress: 30,
    });

    const parsers = await detectEcosystems(clonePath);
    const ecosystems = parsers.map((p) => p.ecosystem);
    await updateAnalysis(db, analysisId, {
      ecosystems: JSON.stringify(ecosystems),
    });

    const allParsedDeps: Array<{
      name: string;
      version: string;
      isDirect: boolean;
      parentName?: string;
      ecosystem: string;
    }> = [];

    for (const parser of parsers) {
      const deps = await parser.parse(clonePath);
      for (const dep of deps) {
        allParsedDeps.push({
          ...dep,
          ecosystem: parser.ecosystem,
        });
      }
    }

    // Step 3: Resolving licenses
    await updateAnalysis(db, analysisId, {
      status: 'resolving_licenses',
      progress: 50,
    });

    const totalDeps = allParsedDeps.length;
    const progressPerDep = totalDeps > 0 ? 40 / totalDeps : 0;

    for (let i = 0; i < allParsedDeps.length; i++) {
      const dep = allParsedDeps[i];

      let spdx = 'Unknown';
      let raw = 'Unknown';
      let registryUrl: string | null = null;

      try {
        const licenseResult = await licenseService.detectLicense(
          dep.ecosystem,
          dep.name,
          dep.version
        );
        spdx = licenseResult.spdx;
        raw = licenseResult.raw;
        registryUrl = licenseResult.registryUrl;
      } catch {
        // License detection failed, keep defaults
      }

      const category = getLicenseCategory(spdx);

      await db
        .insertInto('dependencies')
        .values({
          analysis_id: analysisId,
          name: dep.name,
          version: dep.version,
          ecosystem: dep.ecosystem,
          license_spdx: spdx,
          license_raw: raw,
          license_category: category,
          is_direct: dep.isDirect ? 1 : 0,
          parent_dep_id: null,
          registry_url: registryUrl,
        })
        .execute();

      const currentProgress = Math.round(50 + (i + 1) * progressPerDep);
      await updateAnalysis(db, analysisId, { progress: currentProgress });
    }

    // Step 4: Compute license compatibility
    await computeForAnalysis(db, analysisId);

    // Step 5: Complete
    await updateAnalysis(db, analysisId, {
      status: 'complete',
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    await cleanupRepo(clonePath);
    console.log(`Analysis ${analysisId} completed successfully`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await updateAnalysis(db, analysisId, {
      status: 'failed',
      error: errorMessage,
    });

    await cleanupRepo(clonePath);
    console.error(`Analysis ${analysisId} failed: ${errorMessage}`);
  }
}
