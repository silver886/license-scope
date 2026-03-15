import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { AnalysisService, AnalysisResult, DependencyRow, CompatibleLicenseRow } from '../services/analysis.service.js';

const analyzeBodySchema = z.object({
  repoUrl: z.string().min(1, 'repoUrl is required'),
  ref: z.string().optional(),
});

const analysisParamsSchema = z.object({
  id: z.string().min(1, 'Analysis ID is required'),
});

function transformAnalysis(result: AnalysisResult) {
  const a = result.analysis;
  return {
    id: a.id,
    repoUrl: a.repo_url,
    commitSha: a.commit_sha,
    status: a.status,
    progress: a.progress,
    ecosystems: typeof a.ecosystems === 'string' ? JSON.parse(a.ecosystems) : a.ecosystems,
    error: a.error,
    createdAt: a.created_at,
    completedAt: a.completed_at,
    dependencies: result.dependencies.map(transformDependency),
    compatibleLicenses: result.compatibleLicenses.map(transformCompatibleLicense),
  };
}

function transformDependency(d: DependencyRow) {
  return {
    id: d.id,
    name: d.name,
    version: d.version,
    ecosystem: d.ecosystem,
    licenseSpdx: d.license_spdx,
    licenseRaw: d.license_raw,
    licenseCategory: d.license_category,
    isDirect: Boolean(d.is_direct),
    parentDepId: d.parent_dep_id,
    registryUrl: d.registry_url,
  };
}

function transformCompatibleLicense(c: CompatibleLicenseRow) {
  return {
    id: c.id,
    licenseSpdx: c.license_spdx,
    isCompatible: Boolean(c.is_compatible),
    reason: c.reason,
  };
}

export default async function analysisRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { analysisService: AnalysisService }
): Promise<void> {
  const { analysisService } = opts;

  fastify.post('/api/analyze', async (request, reply) => {
    try {
      const parsed = analyzeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: parsed.error.issues,
        });
      }

      const { repoUrl, ref } = parsed.data;
      const result = await analysisService.createAnalysis(repoUrl, ref);

      return reply.status(201).send(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      if (message.includes('Invalid repository URL')) {
        return reply.status(400).send({ error: message });
      }

      fastify.log.error(error, 'Failed to create analysis');
      return reply.status(500).send({ error: message });
    }
  });

  fastify.get('/api/analysis/:id', async (request, reply) => {
    try {
      const parsed = analysisParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: parsed.error.issues,
        });
      }

      const { id } = parsed.data;
      const result = await analysisService.getAnalysis(id);

      return reply.status(200).send(transformAnalysis(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      if (message.includes('Analysis not found')) {
        return reply.status(404).send({ error: message });
      }

      fastify.log.error(error, 'Failed to get analysis');
      return reply.status(500).send({ error: message });
    }
  });
}

export { transformDependency };
