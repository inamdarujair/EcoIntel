import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, AppError } from '../middleware';
import { Conversation, Message, EnvironmentalContext } from '../models';
import { isValidObjectId } from '../utils/objectId';
import { extractEnvironmentalContext } from '../services/extractionService';
import { mergeContext } from '../services/contextService';
import { ReasoningEngine, RecommendationEngine, ClarificationService } from '../reasoning';
import { EnvironmentalContext as IEnvironmentalContext } from '../types';

export const chatRouter = Router();

const chatRequestSchema = z.object({
  message: z.string({ message: 'Message is required' }).trim().min(1, 'Message cannot be empty'),
  conversationId: z.string().trim().optional(),
});

type ChatRequestBody = z.infer<typeof chatRequestSchema>;

/**
 * Formats a clean, context-aware assistant acknowledgement for extracted fields.
 * Conforms strictly to Phase 7 without generating speculative recommendations.
 */
function formatExtractionAcknowledgement(
  extracted: Partial<IEnvironmentalContext>,
  newFields: string[]
): string {
  if (newFields.length === 0) {
    return 'Received your message. No new environmental variables were detected in this message.';
  }

  const fieldDescriptions: string[] = [];

  if (newFields.includes('soil.organicCarbon') && extracted.soil?.organicCarbon !== undefined) {
    fieldDescriptions.push(`soil organic carbon as ${extracted.soil.organicCarbon}%`);
  }
  if (newFields.includes('soil.ph') && extracted.soil?.ph !== undefined) {
    fieldDescriptions.push(`soil pH as ${extracted.soil.ph}`);
  }
  if (newFields.includes('soil.moisture') && extracted.soil?.moisture !== undefined) {
    fieldDescriptions.push(`soil moisture as ${extracted.soil.moisture}%`);
  }
  if (newFields.includes('climate.temperature') && extracted.climate?.temperature !== undefined) {
    fieldDescriptions.push(`temperature as ${extracted.climate.temperature}°C`);
  }
  if (newFields.includes('climate.rainfall') && extracted.climate?.rainfall !== undefined) {
    const rf = extracted.climate.rainfall;
    fieldDescriptions.push(`rainfall as ${typeof rf === 'number' ? `${rf} mm` : rf}`);
  }
  if (newFields.includes('landUse.type') && extracted.landUse?.type) {
    fieldDescriptions.push(`land use type as ${extracted.landUse.type}`);
  }
  if (newFields.includes('landUse.fragmentation') && extracted.landUse?.fragmentation !== undefined) {
    fieldDescriptions.push(`habitat fragmentation as ${extracted.landUse.fragmentation}`);
  }
  if (newFields.includes('biodiversity.speciesRichness') && extracted.biodiversity?.speciesRichness !== undefined) {
    fieldDescriptions.push(`species richness as ${extracted.biodiversity.speciesRichness}`);
  }
  if (newFields.includes('biodiversity.habitatDiversity') && extracted.biodiversity?.habitatDiversity !== undefined) {
    fieldDescriptions.push(`habitat diversity as ${extracted.biodiversity.habitatDiversity}`);
  }
  if (newFields.includes('humanImpact.pollution') && extracted.humanImpact?.pollution !== undefined) {
    fieldDescriptions.push(`pollution index as ${extracted.humanImpact.pollution}`);
  }
  if (newFields.includes('humanImpact.deforestation') && extracted.humanImpact?.deforestation !== undefined) {
    fieldDescriptions.push(`deforestation as ${extracted.humanImpact.deforestation}`);
  }
  if (newFields.includes('region') && extracted.region) {
    fieldDescriptions.push(`region as ${extracted.region}`);
  }

  const formatted = fieldDescriptions.length > 0 ? fieldDescriptions.join(' and ') : newFields.join(', ');
  return `I've recorded your ${formatted}. Your environmental context has been updated.`;
}

