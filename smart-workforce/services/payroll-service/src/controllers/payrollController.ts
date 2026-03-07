import { Response, Request } from 'express';

import service from '../services/payrollService';

export const calculatePayroll = async (req: Request, res: Response) => {
  const { employeeId, period } = req.body;
  const payroll = await service.calculatePayroll(employeeId, period);
  res.status(200).json({
    status: 'success',
    data: payroll,
  });
};

export const createPayroll = async (req: Request, res: Response) => {
  const { employeeId, period, basePay, overtimePay } = req.body;
  const payroll = await service.createPayroll(
    employeeId,
    period,
    basePay,
    overtimePay,
  );
  res.status(201).json({ status: 'success', data: payroll });
};

export const getAllPayrolls = async (req: Request, res: Response) => {
  const payrolls = await service.getAllPayrolls();
  res.status(200).json({ status: 'success', data: payrolls });
};

export const getPayrollById = async (req: Request, res: Response) => {
  const payroll = await service.getPayrollById(req.params.id);
  if (!payroll)
    return res.status(404).json({ status: 'fail', message: 'Not found' });
  res.status(200).json({ status: 'success', data: payroll });
};

export const updatePayroll = async (req: Request, res: Response) => {
  const payroll = await service.updatePayroll(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: payroll });
};

export const deletePayroll = async (req: Request, res: Response) => {
  await service.deletePayroll(req.params.id);
  res.status(204).send();
};
