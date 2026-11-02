import { PaymentProvider, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { ledgerTransaction, lockWallet, money } from './walletLedger';

export class WalletService {
  async getBalance(userId: string) {
    const [wallet, pending] = await prisma.$transaction(
      [
        prisma.wallet.findUnique({ where: { userId } }),
        prisma.transaction.aggregate({
          where: { userId, type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } },
          _sum: { amount: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (!wallet) throw new AppError('Portefeuille introuvable', 404, 'WALLET_NOT_FOUND');
    const withdrawalReserved = Number(pending._sum.amount ?? 0);
    return {
      balance: Number(wallet.balance),
      frozenBalance: Number(wallet.frozenBalance),
      availableBalance: Number(wallet.balance.minus(wallet.frozenBalance)),
      withdrawalReserved,
      tableReserved: Math.max(0, Number(wallet.frozenBalance) - withdrawalReserved),
    };
  }

  async getTransactions(
    userId: string,
    options: { page?: number; limit?: number; type?: TransactionType; status?: TransactionStatus },
  ) {
    const { page = 1, limit = 20, type, status } = options;
    const where: Prisma.TransactionWhereInput = { userId, type, status };
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          paymentProvider: true,
          description: true,
          createdAt: true,
          completedAt: true,
          balanceBefore: true,
          balanceAfter: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);
    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async initiatePayment(
    userId: string,
    amount: number,
    provider: PaymentProvider,
    phone: string,
    type: 'DEPOSIT' | 'WITHDRAWAL',
    requestId?: string,
  ) {
    const value = money(amount, type === 'DEPOSIT' ? 1000 : 5000);
    return ledgerTransaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      const requestKey = requestId ? `${userId}:${requestId}` : undefined;
      if (requestKey) {
        const existing = await tx.transaction.findUnique({ where: { requestKey } });
        if (existing) {
          if (
            existing.type !== type ||
            !existing.amount.equals(value) ||
            existing.paymentProvider !== provider ||
            existing.phoneNumber !== phone
          ) {
            throw new AppError(
              'Cette demande correspond à une autre opération',
              409,
              'IDEMPOTENCY_CONFLICT',
            );
          }
          return existing;
        }
      }
      if (type === 'WITHDRAWAL') {
        if (wallet.balance.minus(wallet.frozenBalance).lessThan(value))
          throw new AppError('Solde disponible insuffisant', 400, 'INSUFFICIENT_BALANCE');
        await tx.wallet.update({
          where: { userId },
          data: { frozenBalance: { increment: value } },
        });
      }
      return tx.transaction.create({
        data: {
          userId,
          type,
          amount: value,
          status: 'PENDING',
          requestKey,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          paymentProvider: provider,
          phoneNumber: phone,
          description: type === 'DEPOSIT' ? 'Demande de dépôt' : 'Demande de retrait',
        },
      });
    });
  }

  async initiateDeposit(
    userId: string,
    amount: number,
    provider: PaymentProvider,
    phone: string,
    requestId?: string,
  ) {
    const transaction = await this.initiatePayment(
      userId,
      amount,
      provider,
      phone,
      'DEPOSIT',
      requestId,
    );
    return {
      transactionId: transaction.id,
      amount,
      provider,
      status: transaction.status,
      instructions: {
        type: 'manual',
        reference: transaction.id,
        code: '',
        steps: [
          'Votre demande est enregistrée. Aucun paiement n’a encore été effectué.',
          'Contactez l’équipe pour obtenir les coordonnées de paiement vérifiées.',
          'Le solde sera crédité après vérification du paiement par un administrateur.',
        ],
      },
    };
  }

  async initiateWithdrawal(
    userId: string,
    amount: number,
    provider: PaymentProvider,
    phone: string,
    requestId?: string,
  ) {
    const transaction = await this.initiatePayment(
      userId,
      amount,
      provider,
      phone,
      'WITHDRAWAL',
      requestId,
    );
    return { transactionId: transaction.id, amount, provider, phone, status: transaction.status };
  }

  async settlePayment(
    transactionId: string,
    adminId: string,
    outcome: 'COMPLETED' | 'FAILED',
    externalRef?: string,
    reason?: string,
  ) {
    return ledgerTransaction(async (tx) => {
      const initial = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!initial || !['DEPOSIT', 'WITHDRAWAL'].includes(initial.type))
        throw new AppError('Opération de paiement introuvable', 404, 'PAYMENT_NOT_FOUND');
      const wallet = await lockWallet(tx, initial.userId);
      const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
      if (transaction.status === outcome)
        return { success: true, alreadyProcessed: true, newBalance: Number(wallet.balance) };
      if (!['PENDING', 'PROCESSING'].includes(transaction.status))
        throw new AppError('Opération déjà traitée', 409, 'ALREADY_PROCESSED');
      const reference = externalRef?.trim();
      if (outcome === 'COMPLETED' && !reference)
        throw new AppError(
          'La référence du paiement vérifié est requise',
          400,
          'PAYMENT_REFERENCE_REQUIRED',
        );
      if (outcome === 'FAILED' && !reason?.trim())
        throw new AppError('Indiquez le motif du refus', 400, 'REASON_REQUIRED');
      if (
        reference &&
        (await tx.transaction.findFirst({
          where: {
            paymentProvider: transaction.paymentProvider,
            externalRef: reference,
            id: { not: transactionId },
          },
          select: { id: true },
        }))
      ) {
        throw new AppError(
          'Cette référence de paiement est déjà utilisée',
          409,
          'DUPLICATE_REFERENCE',
        );
      }
      const withdrawal = transaction.type === 'WITHDRAWAL';
      if (withdrawal && wallet.frozenBalance.lessThan(transaction.amount))
        throw new AppError(
          'Réserve incohérente : vérification nécessaire',
          409,
          'RESERVATION_MISMATCH',
        );
      const balance =
        outcome === 'COMPLETED'
          ? withdrawal
            ? wallet.balance.minus(transaction.amount)
            : wallet.balance.plus(transaction.amount)
          : wallet.balance;
      const frozenBalance = withdrawal
        ? wallet.frozenBalance.minus(transaction.amount)
        : wallet.frozenBalance;
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: { balance, frozenBalance },
      });
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: outcome,
          externalRef: outcome === 'COMPLETED' ? reference : undefined,
          balanceBefore: wallet.balance,
          balanceAfter: balance,
          completedAt: new Date(),
          description: outcome === 'FAILED' ? `Refus : ${reason}` : transaction.description,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: outcome === 'COMPLETED' ? 'COMPLETE_TRANSACTION' : 'FAIL_TRANSACTION',
          targetType: 'TRANSACTION',
          targetId: transactionId,
          details: {
            amount: Number(transaction.amount),
            type: transaction.type,
            reason: reason ?? null,
          },
        },
      });
      return { success: true, alreadyProcessed: false, newBalance: Number(balance) };
    });
  }

  async reserveTable(userId: string, tableId: string, amount: number) {
    const value = money(amount, 1);
    return ledgerTransaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      if (
        await tx.transaction.findFirst({
          where: { userId, type: 'TABLE_BUY_IN', status: 'PROCESSING' },
          select: { id: true },
        })
      )
        throw new AppError('Une entrée en table est déjà réservée', 409, 'ALREADY_AT_TABLE');
      if (wallet.balance.minus(wallet.frozenBalance).lessThan(value))
        throw new AppError('Solde disponible insuffisant', 400, 'INSUFFICIENT_BALANCE');
      await tx.wallet.update({ where: { userId }, data: { frozenBalance: { increment: value } } });
      return tx.transaction.create({
        data: {
          userId,
          type: 'TABLE_BUY_IN',
          status: 'PROCESSING',
          amount: value,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          metadata: { tableId },
          description: 'Jetons réservés pour une table',
        },
      });
    });
  }

  async settleTable(userId: string, tableId: string, reservationId: string, chipStack: number) {
    const chips = money(chipStack);
    return ledgerTransaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      const reservation = await tx.transaction.findFirst({
        where: {
          id: reservationId,
          userId,
          type: 'TABLE_BUY_IN',
          metadata: { path: ['tableId'], equals: tableId },
        },
      });
      if (!reservation) throw new AppError('Réservation introuvable', 409, 'RESERVATION_MISSING');
      if (reservation.status === 'COMPLETED') return;
      if (reservation.status !== 'PROCESSING' || wallet.frozenBalance.lessThan(reservation.amount))
        throw new AppError('Réservation incohérente', 409, 'RESERVATION_MISMATCH');
      const balance = wallet.balance.minus(reservation.amount).plus(chips);
      await tx.wallet.update({
        where: { userId },
        data: { balance, frozenBalance: { decrement: reservation.amount } },
      });
      await tx.transaction.update({
        where: { id: reservation.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'TABLE_CASH_OUT',
          status: 'COMPLETED',
          amount: chips,
          balanceBefore: wallet.balance,
          balanceAfter: balance,
          metadata: { tableId, reservationId },
          description: 'Retour de table',
          completedAt: new Date(),
        },
      });
    });
  }

  async adjustBalance(adminId: string, userId: string, amount: number, reason: string) {
    money(Math.abs(amount), 1);
    return ledgerTransaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      const balance = wallet.balance.plus(amount);
      if (balance.lessThan(wallet.frozenBalance))
        throw new AppError(
          'Les fonds réservés ne peuvent pas être retirés',
          400,
          'INSUFFICIENT_BALANCE',
        );
      await tx.wallet.update({ where: { userId }, data: { balance } });
      await tx.transaction.create({
        data: {
          userId,
          type: amount > 0 ? 'BONUS' : 'REFUND',
          amount: Math.abs(amount),
          status: 'COMPLETED',
          balanceBefore: wallet.balance,
          balanceAfter: balance,
          description: reason,
          completedAt: new Date(),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: 'ADJUST_BALANCE',
          targetType: 'WALLET',
          targetId: wallet.id,
          details: { amount, reason },
        },
      });
      return { success: true, newBalance: Number(balance) };
    });
  }
}

export const walletService = new WalletService();
