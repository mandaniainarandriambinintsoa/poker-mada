import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from './authMiddleware';

export interface AdminRequest extends AuthRequest {
  adminRole?: 'ADMIN' | 'SUPER_ADMIN';
}

/**
 * Middleware pour vérifier que l'utilisateur est admin ou super_admin
 */
export const requireAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, isActive: true, isBanned: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    if (!user.isActive || user.isBanned) {
      res.status(403).json({ error: 'Compte désactivé ou banni' });
      return;
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Accès réservé aux administrateurs' });
      return;
    }

    req.adminRole = user.role as 'ADMIN' | 'SUPER_ADMIN';
    next();
  } catch {
    console.error(JSON.stringify({ event: 'admin.authorization_failed' }));
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur est super_admin
 */
export const requireSuperAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, isActive: true, isBanned: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    if (!user.isActive || user.isBanned) {
      res.status(403).json({ error: 'Compte désactivé ou banni' });
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Accès réservé au super administrateur' });
      return;
    }

    req.adminRole = 'SUPER_ADMIN';
    next();
  } catch {
    console.error(JSON.stringify({ event: 'super_admin.authorization_failed' }));
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
