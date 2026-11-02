import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentProvider, TransactionType, TransactionStatus } from '@prisma/client';
import { walletService } from '../services/walletService';
import { AuthRequest } from '../middleware/authMiddleware';

export const requestKeySchema = z.string().uuid('Idempotency-Key requis');

// Schémas de validation
export const depositSchema = z
  .object({
    amount: z.number().int().max(100_000_000).min(1000, 'Montant minimum: 1000 Ar'),
    provider: z.enum(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY']),
    phone: z
      .string()
      .trim()
      .regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro invalide'),
  })
  .strict();

export const withdrawSchema = z
  .object({
    amount: z.number().int().max(100_000_000).min(5000, 'Montant minimum: 5000 Ar'),
    provider: z.enum(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY']),
    phone: z
      .string()
      .trim()
      .regex(/^0(32|33|34|37|38)\d{7}$/, 'Numéro invalide'),
  })
  .strict();

export const confirmDepositSchema = z
  .object({
    transactionId: z.string().uuid(),
    externalRef: z.string().trim().min(1).max(120),
  })
  .strict();

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
      const query = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          type: z.nativeEnum(TransactionType).optional(),
          status: z.nativeEnum(TransactionStatus).optional(),
        })
        .parse(req.query);
      res.json(await walletService.getTransactions(req.userId!, query));
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
        phone,
        requestKeySchema.parse(req.get('Idempotency-Key')),
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

      const result = await walletService.settlePayment(
        transactionId,
        req.userId!,
        'COMPLETED',
        externalRef,
      );

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
        phone,
        requestKeySchema.parse(req.get('Idempotency-Key')),
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
