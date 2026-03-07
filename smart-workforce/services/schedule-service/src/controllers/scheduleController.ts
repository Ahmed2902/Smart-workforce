import service from '../services/scheduleService';
import { Request, Response, NextFunction } from 'express';
import { ScheduleInput } from '../types';
import AppError from '../utils/AppError';
import {
  publishScheduleCreated,
  publishScheduleUpdated,
  publishScheduleDeleted,
} from '../events/producer';

export const createSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const data = req.body as ScheduleInput;
    // Set the creator ID from the authenticated user
    data.createdById = userId;

    const schedule = await service.createSchedule(data);
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
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const filters = {
      organizationId: req.query.organizationId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      skip: req.query.skip ? parseInt(req.query.skip as string, 10) : 0,
      take: req.query.take ? parseInt(req.query.take as string, 10) : 20,
    };

    const schedules = await service.getSchedules(userId, filters);
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
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const schedule = await service.getScheduleById(userId, req.params.id);
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
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    const data: ScheduleInput = { id: req.params.id, ...req.body };
    const schedule = await service.updateSchedule(userId, data);
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
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401);
    }

    await service.deleteSchedule(userId, req.params.id);
    await publishScheduleDeleted(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
