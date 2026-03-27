/*
  Warnings:

  - You are about to drop the `ChatMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatMessage";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MedicationOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicationOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicationOrder_prescribedByDoctorId_fkey" FOREIGN KEY ("prescribedByDoctorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationAdherence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "takenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "MedicationAdherence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicationAdherence_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationMissedDoseAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    CONSTRAINT "MedicationMissedDoseAlert_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicationMissedDoseAlert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicationMissedDoseAlert_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "MedicationOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "message_id" TEXT NOT NULL PRIMARY KEY,
    "appointment_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachmentType" TEXT,
    "encryption_key_reference" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
CREATE INDEX "chat_messages_appointment_id_timestamp_idx" ON "chat_messages"("appointment_id", "timestamp");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_receiver_id_timestamp_idx" ON "chat_messages"("sender_id", "receiver_id", "timestamp");
