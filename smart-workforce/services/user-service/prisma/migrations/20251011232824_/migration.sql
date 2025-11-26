/*
  Warnings:

  - The `role` column on the `OrganizationMembership` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "users"."Role" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE');

-- AlterTable
ALTER TABLE "users"."OrganizationMembership" DROP COLUMN "role",
ADD COLUMN     "role" "users"."Role" NOT NULL DEFAULT 'EMPLOYEE';

-- AlterTable
ALTER TABLE "users"."User" ADD COLUMN     "role" "users"."Role" NOT NULL DEFAULT 'EMPLOYEE';

-- DropEnum
DROP TYPE "users"."UserRole";
