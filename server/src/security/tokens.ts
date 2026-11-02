import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  type: 'access';
  exp: number;
}

export function createAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: 'access' }, config.jwt.secret, {
    algorithm: 'HS256',
    audience: config.jwt.audience,
    issuer: config.jwt.issuer,
    expiresIn: config.jwt.expiresIn as string | number,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
    audience: config.jwt.audience,
    issuer: config.jwt.issuer,
  });

  if (
    typeof payload === 'string' ||
    payload.type !== 'access' ||
    typeof payload.userId !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }

  return payload as unknown as AccessTokenPayload;
}

export function createRefreshToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url');
  return { rawToken, tokenHash: hashRefreshToken(rawToken) };
}

export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
