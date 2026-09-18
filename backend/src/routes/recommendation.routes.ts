import { Router, Request, Response, NextFunction } from 'express';
import { Recommendation } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';

export const recommendationRouter = Router();

recommendationRouter.get(
  '/recommendations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return next(new AppError(`Invalid recommendation ID: ${id}`, 400, 'INVALID_ID'));
      }

      const recommendation = await Recommendation.findById(id);
      if (!recommendation) {
        return next(new AppError(`Recommendation not found with ID: ${id}`, 404, 'NOT_FOUND'));
      }

      res.status(200).json(recommendation);
    } catch (error) {
      next(error);
    }
  }
);
