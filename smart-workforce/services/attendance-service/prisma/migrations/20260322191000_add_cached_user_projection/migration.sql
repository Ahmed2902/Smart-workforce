-- CreateEnum
CREATE TYPE "attendance"."Role" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "attendance"."SystemRole" AS ENUM ('SUPERADMIN', 'USER');

-- CreateTable
CREATE TABLE "attendance"."CachedUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "systemRole" "attendance"."SystemRole" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "organizationRole" "attendance"."Role",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedUser_authUserId_key" ON "attendance"."CachedUser"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CachedUser_email_key" ON "attendance"."CachedUser"("email");

-- CreateIndex
CREATE INDEX "CachedUser_organizationId_idx" ON "attendance"."CachedUser"("organizationId");
