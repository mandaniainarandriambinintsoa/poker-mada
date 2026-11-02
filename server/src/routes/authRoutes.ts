import { Router } from 'express';
import {
  authController,
  registerSchema,
  loginSchema,
  googleCallbackSchema,
} from '../controllers/authController';
import { validate } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireTrustedWebOrigin } from '../middleware/trustedWebOrigin';

const router = Router();

// POST /api/auth/google/callback - Verify a Google Identity Services ID token.
router.post(
  '/google/callback',
  requireTrustedWebOrigin,
  validate(googleCallbackSchema),
  authController.googleCallback.bind(authController),
);

// POST /api/auth/register - Inscription
router.post(
  '/register',
  requireTrustedWebOrigin,
  validate(registerSchema),
  authController.register.bind(authController),
);

// POST /api/auth/login - Connexion
router.post(
  '/login',
  requireTrustedWebOrigin,
  validate(loginSchema),
  authController.login.bind(authController),
);

// POST /api/auth/refresh - Renouveler les tokens
router.post('/refresh', requireTrustedWebOrigin, authController.refresh.bind(authController));

// POST /api/auth/logout - Déconnexion (protégé)
router.post(
  '/logout',
  requireTrustedWebOrigin,
  authMiddleware,
  authController.logout.bind(authController),
);

// GET /api/auth/me - Informations utilisateur courant (protégé)
router.get('/me', authMiddleware, authController.me.bind(authController));

// PUT /api/auth/update-profile - Mettre à jour le profil (protégé)
router.put('/update-profile', authMiddleware, authController.updateProfile.bind(authController));

// PUT /api/auth/update-password - Mettre à jour le mot de passe (protégé)
router.put('/update-password', authMiddleware, authController.updatePassword.bind(authController));

export default router;
