import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all users and data except admin users...');

  // Delete child records first to satisfy foreign key constraints
  console.log('Deleting medication alerts...');
  await prisma.medicationMissedDoseAlert.deleteMany({});

  console.log('Deleting medication adherence...');
  await prisma.medicationAdherence.deleteMany({});

  console.log('Deleting medication orders...');
  await prisma.medicationOrder.deleteMany({});

  console.log('Deleting consultation summaries...');
  await prisma.consultationSummary.deleteMany({});

  console.log('Deleting chat messages...');
  await prisma.chatMessage.deleteMany({});

  console.log('Deleting health metrics...');
  await prisma.healthMetric.deleteMany({});

  console.log('Deleting appointments...');
  await prisma.appointment.deleteMany({});

  console.log('Deleting time slots...');
  await prisma.timeSlot.deleteMany({});

  console.log('Deleting doctor schedules...');
  await prisma.doctorSchedule.deleteMany({});

  console.log('Deleting users (all non-admin users)...');
  await prisma.user.deleteMany({
    where: {
      role: { not: 'ADMIN' },
    },
  });

  console.log('Done. Only admin user accounts should remain.');
}

main()
  .catch((e) => {
    console.error('Error while clearing users:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
