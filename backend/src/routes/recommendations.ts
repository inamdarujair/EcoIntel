import { Router, Request, Response, NextFunction } from 'express';
import { Conversation, EnvironmentalContext } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';
import { RecommendationEngine } from '../reasoning/recommendationEngine';

export const recommendationGenerateRouter = Router();

recommendationGenerateRouter.post(
  '/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, context } = req.body;
      
      let evalContext = null;
      let linkedConversation = null;

      if (conversationId) {
        if (!isValidObjectId(conversationId)) {
          return next(new AppError(`Invalid conversation ID: ${conversationId}`, 400, 'INVALID_ID'));
        }
        linkedConversation = await Conversation.findById(conversationId);
        if (!linkedConversation) {
          return next(new AppError(`Conversation not found with ID: ${conversationId}`, 404, 'NOT_FOUND'));
        }
        
        if (linkedConversation.contextId) {
          evalContext = await EnvironmentalContext.findById(linkedConversation.contextId);
        }
      } else if (context) {
        // Direct context for tests
        evalContext = context;
      }

      if (!evalContext) {
        evalContext = {}; // empty context
      }

      const result = await RecommendationEngine.generate(evalContext as any, linkedConversation?._id?.toString());

      return res.status(200).json({
        conversationId: linkedConversation ? linkedConversation._id.toString() : null,
        recommendations: result.recommendations,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }
);
