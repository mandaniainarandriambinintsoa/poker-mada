import { Router } from 'express';
import authRoutes from './authRoutes';
import walletRoutes from './walletRoutes';

const router = Router();

// Routes d'authentification
router.use('/auth', authRoutes);

// Routes du portefeuille
router.use('/wallet', walletRoutes);

// Santé de l'API
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
