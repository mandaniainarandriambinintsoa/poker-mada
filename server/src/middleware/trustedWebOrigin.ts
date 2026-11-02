import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';

export function requireTrustedWebOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  const clientMarker = req.get('x-poker-client');
  let trustedOrigin = false;

  try {
    trustedOrigin = Boolean(origin && new URL(origin).origin === new URL(config.clientUrl).origin);
  } catch {
    trustedOrigin = false;
  }

  if (!trustedOrigin || clientMarker !== 'web') {
    res.status(403).json({ error: 'Origine non autorisée', code: 'UNTRUSTED_ORIGIN' });
    return;
  }

  next();
}
