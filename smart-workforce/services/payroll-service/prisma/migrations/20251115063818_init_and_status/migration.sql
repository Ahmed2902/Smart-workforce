/*
  Warnings:

  - The `status` column on the `Payroll` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[employeeId,period]` on the table `Payroll` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "payroll"."status" AS ENUM ('PENDING', 'COMPLETED', 'APPROVED');

-- AlterTable
ALTER TABLE "payroll"."Payroll" DROP COLUMN "status",
ADD COLUMN     "status" "payroll"."status" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_period_key" ON "payroll"."Payroll"("employeeId", "period");
