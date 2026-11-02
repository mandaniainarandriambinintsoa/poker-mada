import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

// All wallet writers acquire this lock first. balance includes reserved funds;
// available = balance - frozenBalance. No network side effects inside a transaction.
export async function lockWallet(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Portefeuille introuvable', 404, 'WALLET_NOT_FOUND');
  return wallet;
}

export function money(amount: number, minimum = 0) {
  if (!Number.isSafeInteger(amount) || amount < minimum || amount > 100_000_000) {
    throw new AppError('Montant invalide', 400, 'INVALID_AMOUNT');
  }
  return new Prisma.Decimal(amount);
}

export function ledgerTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(work, { maxWait: 5000, timeout: 10000 });
}
