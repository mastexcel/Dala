import { createServer } from 'node:http';
import { config } from './config';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { attachRealtime } from './services/notifications';
import { startJobs, stopJobs } from './jobs/queue';

const server = createServer(createApp());
attachRealtime(server);

server.listen(config.PORT, async () => {
  logger.info(`DALA API à l'écoute sur :${config.PORT}`);
  await startJobs();
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Arrêt en cours');
  server.close();
  await stopJobs();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
