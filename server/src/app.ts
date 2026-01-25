import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
// Ces handlers empêchent le serveur de crasher sur des erreurs imprévues

process.on('uncaughtException', (error: Error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  // Ne pas faire process.exit() - laisser le serveur continuer
  // Mais logger l'erreur pour investigation
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  // Ne pas faire process.exit() - laisser le serveur continuer
});

// Créer l'application Express
const app = express();
const httpServer = createServer(app);

// Configurer Socket.io avec options optimisées pour la charge
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Optimisations pour haute charge
  pingTimeout: 60000,        // 60s avant de considérer déconnecté
  pingInterval: 25000,       // Ping toutes les 25s
  upgradeTimeout: 30000,     // 30s pour upgrade de connexion
  maxHttpBufferSize: 1e6,    // 1MB max par message
  transports: ['websocket', 'polling'], // Préférer WebSocket
  allowUpgrades: true,
  perMessageDeflate: {       // Compression des messages
    threshold: 1024,         // Compresser si > 1KB
  },
});

// Middleware de sécurité
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
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

// Parser JSON
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

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

app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    connections: {
      sockets: io.sockets.sockets.size,
    },
  };

  try {
    // Vérifier la connexion DB (avec timeout)
    const dbCheck = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 5000)
      ),
    ]);

    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      ...healthCheck,
      status: 'degraded',
      error: 'Database connection issue',
    });
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
  Max connections: Unlimited (PM2 recommended)
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// ============================================
// ARRÊT GRACIEUX
// ============================================
// Fermer proprement les connexions avant de quitter

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Empêcher de nouvelles connexions
  httpServer.close(() => {
    console.log('HTTP server closed');
  });

  // Fermer toutes les connexions Socket.io
  io.close(() => {
    console.log('Socket.io connections closed');
  });

  // Déconnecter la base de données
  try {
    await disconnectDatabase();
    console.log('Database disconnected');
  } catch (error) {
    console.error('Error disconnecting database:', error);
  }

  // Attendre un peu que les connexions se ferment
  setTimeout(() => {
    console.log('Shutdown complete');
    process.exit(0);
  }, 2000);
};

// Écouter les signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
