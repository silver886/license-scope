import type { Kysely, Selectable } from 'kysely';
import type {
  DatabaseSchema,
  AnalysisTable,
  DependencyTable,
  CompatibleLicenseTable,
} from '../db/schema.js';

export type AnalysisRow = Selectable<AnalysisTable>;
export type DependencyRow = Selectable<DependencyTable>;
export type CompatibleLicenseRow = Selectable<CompatibleLicenseTable>;

export interface AnalysisResult {
  analysis: AnalysisRow;
  dependencies: DependencyRow[];
  compatibleLicenses: CompatibleLicenseRow[];
}

export interface DependencyDetail {
  dependency: DependencyRow;
  transitiveDeps: DependencyRow[];
}

export type JobHandler = (job: { analysisId: string; repoUrl: string; ref: string | null }) => void;

export class AnalysisService {
  private db: Kysely<DatabaseSchema>;
  private onJob: JobHandler;

  constructor(db: Kysely<DatabaseSchema>, onJob: JobHandler) {
    this.db = db;
    this.onJob = onJob;
  }

  async createAnalysis(
    repoUrl: string,
    ref?: string
  ): Promise<{ analysisId: string; status: string }> {
    if (!this.isValidGitUrl(repoUrl)) {
      throw new Error(
        'Invalid repository URL. Must be a valid HTTP(S) or SSH git URL.'
      );
    }

    const result = await this.db
      .insertInto('analyses')
      .values({
        repo_url: repoUrl,
        commit_sha: ref || null,
        status: 'queued',
        progress: 0,
        ecosystems: JSON.stringify([]),
        created_at: new Date().toISOString(),
        completed_at: null,
        error: null,
      })
      .returning(['id', 'status'])
      .executeTakeFirstOrThrow();

    // Fire and forget — the worker processes it asynchronously
    this.onJob({
      analysisId: result.id,
      repoUrl,
      ref: ref || null,
    });

    return {
      analysisId: result.id,
      status: result.status,
    };
  }

  async getAnalysis(id: string): Promise<AnalysisResult> {
    const analysis = await this.db
      .selectFrom('analyses')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!analysis) {
      throw new Error(`Analysis not found: ${id}`);
    }

    const dependencies = await this.db
      .selectFrom('dependencies')
      .selectAll()
      .where('analysis_id', '=', id)
      .execute();

    const compatibleLicenses = await this.db
      .selectFrom('compatible_licenses')
      .selectAll()
      .where('analysis_id', '=', id)
      .execute();

    return {
      analysis,
      dependencies,
      compatibleLicenses,
    };
  }

  async getDependencyDetail(
    analysisId: string,
    depId: string
  ): Promise<DependencyDetail> {
    const dependency = await this.db
      .selectFrom('dependencies')
      .selectAll()
      .where('id', '=', depId)
      .where('analysis_id', '=', analysisId)
      .executeTakeFirst();

    if (!dependency) {
      throw new Error(
        `Dependency not found: ${depId} in analysis ${analysisId}`
      );
    }

    const transitiveDeps = await this.db
      .selectFrom('dependencies')
      .selectAll()
      .where('analysis_id', '=', analysisId)
      .where('parent_dep_id', '=', depId)
      .execute();

    return {
      dependency,
      transitiveDeps,
    };
  }

  private isValidGitUrl(url: string): boolean {
    if (/^https?:\/\/.+\/.+/i.test(url)) return true;
    if (/^git@[\w.-]+:[\w./-]+/i.test(url)) return true;
    if (/^git:\/\/.+/i.test(url)) return true;
    return false;
  }
}
