-- AlterTable
ALTER TABLE "User" ADD COLUMN "doctorStatus" TEXT DEFAULT 'VERIFIED';
ALTER TABLE "User" ADD COLUMN "experienceYears" INTEGER;
ALTER TABLE "User" ADD COLUMN "medicalCouncil" TEXT;
ALTER TABLE "User" ADD COLUMN "qualification" TEXT;
ALTER TABLE "User" ADD COLUMN "rating" REAL DEFAULT 4.8;
ALTER TABLE "User" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "specialization" TEXT;
