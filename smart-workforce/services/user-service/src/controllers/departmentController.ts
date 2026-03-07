import { Request, Response, NextFunction } from 'express';
import deptService from '../services/departmentService';

export const createDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requester = (req as any).user;
    const department = await deptService.createDepartment(requester, req.body);
    res.status(201).json({ status: 'success', data: department });
  } catch (err: any) {
    if (err.message && err.message.includes('Organization not found')) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message && err.message.includes('Only organization admins')) {
      return res.status(403).json({ message: err.message });
    }
    if (
      err.message &&
      err.message.includes('Only admins of this organization')
    ) {
      return res.status(403).json({ message: err.message });
    }
    next(err);
  }
};

export const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departments = await deptService.getDepartments();
    res.json({ status: 'success', data: departments });
  } catch (err: any) {
    next(err);
  }
};

export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const requester = (req as any).user;
    const updated = await deptService.updateDepartment(id, req.body, requester);
    res.json({ status: 'success', data: updated });
  } catch (err: any) {
    if (err.message && err.message.includes('Organization not found'))
      return res.status(404).json({ message: err.message });
    if (
      err.message &&
      (err.message.includes('Only organization admins') ||
        err.message.includes('Only admins of this organization'))
    )
      return res.status(403).json({ message: err.message });
    if (err.message && err.message.includes('Department not found'))
      return res.status(404).json({ message: err.message });
    next(err);
  }
};

export const deleteDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const requester = (req as any).user;
    await deptService.deleteDepartment(id, requester);
    res.json({ message: 'Department deleted' });
  } catch (err: any) {
    if (err.message && err.message.includes('Cannot delete department'))
      return res.status(400).json({ message: err.message });
    if (err.message && err.message.includes('Only organization admins'))
      return res.status(403).json({ message: err.message });
    if (err.message && err.message.includes('Department not found'))
      return res.status(404).json({ message: err.message });
    next(err);
  }
};
