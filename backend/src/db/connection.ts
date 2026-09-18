import mongoose from 'mongoose';
import config from '../config';

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    const dbName = conn.connection.name || 'default';
    console.log(`[MongoDB] Successfully connected to database: ${dbName}`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Runtime error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from database');
      isConnected = false;
    });

    return conn;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MongoDB Connection Error] Failed to connect to ${config.mongodbUri}: ${errMessage}`);
    throw new Error(`[MongoDB Connection Error] ${errMessage}`);
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Connection closed successfully');
  } catch (error) {
    console.error('[MongoDB] Error while disconnecting:', error);
  }
}

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n[Process] Received ${signal}. Closing MongoDB connection...`);
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
