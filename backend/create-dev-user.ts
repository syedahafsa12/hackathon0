import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create dev user
  const user = await prisma.user.upsert({
    where: { id: "dev-user-001" },
    update: {},
    create: {
      id: "dev-user-001",
      email: "dev@example.com",
      name: "Dev User",
    },
  });

  console.log("Dev user created:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
