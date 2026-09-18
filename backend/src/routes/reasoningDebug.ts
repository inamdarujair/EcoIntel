import { Router, Request, Response, NextFunction } from 'express';
import { Conversation, EnvironmentalContext } from '../models';
import { AppError } from '../middleware';
import { isValidObjectId } from '../utils/objectId';
import { ReasoningEngine } from '../reasoning/reasoningEngine';
import { EnvironmentalContext as IEnvironmentalContext } from '../types';

export const reasoningDebugRouter = Router();

reasoningDebugRouter.post(
  '/evaluate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, context } = req.body;
      
      let evalContext: IEnvironmentalContext | null = null;
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
        // Use directly provided context for tests
        evalContext = context as IEnvironmentalContext;
      }

      // If still no context, provide empty object
      if (!evalContext) {
        evalContext = {} as IEnvironmentalContext;
      }

      const evaluationResult = await ReasoningEngine.evaluateWithEvidence(evalContext);

      return res.status(200).json({
        conversationId: linkedConversation ? linkedConversation._id.toString() : null,
        context: evalContext,
        triggeredPathways: evaluationResult.triggeredPathways,
        summary: {
          pathwayCount: evaluationResult.pathwayCount,
          distinctVariablesUsed: evaluationResult.distinctVariablesUsed,
          distinctVariableCount: evaluationResult.distinctVariablesUsed.length,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);
