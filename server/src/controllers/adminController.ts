import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminService } from '../services/adminService';
import { AdminRequest } from '../middleware/adminMiddleware';

// Schémas de validation
export const adjustBalanceSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  amount: z.number().refine((val) => val !== 0, 'Le montant ne peut pas être 0'),
  reason: z.string().min(3, 'Raison requise (min 3 caractères)'),
});

export const banUserSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  reason: z.string().optional(),
});

export const completeTransactionSchema = z.object({
  transactionId: z.string().uuid('ID transaction invalide'),
  externalRef: z.string().optional(),
});

export const failTransactionSchema = z.object({
  transactionId: z.string().uuid('ID transaction invalide'),
  reason: z.string().min(3, 'Raison requise (min 3 caractères)'),
});

// Contrôleur
export class AdminController {
  // ============================================
  // DASHBOARD
  // ============================================

  async getDashboard(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // USERS
  // ============================================

  async getUsers(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const filter = req.query.filter as 'all' | 'active' | 'banned';

      const result = await adminService.getUsers({ page, limit, search, filter });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getUserDetails(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await adminService.getUserDetails(userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  async banUser(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, reason } = req.body;
      const result = await adminService.banUser(req.userId!, userId, reason);
      res.json({ message: 'Utilisateur banni', ...result });
    } catch (error) {
      next(error);
    }
  }

  async unbanUser(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const result = await adminService.unbanUser(req.userId!, userId);
      res.json({ message: 'Utilisateur débanni', ...result });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // BALANCE
  // ============================================

  async adjustBalance(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, amount, reason } = req.body;
      const result = await adminService.adjustBalance(req.userId!, userId, amount, reason);
      res.json({ message: 'Solde ajusté', ...result });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async getTransactions(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;
      const userId = req.query.userId as string;

      const result = await adminService.getTransactions({ page, limit, type, status, userId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPendingTransactions(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getPendingTransactions();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async completeTransaction(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, externalRef } = req.body;
      const result = await adminService.completeTransaction(req.userId!, transactionId, externalRef);
      res.json({ message: 'Transaction confirmée', ...result });
    } catch (error) {
      next(error);
    }
  }

  async failTransaction(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, reason } = req.body;
      const result = await adminService.failTransaction(req.userId!, transactionId, reason);
      res.json({ message: 'Transaction marquée comme échouée', ...result });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  async getAuditLogs(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const adminId = req.query.adminId as string;

      const result = await adminService.getAuditLogs({ page, limit, adminId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
