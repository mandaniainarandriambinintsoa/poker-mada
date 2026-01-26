import { Router } from 'express';
import {
  authController,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  googleCallbackSchema,
} from '../controllers/authController';
import { validate } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// GET /api/auth/google - Obtenir l'URL d'auth Google
router.get('/google', authController.googleAuth.bind(authController));

// POST /api/auth/google/callback - Callback Google OAuth
router.post('/google/callback', validate(googleCallbackSchema), authController.googleCallback.bind(authController));

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

// PUT /api/auth/update-profile - Mettre à jour le profil (protégé)
router.put('/update-profile', authMiddleware, authController.updateProfile.bind(authController));

// PUT /api/auth/update-password - Mettre à jour le mot de passe (protégé)
router.put('/update-password', authMiddleware, authController.updatePassword.bind(authController));

export default router;
