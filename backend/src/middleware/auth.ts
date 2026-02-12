import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
}

export const authenticate = async (req: AuthenticatedRequest, res: FastifyReply) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { userId: string };
    req.userId = decoded.userId;

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      res.status(401).send({ error: 'User not found' });
      return;
    }
  } catch (error) {
    res.status(401).send({ error: 'Invalid token' });
    return;
  }
};