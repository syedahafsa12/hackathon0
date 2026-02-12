import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function createDummy() {
  const approval = await prisma.approval.create({
    data: {
      id: "approval-test-001",
      userId: "dev-user-001",
      actionType: "SEND_EMAIL",
      actionData: JSON.stringify({ to: "test@example.com", body: "Hello" }),
      status: "pending",
    },
  });
  console.log("Created dummy approval:", approval.id);
  await prisma.$disconnect();
}

createDummy().catch(console.error);
