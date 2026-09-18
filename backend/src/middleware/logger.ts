import { Request, Response, NextFunction } from 'express';
import config from '../config';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (!config.isDev) {
    return next();
  }

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    console.log(`[HTTP] ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
}
