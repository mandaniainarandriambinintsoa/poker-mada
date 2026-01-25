import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { AuthRequest } from '../middleware/authMiddleware';

// Schémas de validation
export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Le nom d'utilisateur doit contenir au moins 2 caractères")
    .max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères"),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  phone: z
    .string()
    .regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro de téléphone malgache invalide (ex: 0341234567)'),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().uuid('Refresh token invalide'),
});

// Contrôleur
export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, phone } = req.body;

      const { user, tokens } = await authService.register(username, email, password, phone);

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
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const { user, tokens } = await authService.login(email, password);

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
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const tokens = await authService.refreshTokens(refreshToken);

      res.json({
        message: 'Tokens renouvelés',
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { refreshToken } = req.body;

      await authService.logout(userId, refreshToken);

      res.json({ message: 'Déconnexion réussie' });
    } catch (error) {
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
      const { username, email, phone } = req.body;

      // Validation basique
      if (username && (username.length < 2 || username.length > 30)) {
        res.status(400).json({ message: "Le nom d'utilisateur doit contenir entre 2 et 30 caractères" });
        return;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ message: 'Email invalide' });
        return;
      }

      if (phone && !/^(032|033|034|037|038)\d{7}$/.test(phone)) {
        res.status(400).json({ message: 'Numéro de téléphone malgache invalide' });
        return;
      }

      const user = await authService.updateProfile(userId, { username, email, phone });

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
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
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
