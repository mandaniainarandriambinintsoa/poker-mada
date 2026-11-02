import { CookieOptions, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { AuthRequest } from '../middleware/authMiddleware';
import { config } from '../config/env';

const REFRESH_COOKIE = 'poker_refresh';
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function refreshCookieOptions(): CookieOptions {
  const match = /^(\d+)d$/.exec(config.jwt.refreshExpiresIn);
  const days = match ? Number.parseInt(match[1], 10) : 7;
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.sessionCookie.sameSite,
    domain: config.sessionCookie.domain,
    path: '/api/auth',
    maxAge: days * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && REFRESH_TOKEN_PATTERN.test(value) ? value : undefined;
}

// Schémas de validation
export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, "Le nom d'utilisateur doit contenir au moins 2 caractères")
      .max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères"),
    email: z.string().trim().toLowerCase().email('Email invalide'),
    password: z
      .string()
      .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
      .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères')
      .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 72,
        'Le mot de passe dépasse 72 octets',
      ),
    phone: z
      .string()
      .trim()
      .regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro de téléphone malgache invalide (ex: 0341234567)'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Email invalide'),
    password: z.string().min(1, 'Mot de passe requis'),
  })
  .strict();

// Contrôleur
export const googleCallbackSchema = z
  .object({
    credential: z.string().min(100, 'Jeton Google requis').max(4096),
  })
  .strict();

export class AuthController {
  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential } = req.body;

      const { user, tokens } = await authService.loginWithGoogle(credential);
      setRefreshCookie(res, tokens.refreshToken);

      res.json({
        message: 'Connexion Google réussie',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
        },
        token: tokens.token,
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!config.allowLocalRegistration) {
        res.status(403).json({
          error: 'Les nouvelles inscriptions utilisent Google.',
          code: 'LOCAL_REGISTRATION_DISABLED',
        });
        return;
      }
      const { username, email, password, phone } = req.body;

      const { user, tokens } = await authService.register(username, email, password, phone);
      setRefreshCookie(res, tokens.refreshToken);

      res.status(201).json({
        message: 'Inscription réussie',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
        },
        token: tokens.token,
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const { user, tokens } = await authService.login(email, password);
      setRefreshCookie(res, tokens.refreshToken);

      res.json({
        message: 'Connexion réussie',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
        },
        token: tokens.token,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = readRefreshCookie(req);
      if (!refreshToken) {
        clearRefreshCookie(res);
        res.status(401).json({ error: 'Session absente', code: 'INVALID_REFRESH_TOKEN' });
        return;
      }

      const tokens = await authService.refreshTokens(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);

      res.json({
        message: 'Tokens renouvelés',
        token: tokens.token,
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const refreshToken = readRefreshCookie(req);

      await authService.logout(userId, refreshToken);
      clearRefreshCookie(res);

      res.json({ message: 'Déconnexion réussie' });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { username, phone } = registerSchema
        .pick({ username: true, phone: true })
        .partial()
        .strict()
        .refine((data) => Object.keys(data).length > 0, 'Aucun champ fourni')
        .parse(req.body);

      // Validation basique
      if (username && (username.length < 2 || username.length > 30)) {
        res
          .status(400)
          .json({ message: "Le nom d'utilisateur doit contenir entre 2 et 30 caractères" });
        return;
      }

      if (phone && !/^(032|033|034|037|038)\d{7}$/.test(phone)) {
        res.status(400).json({ message: 'Numéro de téléphone malgache invalide' });
        return;
      }

      const user = await authService.updateProfile(userId, { username, phone });

      res.json({
        message: 'Profil mis à jour',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = z
        .object({
          currentPassword: z.string().min(1).max(72),
          newPassword: registerSchema.shape.password,
        })
        .strict()
        .parse(req.body);

      if (!currentPassword || !newPassword) {
        res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
        return;
      }

      if (newPassword.length < 12) {
        res
          .status(400)
          .json({ message: 'Le nouveau mot de passe doit contenir au moins 12 caractères' });
        return;
      }

      await authService.updatePassword(userId, currentPassword, newPassword);

      res.json({
        message: 'Mot de passe mis à jour',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
