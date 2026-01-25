import { api } from './api';

// Types
export interface DashboardStats {
  users: {
    total: number;
    active: number;
    banned: number;
  };
  finance: {
    totalBalance: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
  };
  activity: {
    todayTransactions: number;
  };
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  balance: number;
  frozenBalance: number;
}

export interface AdminTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  paymentProvider: string | null;
  externalRef: string | null;
  phoneNumber: string | null;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    phone: string;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API calls
export const adminApi = {
  // Dashboard
  getDashboard: async (): Promise<DashboardStats> => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },

  // Users
  getUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    filter?: 'all' | 'active' | 'banned';
  }): Promise<{ users: AdminUser[]; pagination: Pagination }> => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUserDetails: async (userId: string): Promise<AdminUser & { transactions: AdminTransaction[] }> => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  banUser: async (userId: string, reason?: string): Promise<{ success: boolean }> => {
    const response = await api.post('/admin/users/ban', { userId, reason });
    return response.data;
  },

  unbanUser: async (userId: string): Promise<{ success: boolean }> => {
    const response = await api.post(`/admin/users/${userId}/unban`);
    return response.data;
  },

  // Balance
  adjustBalance: async (
    userId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; newBalance: number }> => {
    const response = await api.post('/admin/balance/adjust', { userId, amount, reason });
    return response.data;
  },

  // Transactions
  getTransactions: async (params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    userId?: string;
  }): Promise<{ transactions: AdminTransaction[]; pagination: Pagination }> => {
    const response = await api.get('/admin/transactions', { params });
    return response.data;
  },

  getPendingTransactions: async (): Promise<{
    deposits: AdminTransaction[];
    withdrawals: AdminTransaction[];
  }> => {
    const response = await api.get('/admin/transactions/pending');
    return response.data;
  },

  completeTransaction: async (
    transactionId: string,
    externalRef?: string
  ): Promise<{ success: boolean; newBalance: number }> => {
    const response = await api.post('/admin/transactions/complete', { transactionId, externalRef });
    return response.data;
  },

  failTransaction: async (
    transactionId: string,
    reason: string
  ): Promise<{ success: boolean }> => {
    const response = await api.post('/admin/transactions/fail', { transactionId, reason });
    return response.data;
  },

  // Audit logs
  getAuditLogs: async (params: {
    page?: number;
    limit?: number;
    adminId?: string;
  }): Promise<{
    logs: Array<{
      id: string;
      adminId: string;
      action: string;
      targetType: string;
      targetId: string;
      details: Record<string, unknown> | null;
      createdAt: string;
      admin: { id: string; username: string; email: string };
    }>;
    pagination: Pagination;
  }> => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  },
};
