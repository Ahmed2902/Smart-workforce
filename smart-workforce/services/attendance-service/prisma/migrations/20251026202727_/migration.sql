-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "attendance";

-- CreateEnum
CREATE TYPE "attendance"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'SCHEDULED', 'LEFT_EARLY');

-- CreateEnum
CREATE TYPE "attendance"."LeaveType" AS ENUM ('SICK', 'VACATION', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "attendance"."LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance"."Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "status" "attendance"."AttendanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance"."LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "attendance"."LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "attendance"."LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "attendance"."Attendance"("employeeId");

-- CreateIndex
CREATE INDEX "Attendance_shiftId_idx" ON "attendance"."Attendance"("shiftId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "attendance"."LeaveRequest"("employeeId");
