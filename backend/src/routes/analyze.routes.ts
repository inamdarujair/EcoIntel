import { Router, Request, Response, NextFunction } from 'express';
import { validateBody, AppError } from '../middleware';
import { EnvironmentalContext, Conversation } from '../models';
import { isValidObjectId } from '../utils/objectId';
import { analyzeInputSchema, AnalyzeInput } from '../validation/contextSchema';
import { mergeContext } from '../services/contextService';

export const analyzeRouter = Router();

analyzeRouter.post(
  '/analyze',
  validateBody(analyzeInputSchema),
  async (req: Request<unknown, unknown, AnalyzeInput>, res: Response, next: NextFunction) => {
    try {
      const { conversationId, sourceIdentifier, ...incomingData } = req.body;

      let conversation = null;
      let targetContext = null;

      if (conversationId) {
        if (!isValidObjectId(conversationId)) {
          return next(new AppError(`Invalid conversation ID: ${conversationId}`, 400, 'INVALID_ID'));
        }

        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return next(new AppError(`Conversation not found with ID: ${conversationId}`, 404, 'NOT_FOUND'));
        }

        // If conversation already has a linked context, fetch it for merging
        if (conversation.contextId) {
          targetContext = await EnvironmentalContext.findById(conversation.contextId);
        }
      }

      const sourceId = sourceIdentifier || (conversation ? `turn_${conversation._id}` : 'direct_input');

      if (targetContext) {
        // Merge into existing context
        const mergedData = mergeContext(targetContext.toObject(), incomingData, sourceId);
        targetContext.set(mergedData);
        await targetContext.save();

        return res.status(200).json({
          message: 'Environmental context updated and merged successfully',
          context: targetContext,
          linkedConversationId: conversation!._id.toString(),
        });
      }

      // No existing context: create brand new merged context
      const initialMergedData = mergeContext({}, incomingData, sourceId);
      const newContext = new EnvironmentalContext(initialMergedData);
      await newContext.save();

      // Link to conversation if conversation exists
      if (conversation) {
        conversation.contextId = newContext._id;
        await conversation.save();
      }

      return res.status(201).json({
        message: 'Environmental context created successfully',
        context: newContext,
        linkedConversationId: conversation ? conversation._id.toString() : null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default analyzeRouter;
