import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';

export default async function routes(fastify: FastifyInstance) {
  // Public routes
  fastify.get('/health', async (req: FastifyRequest, res: FastifyReply) => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  // Protected routes - will be added as we implement user stories
  // Example:
  // fastify.get('/api/user/profile', { preHandler: [authenticate] }, async (req: any, res: FastifyReply) => {
  //   return { userId: req.userId, message: 'Protected route accessed' };
  // });
}