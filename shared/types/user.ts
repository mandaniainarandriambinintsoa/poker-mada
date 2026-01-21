export interface UserDTO {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatar?: string;
  createdAt: string;
  isActive: boolean;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalWinnings: number;
  totalLosses: number;
  biggestWin: number;
  winRate: number;
}

export interface WalletDTO {
  balance: number;
  frozenBalance: number;
  availableBalance: number;
}

export interface TransactionDTO {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TABLE_BUY_IN' | 'TABLE_CASH_OUT' | 'WIN' | 'LOSS' | 'BONUS' | 'REFUND';
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  paymentProvider?: 'ORANGE_MONEY' | 'MVOLA' | 'AIRTEL_MONEY';
  description?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AuthResponse {
  user: UserDTO;
  token: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone: string;
}
