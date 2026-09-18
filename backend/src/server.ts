import express from 'express';
import config from './config';
import { connectDB } from './db/connection';
import { corsMiddleware, requestLogger, notFoundHandler, errorHandler } from './middleware';
import { apiRouter } from './routes';

const app = express();

// Security & Parsing Middleware
app.use(corsMiddleware);
app.use(express.json());

// Request Logging Middleware (dev-only)
app.use(requestLogger);

// Mount API Routes under /api
app.use('/api', apiRouter);

// 404 Route Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

// Connect to MongoDB and start listening
export async function startServer() {
  try {
    // Connect to database before listening
    await connectDB();

    if (process.env.NODE_ENV !== 'test') {
      const server = app.listen(config.port, () => {
        console.log(`[EcoIntel Backend] Server running on port ${config.port} (${config.nodeEnv})`);
      });
      return server;
    }
  } catch (error) {
    console.error('[EcoIntel Backend Startup Error] Could not start server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
