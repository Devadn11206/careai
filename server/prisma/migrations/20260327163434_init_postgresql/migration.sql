-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('VIDEO', 'IN_PERSON');

-- CreateTable
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "specialization" TEXT,
    "experienceYears" INTEGER,
    "qualification" TEXT,
    "registrationNumber" TEXT,
    "medicalCouncil" TEXT,
    "rating" DOUBLE PRECISION DEFAULT 4.8,
    "doctorStatus" "DoctorStatus" DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescribedByDoctorId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "instructions" TEXT,
    "frequency" TEXT NOT NULL,
    "timesJson" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAdherence" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "MedicationAdherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationMissedDoseAlert" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "MedicationMissedDoseAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "type" TEXT NOT NULL,
    "consultationType" "ConsultationType" NOT NULL,
    "slotId" TEXT,
    "tokenNumber" INTEGER,
    "symptoms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduleJson" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL,
    "defaultMaxPatients" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxPatients" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "message_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "senderRole" "UserRole" NOT NULL,
    "message_text" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachmentType" TEXT,
    "encryption_key_reference" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "ConsultationSummary" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "possibleCondition" TEXT NOT NULL,
    "keyDiscussionPoints" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "followUpInstructions" TEXT NOT NULL,
    "rawJson" TEXT NOT NULL,
    "disclaimer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MedicationOrder_patientId_startDate_endDate_idx" ON "MedicationOrder"("patientId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationAdherence_doseId_key" ON "MedicationAdherence"("doseId");

-- CreateIndex
CREATE INDEX "MedicationAdherence_patientId_scheduledAt_idx" ON "MedicationAdherence"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MedicationAdherence_medicationId_scheduledAt_idx" ON "MedicationAdherence"("medicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MedicationMissedDoseAlert_doctorId_status_createdAt_idx" ON "MedicationMissedDoseAlert"("doctorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MedicationMissedDoseAlert_patientId_createdAt_idx" ON "MedicationMissedDoseAlert"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicationMissedDoseAlert_medicationId_createdAt_idx" ON "MedicationMissedDoseAlert"("medicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_key" ON "DoctorSchedule"("doctorId");

-- CreateIndex
CREATE INDEX "chat_messages_appointment_id_timestamp_idx" ON "chat_messages"("appointment_id", "timestamp");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_receiver_id_timestamp_idx" ON "chat_messages"("sender_id", "receiver_id", "timestamp");

-- CreateIndex
CREATE INDEX "ConsultationSummary_doctorId_patientId_createdAt_idx" ON "ConsultationSummary"("doctorId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSummary_appointmentId_createdAt_idx" ON "ConsultationSummary"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_prescribedByDoctorId_fkey" FOREIGN KEY ("prescribedByDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdherence" ADD CONSTRAINT "MedicationAdherence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdherence" ADD CONSTRAINT "MedicationAdherence_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationMissedDoseAlert" ADD CONSTRAINT "MedicationMissedDoseAlert_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationMissedDoseAlert" ADD CONSTRAINT "MedicationMissedDoseAlert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationMissedDoseAlert" ADD CONSTRAINT "MedicationMissedDoseAlert_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSummary" ADD CONSTRAINT "ConsultationSummary_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSummary" ADD CONSTRAINT "ConsultationSummary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSummary" ADD CONSTRAINT "ConsultationSummary_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

