import { Router, Request, Response, NextFunction } from 'express';
import { EnvironmentalContext } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';

export const contextRouter = Router();

contextRouter.get(
  '/contexts/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return next(new AppError(`Invalid EnvironmentalContext ID: ${id}`, 400, 'INVALID_ID'));
      }

      const context = await EnvironmentalContext.findById(id);

      if (!context) {
        return next(
          new AppError(`EnvironmentalContext not found with ID: ${id}`, 404, 'NOT_FOUND')
        );
      }

      res.status(200).json(context);
    } catch (error) {
      next(error);
    }
  }
);
