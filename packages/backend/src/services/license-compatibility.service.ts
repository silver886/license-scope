import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../db/schema.js';
import { computeCompatibleLicenses } from '../license-data/compatibility-matrix.js';

export async function computeForAnalysis(
  db: Kysely<DatabaseSchema>,
  analysisId: string
): Promise<void> {
  // Read all dependencies for this analysis
  const dependencies = await db
    .selectFrom('dependencies')
    .select(['license_spdx'])
    .where('analysis_id', '=', analysisId)
    .execute();

  // Collect all non-null SPDX license identifiers
  const inboundLicenses = dependencies
    .map((d) => d.license_spdx)
    .filter((l): l is string => l !== null && l !== 'Unknown');

  // Compute compatibility
  const results = computeCompatibleLicenses(inboundLicenses);

  // Delete any existing compatible_licenses for this analysis
  await db
    .deleteFrom('compatible_licenses')
    .where('analysis_id', '=', analysisId)
    .execute();

  // Insert results
  if (results.length > 0) {
    await db
      .insertInto('compatible_licenses')
      .values(
        results.map((r) => ({
          analysis_id: analysisId,
          license_spdx: r.license,
          is_compatible: r.isCompatible ? 1 : 0,
          reason: r.reason,
        }))
      )
      .execute();
  }
}
