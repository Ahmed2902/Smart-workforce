import { Request, Response, NextFunction } from 'express';
import { attendanceService } from '../services/attendanceService';
import {
  AuthenticatedUser,
  requireActor,
} from '../utils/accessControl';

export const checkIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { attendanceId } = req.body;
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const attendance = await attendanceService.CheckIn(actor, attendanceId);
    res.status(200).json({
      status: 'success',
      message: 'employee checked in succesffuly',
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

export const createAttendanceRecord = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId, shiftId, status } = req.body;
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const attendance = await attendanceService.createAttendanceRecord(
      actor,
      employeeId,
      shiftId,
      status,
    );
    res.status(201).json({
      status: 'success',
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

export const checkOut = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { attendanceId } = req.body;
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const attendance = await attendanceService.CheckOut(actor, attendanceId);
    res.status(200).json({
      status: 'success',
      message: 'Employee checked out successfully',
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

export const getEmployeeAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;

    const records = await attendanceService.getEmployeeAttendance(employeeId);
    res.status(200).json({
      status: 'success',
      results: records.length,
      data: records,
    });
  } catch (err) {
    next(err);
  }
};

export const getEmployeeHours = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const { period } = req.query; // format: YYYY-MM
    const { totalHours, overtimeHours } =
      await attendanceService.getEmployeeHours(employeeId, period as string);

    return res.status(200).json({
      employeeId,
      period,
      totalHours: parseFloat(totalHours.toFixed(2)),
      overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    });
  } catch (err) {
    return next(err);
  }
};
