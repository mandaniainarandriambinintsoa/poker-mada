import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { reconcileFrozenBalances } from './reconciliationService';

export class AdminService {
  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalBalance,
      pendingDeposits,
      pendingWithdrawals,
      todayTransactions,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      // Active users
      prisma.user.count({ where: { isActive: true, isBanned: false } }),
      // Banned users
      prisma.user.count({ where: { isBanned: true } }),
      // Total balance in circulation
      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
      // Pending deposits
      prisma.transaction.count({
        where: { type: 'DEPOSIT', status: 'PENDING' },
      }),
      // Pending withdrawals
      prisma.transaction.count({
        where: { type: 'WITHDRAWAL', status: 'PENDING' },
      }),
      // Today's transactions
      prisma.transaction.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
      },
      finance: {
        totalBalance: totalBalance._sum.balance?.toNumber() || 0,
        pendingDeposits,
        pendingWithdrawals,
      },
      activity: {
        todayTransactions,
      },
    };
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    filter?: 'all' | 'active' | 'banned';
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
      ];
    }

    // Status filter
    if (params.filter === 'active') {
      where.isActive = true;
      where.isBanned = false;
    } else if (params.filter === 'banned') {
      where.isBanned = true;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isBanned: true,
          createdAt: true,
          lastLoginAt: true,
          wallet: {
            select: {
              balance: true,
              frozenBalance: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        balance: u.wallet?.balance?.toNumber() || 0,
        frozenBalance: u.wallet?.frozenBalance?.toNumber() || 0,
        wallet: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isBanned: true,
        createdAt: true,
        lastLoginAt: true,
        wallet: {
          select: {
            balance: true,
            frozenBalance: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            amount: true,
            status: true,
            createdAt: true,
            description: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
    }

    return {
      ...user,
      balance: user.wallet?.balance?.toNumber() || 0,
      frozenBalance: user.wallet?.frozenBalance?.toNumber() || 0,
      transactions: user.transactions.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
      })),
      wallet: undefined,
    };
  }

  async banUser(adminId: string, userId: string, reason?: string) {
    // Check user exists and is not an admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isBanned: true },
    });

    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      throw new AppError('Impossible de bannir un administrateur', 400, 'CANNOT_BAN_ADMIN');
    }

    if (user.isBanned) {
      throw new AppError('Utilisateur déjà banni', 400, 'ALREADY_BANNED');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned: true },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'BAN_USER',
          targetType: 'USER',
          targetId: userId,
          details: { reason },
        },
      }),
    ]);

    return { success: true };
  }

  async unbanUser(adminId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });

    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
    }

    if (!user.isBanned) {
      throw new AppError("Utilisateur n'est pas banni", 400, 'NOT_BANNED');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned: false },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'UNBAN_USER',
          targetType: 'USER',
          targetId: userId,
        },
      }),
    ]);

    return { success: true };
  }

  // ============================================
  // BALANCE MANAGEMENT
  // ============================================

  async adjustBalance(
    adminId: string,
    userId: string,
    amount: number,
    reason: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
    }

    if (!user.wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    const currentBalance = user.wallet.balance.toNumber();
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      throw new AppError('Le solde ne peut pas être négatif', 400, 'NEGATIVE_BALANCE');
    }

    const transactionType = amount > 0 ? 'BONUS' : 'REFUND';

    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: transactionType,
          amount: Math.abs(amount),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          status: 'COMPLETED',
          description: `[ADMIN] ${reason}`,
          completedAt: new Date(),
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'ADJUST_BALANCE',
          targetType: 'WALLET',
          targetId: user.wallet.id,
          details: {
            userId,
            amount,
            reason,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
          },
        },
      }),
    ]);

    return {
      success: true,
      newBalance,
    };
  }

  // ============================================
  // TRANSACTION MANAGEMENT
  // ============================================

  async getTransactions(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (params.type) {
      where.type = params.type as any;
    }

    if (params.status) {
      where.status = params.status as any;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
        balanceBefore: t.balanceBefore.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingTransactions() {
    const [deposits, withdrawals] = await Promise.all([
      prisma.transaction.findMany({
        where: { type: 'DEPOSIT', status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: { type: 'WITHDRAWAL', status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return {
      deposits: deposits.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
        balanceBefore: t.balanceBefore.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
      })),
      withdrawals: withdrawals.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
        balanceBefore: t.balanceBefore.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
      })),
    };
  }

  async completeTransaction(adminId: string, transactionId: string, externalRef?: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: { include: { wallet: true } } },
    });

    if (!transaction) {
      throw new AppError('Transaction non trouvée', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'PENDING') {
      throw new AppError('Transaction non en attente', 400, 'NOT_PENDING');
    }

    const wallet = transaction.user.wallet;
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    const currentBalance = wallet.balance.toNumber();
    let newBalance: number;

    if (transaction.type === 'DEPOSIT') {
      // Add funds to wallet
      newBalance = currentBalance + transaction.amount.toNumber();
    } else if (transaction.type === 'WITHDRAWAL') {
      // Withdrawal already reserved funds - just confirm
      newBalance = currentBalance;
    } else {
      throw new AppError('Type de transaction non supporté', 400, 'UNSUPPORTED_TYPE');
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          externalRef,
          balanceAfter: newBalance,
        },
      }),
      ...(transaction.type === 'DEPOSIT'
        ? [
            prisma.wallet.update({
              where: { userId: transaction.userId },
              data: { balance: newBalance },
            }),
          ]
        : []),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'COMPLETE_TRANSACTION',
          targetType: 'TRANSACTION',
          targetId: transactionId,
          details: {
            type: transaction.type,
            amount: transaction.amount.toNumber(),
            userId: transaction.userId,
            externalRef,
          },
        },
      }),
    ]);

    return { success: true, newBalance };
  }

  async failTransaction(adminId: string, transactionId: string, reason: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: { include: { wallet: true } } },
    });

    if (!transaction) {
      throw new AppError('Transaction non trouvée', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'PENDING') {
      throw new AppError('Transaction non en attente', 400, 'NOT_PENDING');
    }

    const wallet = transaction.user.wallet;
    if (!wallet) {
      throw new AppError('Portefeuille non trouvé', 404, 'WALLET_NOT_FOUND');
    }

    // For failed withdrawal, refund the frozen amount
    if (transaction.type === 'WITHDRAWAL') {
      const currentBalance = wallet.balance.toNumber();
      const frozenBalance = wallet.frozenBalance.toNumber();
      const amount = transaction.amount.toNumber();

      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'FAILED',
            description: `${transaction.description || ''} [ECHEC: ${reason}]`,
          },
        }),
        prisma.wallet.update({
          where: { userId: transaction.userId },
          data: {
            balance: currentBalance + amount,
            frozenBalance: Math.max(0, frozenBalance - amount),
          },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'FAIL_TRANSACTION',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            details: {
              type: transaction.type,
              amount: amount,
              userId: transaction.userId,
              reason,
              refunded: true,
            },
          },
        }),
      ]);
    } else {
      // For failed deposit, just mark as failed
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'FAILED',
            description: `${transaction.description || ''} [ECHEC: ${reason}]`,
          },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'FAIL_TRANSACTION',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            details: {
              type: transaction.type,
              amount: transaction.amount.toNumber(),
              userId: transaction.userId,
              reason,
            },
          },
        }),
      ]);
    }

    return { success: true };
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  async getAuditLogs(params: { page?: number; limit?: number; adminId?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AdminAuditLogWhereInput = {};

    if (params.adminId) {
      where.adminId = params.adminId;
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // RECONCILIATION
  // ============================================

  async runReconciliation() {
    const result = await reconcileFrozenBalances();
    return result;
  }
}

export const adminService = new AdminService();
