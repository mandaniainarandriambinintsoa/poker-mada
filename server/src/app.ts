import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './config/env';
import { connectDatabase } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeSocketManager } from './socket/socketManager';

// Créer l'application Express
const app = express();
const httpServer = createServer(app);

// Configurer Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
});
app.use('/api/', limiter);

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
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
