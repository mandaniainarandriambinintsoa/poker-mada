import { stopPeriodicReconciliation } from './services/reconciliationService';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './config/env';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeSocketManager } from './socket/socketManager';

// ============================================
// GESTIONNAIRES D'ERREURS NON CAPTURÉES
// ============================================
// Continuing after an uncaught failure could corrupt in-memory games.
process.on('uncaughtException', () => {
  console.error(JSON.stringify({ event: 'process.uncaught_exception' }));
  void gracefulShutdown('uncaughtException', 1);
});
process.on('unhandledRejection', () => {
  console.error(JSON.stringify({ event: 'process.unhandled_rejection' }));
  void gracefulShutdown('unhandledRejection', 1);
});

// Créer l'application Express
const app = express();
const httpServer = createServer(app);

if (config.trustProxyHops > 0) {
  app.set('trust proxy', config.trustProxyHops);
}

// Configurer Socket.io avec options optimisées pour la charge
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Optimisations pour haute charge
  pingTimeout: 60000, // 60s avant de considérer déconnecté
  pingInterval: 25000, // Ping toutes les 25s
  upgradeTimeout: 30000, // 30s pour upgrade de connexion
  maxHttpBufferSize: 16_384, // 1MB max par message
  transports: ['websocket', 'polling'], // Préférer WebSocket
  allowUpgrades: true,
  perMessageDeflate: {
    // Compression des messages
    threshold: 1024, // Compresser si > 1KB
  },
});

// Middleware de sécurité
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);

// Rate limiting - Configuration différenciée
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip failed requests (ne pas compter les erreurs)
  skipFailedRequests: false,
  // Skip successful requests (ne pas compter les succès - utile pour debug)
  skipSuccessfulRequests: false,
});

// Rate limiting strict pour l'authentification (contre brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par 15 minutes
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Appliquer les rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google/callback', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// Parser JSON
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 50 }));
app.use(cookieParser());

// Routes API
app.use('/api', routes);

// Route de base
app.get('/', (req, res) => {
  res.json({
    name: 'Poker Mada API',
    version: '1.0.0',
    status: 'running',
  });
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
// Utilisé par Render et autres plateformes pour vérifier la santé du serveur

app.get('/health', async (_req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  let timeout: NodeJS.Timeout | undefined;
  try {
    // Vérifier la connexion DB (avec timeout)
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('DB timeout')), 5000);
      }),
    ]);

    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      ...healthCheck,
      status: 'degraded',
      error: 'Database connection issue',
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
});

// Gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

// Exporter io pour l'utiliser dans les handlers Socket
export { io };

// Démarrer le serveur
const start = async () => {
  try {
    // Connecter la base de données
    await connectDatabase();

    // Initialiser Socket.io
    initializeSocketManager(io);

    // Démarrer le serveur HTTP
    httpServer.listen(config.port, () => {
      console.log(`
========================================
  Poker Mada Server
========================================
  Environment: ${config.nodeEnv}
  Port: ${config.port}
  API URL: http://localhost:${config.port}/api
  Client URL: ${config.clientUrl}
  Single game process — drain tables before restart
========================================
      `);
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'process.start_failed',
        type: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    process.exit(1);
  }
};

// ============================================
// ARRÊT GRACIEUX
// ============================================
// Fermer proprement les connexions avant de quitter

let shuttingDown = false;
const gracefulShutdown = async (signal: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: 'process.shutdown', signal }));
  stopPeriodicReconciliation();
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await disconnectDatabase();
    clearTimeout(deadline);
    process.exit(exitCode);
  } catch {
    process.exit(1);
  }
};

// Écouter les signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
