import { Router, Request, Response } from 'express';
import { HealthResponse } from '../types';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});
