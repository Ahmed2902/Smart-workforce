import { Response, Request } from 'express';

import * as service from '../services/payrollService';
import {
  AuthenticatedUser,
  requireActor,
} from '../utils/accessControl';

export const calculatePayroll = async (req: Request, res: Response) => {
  try {
    const { employeeId, period } = req.body;
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const payroll = await service.calculatePayroll(employeeId, period, {
      actor,
    });
    res.status(200).json({
      status: 'success',
      data: payroll,
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to calculate payroll';
    const status =
      err?.statusCode ||
      (message.includes('Failed to fetch employee hours') ? 502 : 400);
    res.status(status).json({ status: 'error', message });
  }
};

export const createPayroll = async (req: Request, res: Response) => {
  try {
    const { employeeId, period, basePay, overtimePay } = req.body;
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const payroll = await service.createPayroll(
      actor,
      employeeId,
      period,
      basePay,
      overtimePay,
    );
    res.status(201).json({ status: 'success', data: payroll });
  } catch (err: any) {
    const message = err?.message || 'Failed to create payroll';
    res.status(err?.statusCode || 400).json({ status: 'error', message });
  }
};

export const getAllPayrolls = async (req: Request, res: Response) => {
  try {
    const payrolls = await service.getAllPayrolls();
    res.status(200).json({ status: 'success', data: payrolls });
  } catch (err: any) {
    const message = err?.message || 'Failed to fetch payrolls';
    res.status(500).json({ status: 'error', message });
  }
};

export const getPayrollById = async (req: Request, res: Response) => {
  try {
    const payroll = await service.getPayrollById(req.params.id);
    if (!payroll)
      return res.status(404).json({ status: 'fail', message: 'Not found' });
    res.status(200).json({ status: 'success', data: payroll });
  } catch (err: any) {
    const message = err?.message || 'Failed to fetch payroll';
    res.status(500).json({ status: 'error', message });
  }
};

export const updatePayroll = async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const payroll = await service.updatePayroll(actor, req.params.id, req.body);
    res.status(200).json({ status: 'success', data: payroll });
  } catch (err: any) {
    const message = err?.message || 'Failed to update payroll';
    res.status(err?.statusCode || 400).json({ status: 'error', message });
  }
};

export const deletePayroll = async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    await service.deletePayroll(actor, req.params.id);
    res.status(204).send();
  } catch (err: any) {
    const message = err?.message || 'Failed to delete payroll';
    res.status(err?.statusCode || 400).json({ status: 'error', message });
  }
};
