/*
  Warnings:

  - You are about to drop the column `departmentId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "users"."SystemRole" AS ENUM ('SUPERADMIN', 'USER');

-- DropForeignKey
ALTER TABLE "users"."User" DROP CONSTRAINT "User_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "users"."User" DROP CONSTRAINT "User_organizationId_fkey";

-- AlterTable
ALTER TABLE "users"."User" DROP COLUMN "departmentId",
DROP COLUMN "organizationId",
DROP COLUMN "role",
ADD COLUMN     "systemRole" "users"."SystemRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "users"."OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "users"."UserRole" NOT NULL DEFAULT 'EMPLOYEE',

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."_DepartmentUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "users"."OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "_DepartmentUsers_AB_unique" ON "users"."_DepartmentUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_DepartmentUsers_B_index" ON "users"."_DepartmentUsers"("B");

-- AddForeignKey
ALTER TABLE "users"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "users"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "users"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
