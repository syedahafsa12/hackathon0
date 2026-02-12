/**
 * Database Cleanup Script
 * Removes stuck/failed approvals that are clogging logs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDatabase() {
  console.log('=== DATABASE CLEANUP ===');

  try {
    // 1. Delete all failed approvals
    const deletedFailed = await prisma.approval.deleteMany({
      where: { executionStatus: 'failed' }
    });
    console.log(`Deleted ${deletedFailed.count} failed approvals`);

    // 2. Delete approvals with uppercase action types (broken)
    const uppercaseTypes = ['SEND_EMAIL', 'CREATE_TASK', 'CREATE_REMINDER', 'CREATE_CALENDAR_EVENT', 'CHECK_CALENDAR', 'RESEARCH', 'SEARCH'];
    const deletedUppercase = await prisma.approval.deleteMany({
      where: { actionType: { in: uppercaseTypes } }
    });
    console.log(`Deleted ${deletedUppercase.count} uppercase action type approvals`);

    // 3. Delete specific stuck approvals by ID
    const stuckIds = ['approval-test-001', '4b20286f-469b-402f-9966-6c29d4d1b6d0'];
    for (const id of stuckIds) {
      try {
        await prisma.approval.delete({ where: { id } });
        console.log(`Deleted stuck approval: ${id}`);
      } catch (e) {
        // Might not exist, that's fine
      }
    }

    // 4. Reset any executing approvals back to pending
    const resetExecuting = await prisma.approval.updateMany({
      where: { executionStatus: 'executing' },
      data: { executionStatus: null, status: 'pending' }
    });
    console.log(`Reset ${resetExecuting.count} executing approvals to pending`);

    // 5. Show remaining approvals
    const remaining = await prisma.approval.findMany();
    console.log(`\nRemaining approvals: ${remaining.length}`);
    remaining.forEach(a => {
      console.log(`  - ${a.id}: ${a.actionType} (${a.status})`);
    });

    console.log('\n=== CLEANUP COMPLETE ===');
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
