import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { AnalysisService } from '../services/analysis.service.js';
import { transformDependency } from './analysis.routes.js';

const dependencyParamsSchema = z.object({
  id: z.string().min(1, 'Analysis ID is required'),
  depId: z.string().min(1, 'Dependency ID is required'),
});

export default async function dependencyRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { analysisService: AnalysisService }
): Promise<void> {
  const { analysisService } = opts;

  fastify.get('/api/analysis/:id/dependency/:depId', async (request, reply) => {
    try {
      const parsed = dependencyParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: parsed.error.issues,
        });
      }

      const { id, depId } = parsed.data;
      const result = await analysisService.getDependencyDetail(id, depId);

      return reply.status(200).send({
        ...transformDependency(result.dependency),
        transitiveDeps: result.transitiveDeps.map(transformDependency),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      if (message.includes('Dependency not found')) {
        return reply.status(404).send({ error: message });
      }

      fastify.log.error(error, 'Failed to get dependency detail');
      return reply.status(500).send({ error: message });
    }
  });
}
