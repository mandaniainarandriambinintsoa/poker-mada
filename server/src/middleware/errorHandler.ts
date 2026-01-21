import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Erreur Prisma - violation de contrainte unique
  if ((err as any).code === 'P2002') {
    const field = (err as any).meta?.target?.[0] || 'champ';
    res.status(409).json({
      error: `Ce ${field} est déjà utilisé`,
      code: 'DUPLICATE_ENTRY',
    });
    return;
  }

  // Erreur générique
  res.status(500).json({
    error: 'Erreur serveur interne',
    code: 'INTERNAL_ERROR',
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route non trouvée',
    code: 'NOT_FOUND',
  });
};
