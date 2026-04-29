
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding diverse clinical user base...');

  const passwordHash = await bcrypt.hash('CareXAI@2026!', 10);
  const adminHash = await bcrypt.hash('123456', 10);

  // 1. ADMINS
  await prisma.user.upsert({
    where: { email: 'ddnandu3@gmail.com' },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: { name: 'CareXAI Admin', email: 'ddnandu3@gmail.com', passwordHash: adminHash, role: 'ADMIN' }
  });

  // 2. DOCTORS (Choose your specialization)
  const doctors = [
    {
      name: 'Dr. Sarah Connor',
      email: 'cardio@carexai.com',
      specialization: 'Cardiology',
      qualification: 'MD, DM (Cardiology)',
      registrationNumber: 'DOC-CRD-001'
    },
    {
      name: 'Dr. James Smith',
      email: 'diabetes@carexai.com',
      specialization: 'Endocrinology',
      qualification: 'MD, PhD',
      registrationNumber: 'DOC-END-002'
    }
  ];

  for (const doc of doctors) {
    await prisma.user.upsert({
      where: { email: doc.email },
      update: { 
        passwordHash, 
        role: 'DOCTOR', 
        doctorStatus: 'VERIFIED',
        ...doc,
        verificationDocumentUrl: 'https://carexai.com/verified.pdf'
      },
      create: { 
        ...doc,
        email: doc.email,
        passwordHash, 
        role: 'DOCTOR', 
        doctorStatus: 'VERIFIED',
        verificationDocumentUrl: 'https://carexai.com/verified.pdf'
      }
    });
    console.log(`Doctor created: ${doc.email} (${doc.specialization})`);
  }

  // 3. PATIENTS (Choose your profile)
  const patients = [
    {
      name: 'John High-Risk',
      email: 'patient.high@carexai.com',
      role: 'PATIENT'
    },
    {
      name: 'Jane Low-Risk',
      email: 'patient.low@carexai.com',
      role: 'PATIENT'
    }
  ];

  for (const pat of patients) {
    const user = await prisma.user.upsert({
      where: { email: pat.email },
      update: { passwordHash, role: 'PATIENT' },
      create: { name: pat.name, email: pat.email, passwordHash, role: 'PATIENT' }
    });
    console.log(`Patient created: ${pat.email}`);

    // Add some initial metrics for the high risk patient
    if (pat.email === 'patient.high@carexai.com') {
      await prisma.healthMetric.create({
        data: {
          patientId: user.id,
          metricsJson: JSON.stringify({
            systolicBP: 155,
            diastolicBP: 95,
            glucose: 210,
            bmi: 31.5,
            cholesterol: 245,
            timestamp: new Date().toISOString()
          })
        }
      });
    } else {
      await prisma.healthMetric.create({
        data: {
          patientId: user.id,
          metricsJson: JSON.stringify({
            systolicBP: 118,
            diastolicBP: 78,
            glucose: 85,
            bmi: 22.4,
            cholesterol: 170,
            timestamp: new Date().toISOString()
          })
        }
      });
    }
  }

  console.log('\nSeeding completed. All passwords (except Admin) are: CareXAI@2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
