import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code = 'ERROR',
  ) {
    super(message);
  }
}
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Vérifiez les informations saisies',
      code: 'VALIDATION_ERROR',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res
      .status(409)
      .json({ error: 'Cette information ou référence est déjà utilisée', code: 'DUPLICATE_ENTRY' });
    return;
  }
  console.error(
    JSON.stringify({
      event: 'request.failed',
      type: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
  res.status(500).json({
    error: 'Le service est indisponible. Réessayez dans un instant.',
    code: 'INTERNAL_ERROR',
  });
};
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route introuvable', code: 'NOT_FOUND' });
};
