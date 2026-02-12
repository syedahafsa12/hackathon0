import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { PrismaClient } from '@prisma/client';
import approvalService from './approvalService';

const prisma = new PrismaClient();

// Middleware to check if an action requires approval
export const requiresApproval = async (
  req: FastifyRequest,
  res: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  // This is a simplified implementation
  // In a real app, you'd check if the specific action requires approval
  // based on user preferences, action type, sensitivity, etc.

  // For now, we'll just continue without blocking
  done();
};

// Function to check if a specific action requires approval for a user
export const checkApprovalRequired = async (userId: string, actionType: string, actionData: any) => {
  // Determine if this action type requires approval based on user preferences
  // This is a simplified implementation - in reality, you'd have more complex logic
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true }
  });

  const userPrefs = user?.preferences || {};
  const approvalRequiredActions = userPrefs.approvalRequiredActions || [
    'email_send',
    'calendar_create',
    'linkedin_post',
    'task_create_critical',
    'knowledge_save_sensitive'
  ];

  if (approvalRequiredActions.includes(actionType)) {
    // Create an approval request
    const approval = await approvalService.createApproval(userId, {
      actionType,
      actionData
    });

    return {
      requiresApproval: true,
      approval
    };
  }

  return {
    requiresApproval: false
  };
};