import { Prisma, TransactionType, TransactionStatus, PaymentProvider } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class WalletService {
  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    const balance = Number(wallet.balance);
    const frozenBalance = Number(wallet.frozenBalance);

    return {
      balance,
      frozenBalance,
      availableBalance: balance - frozenBalance,
    };
  }

  async getTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: TransactionStatus;
    }
  ) {
    const { page = 1, limit = 20, type, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
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
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async initiateDeposit(
    userId: string,
    amount: number,
    provider: PaymentProvider,
    phone: string
  ) {
    // Vérifier le montant minimum
    if (amount < 1000) {
      throw new AppError('Le montant minimum est de 1000 Ar', 400, 'MIN_AMOUNT');
    }

    // Récupérer le solde actuel
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // Créer la transaction en attente
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.DEPOSIT,
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Sera mis à jour après confirmation
        status: TransactionStatus.PENDING,
        paymentProvider: provider,
        phoneNumber: phone,
        description: `Dépôt via ${provider}`,
      },
    });

    // Ici on intégrerait l'API Mobile Money
    // Pour l'instant, on retourne les informations pour le paiement manuel
    return {
      transactionId: transaction.id,
      amount,
      provider,
      status: 'PENDING',
      instructions: this.getPaymentInstructions(provider, amount, transaction.id),
    };
  }

  async confirmDeposit(transactionId: string, externalRef: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: { include: { wallet: true } } },
    });

    if (!transaction) {
      throw new AppError('Transaction non trouvée', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new AppError('Transaction déjà traitée', 400, 'TRANSACTION_ALREADY_PROCESSED');
    }

    const wallet = transaction.user.wallet;
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // Mettre à jour le portefeuille et la transaction atomiquement
    const [updatedWallet, updatedTransaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: transaction.amount },
        },
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          externalRef,
          balanceAfter: Prisma.Decimal.add(wallet.balance, transaction.amount),
          completedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      newBalance: Number(updatedWallet.balance),
      transaction: updatedTransaction,
    };
  }

  async initiateWithdrawal(
    userId: string,
    amount: number,
    provider: PaymentProvider,
    phone: string
  ) {
    // Vérifier le montant minimum
    if (amount < 5000) {
      throw new AppError('Le montant minimum de retrait est de 5000 Ar', 400, 'MIN_WITHDRAWAL');
    }

    // Vérifier le solde disponible
    const balance = await this.getBalance(userId);
    if (balance.availableBalance < amount) {
      throw new AppError('Solde insuffisant', 400, 'INSUFFICIENT_BALANCE');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // Créer la transaction et geler le montant
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: Prisma.Decimal.sub(wallet.balance, new Prisma.Decimal(amount)),
          status: TransactionStatus.PROCESSING,
          paymentProvider: provider,
          phoneNumber: phone,
          description: `Retrait vers ${provider} - ${phone}`,
        },
      }),
      prisma.wallet.update({
        where: { userId },
        data: {
          frozenBalance: { increment: amount },
        },
      }),
    ]);

    return {
      transactionId: transaction.id,
      amount,
      provider,
      phone,
      status: 'PROCESSING',
      estimatedTime: '24-48 heures',
    };
  }

  async deductForTableBuyIn(userId: string, amount: number, gameSessionId: string) {
    const balance = await this.getBalance(userId);

    if (balance.availableBalance < amount) {
      throw new AppError('Solde insuffisant pour rejoindre la table', 400, 'INSUFFICIENT_BALANCE');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // Déduire et geler le montant
    const [updatedWallet, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          frozenBalance: { increment: amount },
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.TABLE_BUY_IN,
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: Prisma.Decimal.sub(wallet.balance, new Prisma.Decimal(amount)),
          status: TransactionStatus.COMPLETED,
          gameSessionId,
          description: 'Entrée en table',
          completedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      newBalance: Number(updatedWallet.balance),
      frozenBalance: Number(updatedWallet.frozenBalance),
      transactionId: transaction.id,
    };
  }

  async cashOutFromTable(userId: string, chipStack: number, gameSessionId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // Retourner les jetons au portefeuille
    const [updatedWallet, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: {
          balance: { increment: chipStack },
          frozenBalance: { decrement: chipStack },
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.TABLE_CASH_OUT,
          amount: chipStack,
          balanceBefore: wallet.balance,
          balanceAfter: Prisma.Decimal.add(wallet.balance, new Prisma.Decimal(chipStack)),
          status: TransactionStatus.COMPLETED,
          gameSessionId,
          description: 'Sortie de table',
          completedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      newBalance: Number(updatedWallet.balance),
      transactionId: transaction.id,
    };
  }

  private getPaymentInstructions(provider: PaymentProvider, amount: number, reference: string) {
    switch (provider) {
      case PaymentProvider.ORANGE_MONEY:
        return {
          type: 'ussd',
          code: `*144*1*1*POKERMADA*${amount}#`,
          reference,
          steps: [
            'Composez le code USSD ci-dessus',
            'Entrez votre code PIN Orange Money',
            'Confirmez le paiement',
          ],
        };
      case PaymentProvider.MVOLA:
        return {
          type: 'ussd',
          code: `*111*1*2*POKERMADA*${amount}#`,
          reference,
          steps: [
            'Composez le code USSD ci-dessus',
            'Entrez votre code PIN MVola',
            'Confirmez le paiement',
          ],
        };
      case PaymentProvider.AIRTEL_MONEY:
        return {
          type: 'ussd',
          code: `*444*1*1*POKERMADA*${amount}#`,
          reference,
          steps: [
            'Composez le code USSD ci-dessus',
            'Entrez votre code PIN Airtel Money',
            'Confirmez le paiement',
          ],
        };
      default:
        return null;
    }
  }
}

export const walletService = new WalletService();
