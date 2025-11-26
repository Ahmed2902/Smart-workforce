import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface AppError extends Error {
  status?: string;
  statusCode?: number;
  details?: any;
}

export default function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const status = err.status || (statusCode >= 500 ? 'error' : 'fail');
  const message = err.message || 'Internal Server Error';

  logger.error(
    `${req.method} ${req.originalUrl} - ${statusCode} - ${message}`,
    {
      details: err.details || null,
    },
  );

  res.status(statusCode).json({
    status,
    message,
    details: err.details || undefined,
  });
}
