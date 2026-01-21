import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentProvider, TransactionType, TransactionStatus } from '@prisma/client';
import { walletService } from '../services/walletService';
import { AuthRequest } from '../middleware/authMiddleware';

// Schémas de validation
export const depositSchema = z.object({
  amount: z.number().min(1000, 'Montant minimum: 1000 Ar'),
  provider: z.enum(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY']),
  phone: z.string().regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro invalide'),
});

export const withdrawSchema = z.object({
  amount: z.number().min(5000, 'Montant minimum: 5000 Ar'),
  provider: z.enum(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY']),
  phone: z.string().regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro invalide'),
});

export const confirmDepositSchema = z.object({
  transactionId: z.string().uuid(),
  externalRef: z.string().min(1),
});

export class WalletController {
  async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const balance = await walletService.getBalance(userId);
      res.json(balance);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { page, limit, type, status } = req.query;

      const result = await walletService.getTransactions(userId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        type: type as TransactionType | undefined,
        status: status as TransactionStatus | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async initiateDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { amount, provider, phone } = req.body;

      const result = await walletService.initiateDeposit(
        userId,
        amount,
        provider as PaymentProvider,
        phone
      );

      res.json({
        message: 'Dépôt initié',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, externalRef } = req.body;

      const result = await walletService.confirmDeposit(transactionId, externalRef);

      res.json({
        message: 'Dépôt confirmé',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async initiateWithdrawal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { amount, provider, phone } = req.body;

      const result = await walletService.initiateWithdrawal(
        userId,
        amount,
        provider as PaymentProvider,
        phone
      );

      res.json({
        message: 'Retrait initié',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const walletController = new WalletController();
