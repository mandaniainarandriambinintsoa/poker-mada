import { Router } from 'express';
import {
  authController,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../controllers/authController';
import { validate } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/register - Inscription
router.post('/register', validate(registerSchema), authController.register.bind(authController));

// POST /api/auth/login - Connexion
router.post('/login', validate(loginSchema), authController.login.bind(authController));

// POST /api/auth/refresh - Renouveler les tokens
router.post('/refresh', validate(refreshTokenSchema), authController.refresh.bind(authController));

// POST /api/auth/logout - Déconnexion (protégé)
router.post('/logout', authMiddleware, authController.logout.bind(authController));

// GET /api/auth/me - Informations utilisateur courant (protégé)
router.get('/me', authMiddleware, authController.me.bind(authController));

export default router;
