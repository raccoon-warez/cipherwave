import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pino from 'pino';
import { SignalingServer } from './signaling';
import { config } from './config';
import { getRedisClient, closeRedisClient } from '../core/redis/client';
import { registerAPIRoutes } from './api';

const logger = pino({
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

let signalingServer: SignalingServer | null = null;

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:17612',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    nodeId: config.nodeId,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

registerAPIRoutes(app);

const httpServer = http.createServer(app);

export async function start(): Promise<void> {
  try {
    logger.info({ nodeId: config.nodeId }, 'CipherWave starting...');

    await getRedisClient();

    signalingServer = new SignalingServer(config);
    await signalingServer.initialize(httpServer);

    httpServer.listen(config.port, config.host, () => {
      logger.info({ port: config.port, host: config.host, nodeId: config.nodeId }, 'CipherWave server running');
    });

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      logger.error({ err }, 'Uncaught exception');
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled rejection');
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  if (signalingServer) {
    await signalingServer.shutdown();
  }

  await closeRedisClient();

  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Force shutdown');
    process.exit(1);
  }, 10000).unref();
}

// Only auto-start when this module is the process entry point. When imported
// (e.g. by node-host.ts) the importer is responsible for calling start().
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  start();
}
