import mongoose from 'mongoose';
import dns from 'dns';
import config from '../config';

// Fallback to reliable public DNS resolvers if local system DNS blocks SRV lookups (common on Windows)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if permissions or environment restrict setting DNS servers
}

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      dbName: 'ecointel',
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
