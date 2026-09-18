import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = result.error as ZodError;
      const formattedIssues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      const summaryMessage = formattedIssues.length > 0
        ? `Validation failed: ${formattedIssues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; ')}`
        : 'Invalid request body';

      return next(
        new AppError(
          summaryMessage,
          400,
          'VALIDATION_ERROR',
          formattedIssues
        )
      );
    }

    req.body = result.data;
    next();
  };
}
