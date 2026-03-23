import { Request, Response, NextFunction } from 'express';
import * as service from '../services/shiftService';
import * as assignService from '../services/assignmentService';
import { AuthenticatedUser, ShiftInput, shiftAssignmentInput } from '../types';
import { requireActor } from '../utils/accessControl';

export const createShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const data = {
      ...(req.body as Partial<ShiftInput>),
      createdById: actor.id,
    } as ShiftInput;
    const shift = await service.createShift(actor, data);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    // Get scheduleId from query params instead of route params
    const scheduleId = req.query.scheduleId as string;
    const shifts = await service.getShifts(actor, scheduleId);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const shift = await service.getShiftById(actor, req.params.id);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const shift = await service.updateShift(actor, req.params.id, req.body);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const shift = await service.deleteShift(actor, req.params.id);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const data = {
      ...(req.body as shiftAssignmentInput),
      assignedBy: actor.id,
    };
    const assignment = await assignService.assignEmployee(actor, data);
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const assignment = await assignService.unsassignEmployee(
      actor,
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
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const assignments = await assignService.getAssignments(
      actor,
      req.params.shiftId,
    );
    res.status(200).json({ status: 'success', data: assignments });
  } catch (err) {
    next(err);
  }
};
