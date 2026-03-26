import prisma from '../prismaClient';
import * as client from './attendanceClient';
import AppError from '../utils/AppError';
import {
  publishPayrollApproved,
  publishPayrollCalculated,
  publishPayrollCreated,
  publishPayrollDeleted,
} from '../events/producer';
import {
  assertOrgWriteAccess,
  AuthenticatedUser,
} from '../utils/accessControl';

type MutationOptions = {
  skipEmployeeStateCheck?: boolean;
  publishEvent?: boolean;
  actor?: AuthenticatedUser;
};

const getCachedEmployee = async (employeeId: string) =>
  prisma.cachedUser.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
    },
  });

const ensureEmployeeActive = async (
  employeeId: string,
  options?: MutationOptions,
) => {
  const cachedUser = await getCachedEmployee(employeeId);
  if (!cachedUser) {
    throw new AppError('Employee not found in cache', 404);
  }

  if (options?.actor) {
    assertOrgWriteAccess(
      options.actor,
      cachedUser.organizationId,
      'You can only manage payroll for your organization',
    );
  }

  if (options?.skipEmployeeStateCheck) {
    return;
  }

  if (!cachedUser.isActive) {
    throw new Error('Employee is inactive or deleted');
  }
};

export const createPayroll = async (
  actor: AuthenticatedUser,
  employeeId: string,
  period: string,
  basePay: number,
  overtimePay: number,
  options?: MutationOptions,
) => {
  await ensureEmployeeActive(employeeId, { ...options, actor });
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

  console.log(
    `[Payroll] Calculated hours for ${employeeId}@${period}: totalHours=${totalHours}, overtimeHours=${overtimeHours}`,
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

export const updatePayroll = async (
  actor: AuthenticatedUser,
  id: string,
  data: any,
) => {
  const previous = await prisma.payroll.findUnique({ where: { id } });
  if (!previous) {
    throw new Error('Payroll not found');
  }

  await ensureEmployeeActive(previous.employeeId, {
    actor,
    skipEmployeeStateCheck: true,
  });

  const payroll = await prisma.payroll.update({ where: { id }, data });

  if (data.status === 'APPROVED' && previous.status !== 'APPROVED') {
    await publishPayrollApproved(payroll);
  }

  return payroll;
};

export const deletePayroll = async (actor: AuthenticatedUser, id: string) => {
  const existing = await prisma.payroll.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Payroll not found');
  }

  await ensureEmployeeActive(existing.employeeId, {
    actor,
    skipEmployeeStateCheck: true,
  });

  const payroll = await prisma.payroll.delete({ where: { id } });
  await publishPayrollDeleted({
    id: payroll.id,
    employeeId: payroll.employeeId,
    period: payroll.period,
  });
  return payroll;
};
