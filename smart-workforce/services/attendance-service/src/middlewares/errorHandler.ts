import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';

const isDev = process.env.NODE_ENV !== 'production';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Log the error
  if (isDev) {
    console.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
      error: err,
      stack: err.stack,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      status: 'fail',
      message: 'Database operation failed',
    });
  }

  // Handle validation errors (e.g., from Zod)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation error',
      errors: err.errors,
    });
  }

  // Default error
  console.error(err);
  res.status(500).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
};
