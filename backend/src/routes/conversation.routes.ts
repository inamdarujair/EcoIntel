import { Router, Request, Response, NextFunction } from 'express';
import { Conversation, Message, EnvironmentalContext } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';

export const conversationRouter = Router();

// GET /api/conversations/:id
conversationRouter.get(
  '/conversations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return next(new AppError(`Invalid conversation ID: ${id}`, 400, 'INVALID_ID'));
      }

      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return next(new AppError(`Conversation not found with ID: ${id}`, 404, 'NOT_FOUND'));
      }

      const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });

      res.status(200).json({
        conversation,
        messages,
        linkedContextId: conversation.contextId ? conversation.contextId.toString() : null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/conversations/:id/context
conversationRouter.get(
  '/conversations/:id/context',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return next(new AppError(`Invalid conversation ID: ${id}`, 400, 'INVALID_ID'));
      }

      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return next(new AppError(`Conversation not found with ID: ${id}`, 404, 'NOT_FOUND'));
      }

      if (!conversation.contextId) {
        return next(
          new AppError(`No EnvironmentalContext linked to conversation: ${id}`, 404, 'CONTEXT_NOT_LINKED')
        );
      }

      const context = await EnvironmentalContext.findById(conversation.contextId);
      if (!context) {
        return next(
          new AppError(`Linked EnvironmentalContext ${conversation.contextId} no longer exists`, 404, 'NOT_FOUND')
        );
      }

      res.status(200).json(context);
    } catch (error) {
      next(error);
    }
  }
);
