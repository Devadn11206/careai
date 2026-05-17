import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const appts = await prisma.appointment.findMany({
    select: { id: true, status: true }
  });
  console.log(JSON.stringify(appts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
