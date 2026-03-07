import { PrismaClient } from '@prisma/client';
import attendanceClient from './attendanceClient';

const prisma = new PrismaClient();

export class PayrollService {
  async createPayroll(
    employeeId: string,
    period: string,
    basePay: number,
    overtimePay: number,
  ) {
    const existing = await prisma.payroll.findFirst({
      where: { employeeId, period },
    });
    if (existing) {
      throw new Error('Payroll already exists for this employee and period');
    }

    return prisma.payroll.create({
      data: {
        employeeId,
        period,
        basePay,
        overtimePay,
        status: 'PENDING',
        totalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
      },
    });
  }

  async calculatePayroll(employeeId: string, period: string) {
    let totalPay = 0;
    let basePay = 0;
    let overTimePay = 0;
    const emp = await prisma.payroll.findFirst({
      where: { employeeId, period },
      select: { basePay: true, overtimePay: true },
    });

    if (!emp) {
      throw new Error(
        'Payroll record not found for this employee and period. Create it first using createPayroll(employeeId, period, basePay, overtimePay)',
      );
    }
    const { totalHours, overtimeHours } = await attendanceClient.getEmployeeHours(
      employeeId,
      period,
    );

    basePay = totalHours * emp.basePay;
    overTimePay = overtimeHours * emp.overtimePay;
    totalPay = basePay + overTimePay;

    return prisma.payroll.upsert({
      where: {
        employeeId_period: { employeeId, period },
      },
      update: {
        totalHours,
        overtimeHours,
        totalPay,
        updatedAt: new Date(),
      },
      create: {
        employeeId,
        period,
        basePay: emp.basePay,
        overtimePay: emp.overtimePay,
        totalHours,
        overtimeHours,
        totalPay,
      },
    });
  }

  async getAllPayrolls() {
    return prisma.payroll.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getPayrollById(id: string) {
    return prisma.payroll.findUnique({ where: { id } });
  }

  async updatePayroll(id: string, data: any) {
    return prisma.payroll.update({ where: { id }, data });
  }

  async deletePayroll(id: string) {
    return prisma.payroll.delete({ where: { id } });
  }
}

export default new PayrollService();
