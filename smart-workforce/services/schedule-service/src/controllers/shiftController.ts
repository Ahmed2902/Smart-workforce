import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as service from '../services/shiftService';
import * as assignService from '../services/assignmentService';
import { ShiftInput, shiftAssignmentInput } from '../types';

export const createShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = req.body as ShiftInput;
    console.log('the body', data);
    const shift = await service.createShift(data);
    res.status(200).json({ status: 'success', data: shift });
  } catch (err) {
    next(err);
  }
};

export const getShifts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Get scheduleId from query params instead of route params
    const scheduleId = req.query.scheduleId as string;
    const shifts = await service.getShifts(scheduleId);
    res.status(200).json({ status: 'success', data: shifts });
  } catch (err) {
    next(err);
  }
};

export const getShiftById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shift = await service.getShiftById(req.params.id);
    res.status(200).json({ status: 'success', data: shift });
  } catch (err) {
    next(err);
  }
};

export const updateShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shift = await service.updateShift(req.params.id, req.body);
    res.status(200).json({ status: 'success', data: shift });
  } catch (err) {
    next(err);
  }
};

export const deleteShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shift = await service.deleteShift(req.params.id);
    res.status(200).json({ status: 'success', data: shift });
  } catch (err) {
    next(err);
  }
};

// --- Assignments ---
export const assignEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = req.body as shiftAssignmentInput;
    const assignment = await assignService.assignEmployee(data);
    res.status(201).json({ status: 'success', data: assignment });
  } catch (err) {
    next(err);
  }
};

export const unassignEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const assignment = await assignService.unsassignEmployee(
      req.params.shiftId,
      req.params.employeeId,
    );
    res.status(200).json({ status: 'success', data: assignment });
  } catch (err) {
    next(err);
  }
};

export const getAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const assignments = await assignService.getAssignments(req.params.shiftId);
    res.status(200).json({ status: 'success', data: assignments });
  } catch (err) {
    next(err);
  }
};
