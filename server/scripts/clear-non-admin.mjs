import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OWNER_ADMIN_EMAIL = process.env.OWNER_ADMIN_EMAIL || 'ddnandu3@gmail.com';

async function main() {
  console.log('Clearing all users and data except owner admin:', OWNER_ADMIN_EMAIL);

  const ownerAdmin = await prisma.user.findUnique({ where: { email: OWNER_ADMIN_EMAIL } });
  if (!ownerAdmin) {
    console.error('Owner admin not found. Make sure the server has run once to seed it.');
    return;
  }

  const ownerId = ownerAdmin.id;

  // Delete child records first to satisfy foreign key constraints
  console.log('Deleting chat messages...');
  await prisma.chatMessage.deleteMany({ where: { senderId: { not: ownerId } } });

  console.log('Deleting health metrics...');
  await prisma.healthMetric.deleteMany({ where: { patientId: { not: ownerId } } });

  console.log('Deleting time slots...');
  await prisma.timeSlot.deleteMany({ where: { doctorId: { not: ownerId } } });

  console.log('Deleting doctor schedules...');
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: { not: ownerId } } });

  console.log('Deleting appointments...');
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patientId: { not: ownerId } },
        { doctorId: { not: ownerId } },
      ],
    },
  });

  console.log('Deleting users (all except owner admin)...');
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { not: ownerId } },
        { email: { not: OWNER_ADMIN_EMAIL } },
      ],
    },
  });

  console.log('Done. Only the owner admin user should remain.');
}

main()
  .catch((e) => {
    console.error('Error while clearing users:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
