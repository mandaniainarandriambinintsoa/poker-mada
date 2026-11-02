import { walletService } from './walletService';
import { Prisma, TransactionType, TransactionStatus } from '@prisma/client';
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
        where: { type: 'DEPOSIT', status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      // Pending withdrawals
      prisma.transaction.count({
        where: { type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } },
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
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
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

  async adjustBalance(adminId: string, userId: string, amount: number, reason: string) {
    return walletService.adjustBalance(adminId, userId, amount, reason);
  }

  // ============================================
  // TRANSACTION MANAGEMENT
  // ============================================

  async getTransactions(params: {
    page?: number;
    limit?: number;
    type?: TransactionType;
    status?: TransactionStatus;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (params.type) {
      where.type = params.type;
    }

    if (params.status) {
      where.status = params.status;
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
        where: { type: 'DEPOSIT', status: { in: ['PENDING', 'PROCESSING'] } },
        take: 100,
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
        where: { type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } },
        take: 100,
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
    return walletService.settlePayment(transactionId, adminId, 'COMPLETED', externalRef);
  }

  async failTransaction(adminId: string, transactionId: string, reason: string) {
    return walletService.settlePayment(transactionId, adminId, 'FAILED', undefined, reason);
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