chatRouter.post(
  '/chat',
  validateBody(chatRequestSchema),
  async (req: Request<unknown, unknown, ChatRequestBody>, res: Response, next: NextFunction) => {
    try {
      const { message, conversationId } = req.body;
      let conversation;

      // 1. Find or create Conversation
      if (conversationId) {
        if (!isValidObjectId(conversationId)) {
          return next(new AppError(`Invalid conversation ID: ${conversationId}`, 400, 'INVALID_ID'));
        }

        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return next(new AppError(`Conversation not found with ID: ${conversationId}`, 404, 'NOT_FOUND'));
        }
      } else {
        const title = message.length > 40 ? `${message.substring(0, 37)}...` : message;
        conversation = new Conversation({
          title,
          metadata: { createdVia: 'chat_api' },
        });
        await conversation.save();
      }

      // 2. Save user message
      const userMessage = new Message({
        conversationId: conversation._id,
        role: 'user',
        content: message,
      });
      await userMessage.save();

      // 3. Load existing EnvironmentalContext (if linked to conversation)
      let currentContextDoc = null;
      if (conversation.contextId) {
        currentContextDoc = await EnvironmentalContext.findById(conversation.contextId);
      }

      const existingContextData = currentContextDoc ? currentContextDoc.toObject() : undefined;

      // 4. Extract environmental fields from message (Rule pre-pass + Gemini assistance)
      const extractionResult = await extractEnvironmentalContext(message, existingContextData);

      const hasExtractedFields = Object.keys(extractionResult.extractedContext).length > 0;
      const sourceId = `msg_${userMessage._id.toString()}`;

      // Track previously requested fields
      const previouslyRequestedFields = (conversation.metadata?.requestedFields as string[]) || [];

      // 5. If valid fields were found, merge into persistent context using Phase 3 mergeContext()
      if (hasExtractedFields) {
        if (currentContextDoc) {
          // Merge into existing context
          const mergedData = mergeContext(
            currentContextDoc.toObject(),
            extractionResult.extractedContext,
            sourceId
          );
          currentContextDoc.set(mergedData);
          await currentContextDoc.save();
        } else {
          // Create brand new EnvironmentalContext
          const initialMerged = mergeContext(
            {},
            extractionResult.extractedContext,
            sourceId
          );
          currentContextDoc = new EnvironmentalContext(initialMerged);
          await currentContextDoc.save();

          // Link to conversation
          conversation.contextId = currentContextDoc._id;
          await conversation.save();
        }
      }

      // 6. Generate context-aware assistant reply (Orchestrating Phase 8/9/10)
      let assistantReply = "";
      
      const finalContextObj = currentContextDoc ? currentContextDoc.toObject() : {};

      if (hasExtractedFields && currentContextDoc) {
        // We have environmental context to evaluate
        
        // a. run Phase 8 evaluate()
        const reasoningResult = await ReasoningEngine.evaluate(finalContextObj);
        
        // b. if pathways trigger, run Phase 9
        if (reasoningResult.pathwayCount > 0) {
          const recResult = await RecommendationEngine.generate(finalContextObj, conversation._id.toString());
          const sufficientRecs = recResult.recommendations.filter(r => r.metadata?.evidenceStatus === 'sufficient');
          
          if (sufficientRecs.length > 0) {
            // c. if sufficient recommendation exists, return it
            assistantReply = `I have generated ${sufficientRecs.length} recommendation(s) based on your context.`;
          }
        }
        
        // d. otherwise inspect deterministic clarification candidates
        if (!assistantReply) {
          const triggeredIds = reasoningResult.triggeredPathways.map(p => p.pathwayId);
          
          const clarificationDecision = ClarificationService.getClarificationCandidates(
            finalContextObj,
            triggeredIds,
            previouslyRequestedFields
          );
          
          if (clarificationDecision.shouldAsk) {
            // e. ask clarification only if justified
            assistantReply = await ClarificationService.generateQuestion(clarificationDecision);
            
            // Track requested fields to prevent repeats
            const newRequested = Array.from(new Set([...previouslyRequestedFields, ...clarificationDecision.missingVariables]));
            conversation.metadata = {
              ...conversation.metadata,
              requestedFields: newRequested
            };
          } else {
            // Fallback acknowledgment if no clarification or recs
            assistantReply = formatExtractionAcknowledgement(
              extractionResult.extractedContext,
              extractionResult.newFieldsFound
            );
          }
        }
      } else {
        // 7. For simple conversational messages: preserve context and return natural acknowledgement.
        assistantReply = "I understand. Please let me know if you have any environmental data to share.";
        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
          assistantReply = "Hello! How can I help you with your environmental analysis today?";
        }
      }

      // 8. Save assistant message
      const assistantMessage = new Message({
        conversationId: conversation._id,
        role: 'assistant',
        content: assistantReply,
      });
      await assistantMessage.save();

      // Update conversation updatedAt
      conversation.updatedAt = new Date();
      await conversation.save();

      if (finalContextObj?.soil) {
        delete (finalContextObj.soil as any).pH;
        delete (finalContextObj.soil as any).soil_pH;
      }
      if (finalContextObj?.fieldSources) {
        delete (finalContextObj.fieldSources as any)['soil.pH'];
      }

      // 9. Return structured response preserving all legacy fields plus extraction metadata
      return res.status(200).json({
        conversationId: conversation._id.toString(),
        reply: assistantReply,
        messageId: assistantMessage._id.toString(),
        userMessageId: userMessage._id.toString(),
        extraction: {
          extractedContext: extractionResult.extractedContext,
          newFieldsFound: extractionResult.newFieldsFound,
          fieldMetadata: extractionResult.fieldMetadata,
          llmAttempted: extractionResult.llmAttempted,
          llmSuccess: extractionResult.llmSuccess,
        },
        context: finalContextObj,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default chatRouter;
