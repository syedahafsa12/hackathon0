import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkStatus() {
  const approval = await prisma.approval.findUnique({
    where: { id: "approval-test-001" },
  });
  console.log("Approval Status:", JSON.stringify(approval, null, 2));
  await prisma.$disconnect();
}

checkStatus().catch(console.error);
