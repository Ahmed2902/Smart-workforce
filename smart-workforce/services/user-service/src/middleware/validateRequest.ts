import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema): RequestHandler => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return res
        .status(400)
        .json({
          status: 'fail',
          message: 'Invalid request',
          details: result.error.errors,
        });
    req.body = result.data;
    next();
  };
};
