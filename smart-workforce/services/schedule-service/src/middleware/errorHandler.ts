import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ status: err.status, message: err.message });
  }

  // Fallback
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
};
