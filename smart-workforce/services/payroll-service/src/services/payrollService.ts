import prisma from '../prismaClient';
import * as client from './attendanceClient';
import {
  publishPayrollApproved,
  publishPayrollCalculated,
  publishPayrollCreated,
  publishPayrollDeleted,
} from '../events/producer';

type MutationOptions = {
  skipEmployeeStateCheck?: boolean;
  publishEvent?: boolean;
};

const ensureEmployeeActive = async (
  employeeId: string,
  options?: MutationOptions,
) => {
  if (options?.skipEmployeeStateCheck) {
    return;
  }

  const state = await prisma.employeeState.findUnique({
    where: { employeeId },
  });

  if (state && !state.isActive) {
    throw new Error('Employee is inactive or deleted');
  }
};

export const createPayroll = async (
  employeeId: string,
  period: string,
  basePay: number,
  overtimePay: number,
  options?: MutationOptions,
) => {
  await ensureEmployeeActive(employeeId, options);
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

  if (options?.publishEvent !== false) {
    await publishPayrollCreated(payroll);
  }

  return payroll;
};

export const calculatePayroll = async (
  employeeId: string,
  period: string,
  options?: MutationOptions,
) => {
  await ensureEmployeeActive(employeeId, options);

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

  const totalPay = totalHours * emp.basePay + overtimeHours * emp.overtimePay;

  const payroll = await prisma.payroll.upsert({
    where: {
      employeeId_period: { employeeId, period },
    },
    update: {
      totalHours,
      overtimeHours,
      totalPay,
      status: 'COMPLETED',
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
      status: 'COMPLETED',
    },
  });

  if (options?.publishEvent !== false) {
    await publishPayrollCalculated(payroll);
  }

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
  const previous = await prisma.payroll.findUnique({ where: { id } });
  if (!previous) {
    throw new Error('Payroll not found');
  }

  const payroll = await prisma.payroll.update({ where: { id }, data });

  if (data.status === 'APPROVED' && previous.status !== 'APPROVED') {
    await publishPayrollApproved(payroll);
  }

  return payroll;
};

export const deletePayroll = async (id: string) => {
  const payroll = await prisma.payroll.delete({ where: { id } });
  await publishPayrollDeleted({
    id: payroll.id,
    employeeId: payroll.employeeId,
    period: payroll.period,
  });
  return payroll;
};
