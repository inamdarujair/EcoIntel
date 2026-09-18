import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  corsOrigin: string;
  mongodbUri: string;
  geminiApiKey: string;
  nodeEnv: string;
  isDev: boolean;
}

function loadConfig(): AppConfig {
  const missingVars: string[] = [];

  if (!process.env.MONGODB_URI) {
    missingVars.push('MONGODB_URI');
  }

  if (!process.env.GEMINI_API_KEY) {
    missingVars.push('GEMINI_API_KEY');
  }

  if (missingVars.length > 0) {
    const message = `[EcoIntel Configuration Error] Missing required environment variable(s): ${missingVars.join(', ')}. Please set them in your .env file.`;
    console.error(message);
    throw new Error(message);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return Object.freeze({
    port: isNaN(port) ? 5000 : port,
    corsOrigin,
    mongodbUri: process.env.MONGODB_URI as string,
    geminiApiKey: process.env.GEMINI_API_KEY as string,
    nodeEnv,
    isDev: nodeEnv !== 'production',
  });
}

export const config: AppConfig = loadConfig();
export default config;
