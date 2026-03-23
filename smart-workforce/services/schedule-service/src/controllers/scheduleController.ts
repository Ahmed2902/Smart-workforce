import * as service from '../services/scheduleService';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser, ScheduleInput } from '../types';
import {
  publishScheduleCreated,
  publishScheduleUpdated,
  publishScheduleDeleted,
} from '../events/producer';
import { requireActor } from '../utils/accessControl';

export const createSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const data = req.body as ScheduleInput;
    data.createdById = actor.id;

    const schedule = await service.createSchedule(actor, data);
    await publishScheduleCreated(schedule);
    res.status(200).json({
      status: 'successful',
      data: schedule,
    });
  } catch (err) {
    next(err);
  }
};

// controllers/scheduleController.ts
export const getSchedules = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const filters = {
      organizationId: req.query.organizationId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      skip: req.query.skip ? parseInt(req.query.skip as string, 10) : 0,
      take: req.query.take ? parseInt(req.query.take as string, 10) : 20,
    };

    const schedules = await service.getSchedules(actor, filters);
    res.status(200).json({
      status: 'success',
      count: schedules.length,
      data: schedules,
    });
  } catch (err) {
    next(err);
  }
};

export const getScheduleById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const schedule = await service.getScheduleById(actor, req.params.id);
    res.status(200).json({
      status: 'success',
      data: schedule,
    });
  } catch (err) {
    next(err);
  }
};

// ... existing code ...
export const updateSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    const data: ScheduleInput = { id: req.params.id, ...req.body };
    const schedule = await service.updateSchedule(actor, data);
    await publishScheduleUpdated(schedule);
    res.status(200).json({
      status: 'success',
      data: schedule,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireActor(req.user as AuthenticatedUser | undefined);
    await service.deleteSchedule(actor, req.params.id);
    await publishScheduleDeleted(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
