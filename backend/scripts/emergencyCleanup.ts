/**
 * Emergency Cleanup Script
 * Resets the database to a clean state for demo purposes
 *
 * Usage: npx ts-node scripts/emergencyCleanup.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function emergencyCleanup() {
  console.log('='.repeat(50));
  console.log('EMERGENCY CLEANUP SCRIPT');
  console.log('='.repeat(50));
  console.log('');

  try {
    // 1. Delete failed approvals older than 1 day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const deletedFailedApprovals = await prisma.approval.deleteMany({
      where: {
        executionStatus: 'failed',
        requestedAt: {
          lt: oneDayAgo,
        },
      },
    });
    console.log(`[1] Deleted ${deletedFailedApprovals.count} old failed approvals`);

    // 2. Reset stuck 'executing' approvals back to 'pending'
    const resetStuckApprovals = await prisma.approval.updateMany({
      where: {
        executionStatus: 'executing',
      },
      data: {
        executionStatus: null,
        status: 'pending',
      },
    });
    console.log(`[2] Reset ${resetStuckApprovals.count} stuck 'executing' approvals to 'pending'`);

    // 3. Clean up orphaned Ralph states (running for too long)
    const resetRalphStates = await prisma.ralphState.updateMany({
      where: {
        status: 'running',
        startedAt: {
          lt: oneDayAgo,
        },
      },
      data: {
        status: 'failed',
      },
    });
    console.log(`[3] Marked ${resetRalphStates.count} stuck Ralph tasks as 'failed'`);

    // 4. Get summary of current state
    const pendingApprovals = await prisma.approval.count({
      where: { status: 'pending' },
    });
    const approvedApprovals = await prisma.approval.count({
      where: { status: 'approved' },
    });
    const totalTasks = await prisma.task.count();
    const pendingReminders = await prisma.reminder.count({
      where: { status: 'pending' },
    });

    console.log('');
    console.log('='.repeat(50));
    console.log('CURRENT STATE SUMMARY');
    console.log('='.repeat(50));
    console.log(`Pending Approvals: ${pendingApprovals}`);
    console.log(`Approved (awaiting execution): ${approvedApprovals}`);
    console.log(`Total Tasks: ${totalTasks}`);
    console.log(`Pending Reminders: ${pendingReminders}`);
    console.log('');
    console.log('Cleanup complete! System is ready for demo.');

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

emergencyCleanup();
