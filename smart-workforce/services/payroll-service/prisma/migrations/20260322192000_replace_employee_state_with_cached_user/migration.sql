DROP TABLE IF EXISTS "payroll"."EmployeeState";

-- CreateEnum
CREATE TYPE "payroll"."Role" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "payroll"."SystemRole" AS ENUM ('SUPERADMIN', 'USER');

-- CreateTable
CREATE TABLE "payroll"."CachedUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "systemRole" "payroll"."SystemRole" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "organizationRole" "payroll"."Role",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedUser_authUserId_key" ON "payroll"."CachedUser"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CachedUser_email_key" ON "payroll"."CachedUser"("email");

-- CreateIndex
CREATE INDEX "CachedUser_organizationId_idx" ON "payroll"."CachedUser"("organizationId");
