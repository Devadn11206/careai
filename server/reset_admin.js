
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  await prisma.user.update({
    where: { email: 'ddnandu3@gmail.com' },
    data: { passwordHash: hash }
  });
  console.log('Admin password reset to 123456');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
