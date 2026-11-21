import app from './app';
import { config } from './config/env';
import { prisma } from './config/db';
import { redisConnection } from './config/queue';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CloudVault API Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`📦 Storage Provider: ${config.storage.provider.toUpperCase()}`);
  console.log(`🗄️  Bucket: ${config.storage.bucket}`);
  console.log(`=======================================================`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Initiating graceful shutdown...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redisConnection.quit();
      console.log('✅ Connections closed. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
