import { AnyZodObject, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

const run =
  (Schema: AnyZodObject, where: 'body' | 'query' | 'params') =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = Schema.parse(req[where]);
      // assign back the parsed value
      (req as any)[where] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation error',
          errors: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      next(err);
    }
  };

export const validateBody = (schema: AnyZodObject) => run(schema, 'body');
export const validateQuery = (schema: AnyZodObject) => run(schema, 'query');
export const validateParams = (schema: AnyZodObject) => run(schema, 'params');
