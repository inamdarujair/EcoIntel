import { Router } from 'express';
import { healthRouter } from './health.routes';
import { chatRouter } from './chat.routes';
import { analyzeRouter } from './analyze.routes';
import { contextRouter } from './context.routes';
import { conversationRouter } from './conversation.routes';
import { recommendationRouter } from './recommendation.routes';
import { recommendationGenerateRouter } from './recommendations';
import { sourceRouter } from './source.routes';
import { knowledgeRouter } from './knowledge.routes';
import { reasoningDebugRouter } from './reasoningDebug';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(chatRouter);
apiRouter.use(analyzeRouter);
apiRouter.use(contextRouter);
apiRouter.use(conversationRouter);
apiRouter.use(recommendationRouter);
apiRouter.use('/recommendations', recommendationGenerateRouter);
apiRouter.use(sourceRouter);
apiRouter.use(knowledgeRouter);
apiRouter.use('/reasoning', reasoningDebugRouter);

export default apiRouter;
