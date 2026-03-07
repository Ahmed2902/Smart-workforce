import prisma from '../prismaClient';
import * as client from './attendanceClient';

export const createPayroll = async (
  employeeId: string,
  period: string,
  basePay: number,
  overtimePay: number,
) => {
  const existing = await prisma.payroll.findFirst({
    where: { employeeId, period },
  });
  if (existing)
    throw new Error('Payroll already exists for this employee and period');

  const payroll = await prisma.payroll.create({
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

  return payroll;
};

export const calculatePayroll = async (employeeId: string, period: string) => {
  let totalPay = 0;
  let basePay = 0;
  let overTimePay = 0;
  const emp = await prisma.payroll.findFirst({
    where: { employeeId, period },
    select: { basePay: true, overtimePay: true },
  });

  if (!emp)
    throw new Error(
      'Payroll record not found for this employee and period. Create it first using createPayroll(employeeId, period, basePay, overtimePay)',
    );
  const { totalHours, overtimeHours } = await client.getEmployeeHours(
    employeeId,
    period,
  );

  basePay = totalHours * emp.basePay;
  overTimePay = overtimeHours * emp.overtimePay;
  totalPay = basePay + overTimePay;

  const payroll = await prisma.payroll.upsert({
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
      // createdAt will default to now(), updatedAt handled by @updatedAt
    },
  });

  return payroll;
};

// 🧱 CRUD
export const getAllPayrolls = async () => {
  return prisma.payroll.findMany({ orderBy: { createdAt: 'desc' } });
};

export const getPayrollById = async (id: string) => {
  return prisma.payroll.findUnique({ where: { id } });
};

export const updatePayroll = async (id: string, data: any) => {
  return prisma.payroll.update({ where: { id }, data });
};

export const deletePayroll = async (id: string) => {
  return prisma.payroll.delete({ where: { id } });
};
