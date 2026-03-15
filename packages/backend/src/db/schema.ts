import { Kysely, type Generated } from 'kysely';
import { LibsqlDialect } from 'kysely-libsql';
import { createClient } from '@libsql/client';

export type AnalysisStatus =
  | 'queued'
  | 'cloning'
  | 'parsing'
  | 'resolving_licenses'
  | 'complete'
  | 'failed';

export type LicenseCategory =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'unknown';

export interface AnalysisTable {
  id: Generated<string>;
  repo_url: string;
  commit_sha: string | null;
  status: AnalysisStatus;
  progress: number;
  ecosystems: string;
  error: string | null;
  created_at: Generated<string>;
  completed_at: string | null;
}

export interface DependencyTable {
  id: Generated<string>;
  analysis_id: string;
  name: string;
  version: string;
  ecosystem: string;
  license_spdx: string | null;
  license_raw: string | null;
  license_category: LicenseCategory;
  is_direct: number;
  parent_dep_id: string | null;
  registry_url: string | null;
}

export interface CompatibleLicenseTable {
  id: Generated<string>;
  analysis_id: string;
  license_spdx: string;
  is_compatible: number;
  reason: string;
}

export interface LicenseCacheTable {
  id: Generated<string>;
  ecosystem: string;
  name: string;
  version: string;
  license_spdx: string;
}

export interface DatabaseSchema {
  analyses: AnalysisTable;
  dependencies: DependencyTable;
  compatible_licenses: CompatibleLicenseTable;
  license_cache: LicenseCacheTable;
}

export function createDb(dbPath: string): Kysely<DatabaseSchema> {
  const dialect = new LibsqlDialect({
    client: createClient({
      url: `file:${dbPath}`,
    }),
  });

  return new Kysely<DatabaseSchema>({ dialect });
}
