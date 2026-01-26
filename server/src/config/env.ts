import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  orangeMoney: {
    apiUrl: process.env.ORANGE_MONEY_API_URL || '',
    merchantId: process.env.ORANGE_MONEY_MERCHANT_ID || '',
    apiKey: process.env.ORANGE_MONEY_API_KEY || '',
  },

  mvola: {
    apiUrl: process.env.MVOLA_API_URL || '',
    consumerKey: process.env.MVOLA_CONSUMER_KEY || '',
    consumerSecret: process.env.MVOLA_CONSUMER_SECRET || '',
    merchantNumber: process.env.MVOLA_MERCHANT_NUMBER || '',
  },

  airtelMoney: {
    apiUrl: process.env.AIRTEL_MONEY_API_URL || '',
    clientId: process.env.AIRTEL_MONEY_CLIENT_ID || '',
    clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
};
