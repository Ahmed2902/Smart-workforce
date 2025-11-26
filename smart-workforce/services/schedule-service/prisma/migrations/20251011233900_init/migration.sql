-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "schedule";

-- CreateEnum
CREATE TYPE "schedule"."Role" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "schedule"."SystemRole" AS ENUM ('SUPERADMIN', 'USER');

-- CreateTable
CREATE TABLE "schedule"."Schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."Shift" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "name" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "unassignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."CachedUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "role" "schedule"."Role" NOT NULL DEFAULT 'EMPLOYEE',
    "systemRole" "schedule"."SystemRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "CachedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."CachedDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CachedDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."CachedOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CachedOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."CachedOrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "schedule"."Role" NOT NULL DEFAULT 'EMPLOYEE',

    CONSTRAINT "CachedOrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule"."_Schedule_createdBy" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Schedule_createdBy_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Schedule_organizationId_idx" ON "schedule"."Schedule"("organizationId");

-- CreateIndex
CREATE INDEX "Schedule_departmentId_idx" ON "schedule"."Schedule"("departmentId");

-- CreateIndex
CREATE INDEX "Schedule_createdById_idx" ON "schedule"."Schedule"("createdById");

-- CreateIndex
CREATE INDEX "Shift_scheduleId_idx" ON "schedule"."Shift"("scheduleId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeId_idx" ON "schedule"."ShiftAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftId_idx" ON "schedule"."ShiftAssignment"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_shiftId_employeeId_key" ON "schedule"."ShiftAssignment"("shiftId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CachedUser_email_key" ON "schedule"."CachedUser"("email");

-- CreateIndex
CREATE INDEX "CachedUser_organizationId_idx" ON "schedule"."CachedUser"("organizationId");

-- CreateIndex
CREATE INDEX "CachedUser_departmentId_idx" ON "schedule"."CachedUser"("departmentId");

-- CreateIndex
CREATE INDEX "CachedDepartment_organizationId_idx" ON "schedule"."CachedDepartment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CachedOrganizationMembership_userId_organizationId_key" ON "schedule"."CachedOrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "_Schedule_createdBy_B_index" ON "schedule"."_Schedule_createdBy"("B");

-- AddForeignKey
ALTER TABLE "schedule"."Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "schedule"."CachedUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."Schedule" ADD CONSTRAINT "Schedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "schedule"."CachedOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."Schedule" ADD CONSTRAINT "Schedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "schedule"."CachedDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."Shift" ADD CONSTRAINT "Shift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedule"."Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."Shift" ADD CONSTRAINT "Shift_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "schedule"."CachedUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "schedule"."Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "schedule"."CachedUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."CachedUser" ADD CONSTRAINT "CachedUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "schedule"."CachedOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."CachedUser" ADD CONSTRAINT "CachedUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "schedule"."CachedDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."CachedDepartment" ADD CONSTRAINT "CachedDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "schedule"."CachedOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."CachedOrganizationMembership" ADD CONSTRAINT "CachedOrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "schedule"."CachedUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."CachedOrganizationMembership" ADD CONSTRAINT "CachedOrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "schedule"."CachedOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."_Schedule_createdBy" ADD CONSTRAINT "_Schedule_createdBy_A_fkey" FOREIGN KEY ("A") REFERENCES "schedule"."CachedUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule"."_Schedule_createdBy" ADD CONSTRAINT "_Schedule_createdBy_B_fkey" FOREIGN KEY ("B") REFERENCES "schedule"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
