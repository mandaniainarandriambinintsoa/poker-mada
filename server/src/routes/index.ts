import { Router } from 'express';
import authRoutes from './authRoutes';
import walletRoutes from './walletRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

// Routes d'authentification
router.use('/auth', authRoutes);

// Routes du portefeuille
router.use('/wallet', walletRoutes);

// Routes admin
router.use('/admin', adminRoutes);

// Santé de l'API
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
