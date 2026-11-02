import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const environment = z
  .object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1).default('poker-mada-api'),
    JWT_AUDIENCE: z.string().min(1).default('poker-mada-web'),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
    SESSION_COOKIE_DOMAIN: z.string().min(1).optional(),
    ALLOW_LOCAL_REGISTRATION: z.enum(['true', 'false']).default('false'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    ENABLE_TEST_BOTS: z.enum(['true', 'false']).default('false'),
  })
  .safeParse(process.env);
if (!environment.success) {
  throw new Error(
    `Configuration invalide : ${environment.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}
if (environment.data.NODE_ENV === 'production' && !environment.data.GOOGLE_CLIENT_ID) {
  throw new Error('Configuration invalide : GOOGLE_CLIENT_ID');
}
if (environment.data.NODE_ENV === 'production' && environment.data.TRUST_PROXY_HOPS === 0) {
  throw new Error('Configuration invalide : TRUST_PROXY_HOPS');
}
if (environment.data.NODE_ENV === 'production' && !environment.data.SESSION_COOKIE_SAME_SITE) {
  throw new Error('Configuration invalide : SESSION_COOKIE_SAME_SITE');
}
if (new URL(environment.data.CLIENT_URL).origin !== environment.data.CLIENT_URL) {
  throw new Error('Configuration invalide : CLIENT_URL doit être une origine sans chemin');
}
if (environment.data.NODE_ENV === 'production') {
  const databaseUrl = new URL(environment.data.DATABASE_URL);
  const connectionLimit = Number.parseInt(
    databaseUrl.searchParams.get('connection_limit') || '',
    10,
  );
  const poolTimeout = Number.parseInt(databaseUrl.searchParams.get('pool_timeout') || '', 10);
  if (!Number.isInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 20) {
    throw new Error('Configuration invalide : DATABASE_URL connection_limit');
  }
  if (!Number.isInteger(poolTimeout) || poolTimeout < 1 || poolTimeout > 30) {
    throw new Error('Configuration invalide : DATABASE_URL pool_timeout');
  }
}
export const config = {
  port: environment.data.PORT,
  nodeEnv: environment.data.NODE_ENV,
  enableBots:
    environment.data.NODE_ENV !== 'production' && environment.data.ENABLE_TEST_BOTS === 'true',

  jwt: {
    secret: environment.data.JWT_SECRET,
    issuer: environment.data.JWT_ISSUER,
    audience: environment.data.JWT_AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  google: {
    clientId: environment.data.GOOGLE_CLIENT_ID || '',
  },

  trustProxyHops: environment.data.TRUST_PROXY_HOPS,

  sessionCookie: {
    sameSite: environment.data.SESSION_COOKIE_SAME_SITE || 'lax',
    domain: environment.data.SESSION_COOKIE_DOMAIN,
  },

  allowLocalRegistration: environment.data.ALLOW_LOCAL_REGISTRATION === 'true',

  clientUrl: environment.data.CLIENT_URL,

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
};
