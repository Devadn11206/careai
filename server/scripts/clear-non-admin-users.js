import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearNonAdminUsers() {
  console.log('🔍 Finding all non-admin users...');

  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: { id: true, name: true, email: true, role: true },
  });

  if (nonAdminUsers.length === 0) {
    console.log('✅ No non-admin users found. Nothing to delete.');
    return;
  }

  console.log(`Found ${nonAdminUsers.length} non-admin user(s):`);
  nonAdminUsers.forEach(u => console.log(`  - [${u.role}] ${u.name} (${u.email})`));

  const ids = nonAdminUsers.map(u => u.id);

  console.log('\n🗑️  Deleting related data in order...');

  // 1. Medication missed dose alerts
  const d1 = await prisma.medicationMissedDoseAlert.deleteMany({
    where: { OR: [{ patientId: { in: ids } }, { doctorId: { in: ids } }] },
  });
  console.log(`  ✔ MedicationMissedDoseAlert: ${d1.count} deleted`);

  // 2. Medication adherence
  const d2 = await prisma.medicationAdherence.deleteMany({
    where: { patientId: { in: ids } },
  });
  console.log(`  ✔ MedicationAdherence: ${d2.count} deleted`);

  // 3. Medication orders
  const d3 = await prisma.medicationOrder.deleteMany({
    where: { OR: [{ patientId: { in: ids } }, { prescribedByDoctorId: { in: ids } }] },
  });
  console.log(`  ✔ MedicationOrder: ${d3.count} deleted`);

  // 4. Consultation summaries
  const d4 = await prisma.consultationSummary.deleteMany({
    where: { OR: [{ patientId: { in: ids } }, { doctorId: { in: ids } }] },
  });
  console.log(`  ✔ ConsultationSummary: ${d4.count} deleted`);

  // 5. Chat messages
  const d5 = await prisma.chatMessage.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
  });
  console.log(`  ✔ ChatMessage: ${d5.count} deleted`);

  // 6. Appointments (find IDs first to cascade chat/summaries if any remain)
  const d6 = await prisma.appointment.deleteMany({
    where: { OR: [{ patientId: { in: ids } }, { doctorId: { in: ids } }] },
  });
  console.log(`  ✔ Appointment: ${d6.count} deleted`);

  // 7. Time slots
  const d7 = await prisma.timeSlot.deleteMany({
    where: { doctorId: { in: ids } },
  });
  console.log(`  ✔ TimeSlot: ${d7.count} deleted`);

  // 8. Doctor schedules
  const d8 = await prisma.doctorSchedule.deleteMany({
    where: { doctorId: { in: ids } },
  });
  console.log(`  ✔ DoctorSchedule: ${d8.count} deleted`);

  // 9. Health metrics
  const d9 = await prisma.healthMetric.deleteMany({
    where: { patientId: { in: ids } },
  });
  console.log(`  ✔ HealthMetric: ${d9.count} deleted`);

  // 10. Delete the users themselves
  const d10 = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`  ✔ Users: ${d10.count} deleted`);

  console.log('\n✅ Done! All non-admin users and their data have been removed.');

  // Show remaining users
  const remaining = await prisma.user.findMany({
    select: { name: true, email: true, role: true },
  });
  console.log(`\n👤 Remaining users (${remaining.length}):`);
  remaining.forEach(u => console.log(`  - [${u.role}] ${u.name} (${u.email})`));
}

clearNonAdminUsers()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
