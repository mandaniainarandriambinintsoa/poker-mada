import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Configuration Prisma optimisée pour haute charge
 *
 * Options de connexion via DATABASE_URL:
 * - connection_limit: Nombre max de connexions (défaut: 10)
 * - pool_timeout: Timeout pour obtenir une connexion (défaut: 10s)
 *
 * Exemple DATABASE_URL:
 * postgresql://user:password@host:5432/db?connection_limit=20&pool_timeout=20
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Request handlers log safe error codes; Prisma error output may include row values.
    log: process.env.NODE_ENV === 'development' ? ['warn'] : [],
    // Gestion des erreurs de connexion
    errorFormat: 'minimal',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    // Test de connexion
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection verified');
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'database.connection_failed',
        type: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('Database disconnected');
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'database.disconnect_failed',
        type: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
}

/**
 * Middleware de gestion des erreurs de connexion DB
 * À utiliser dans les opérations critiques
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = lastError?.message || 'Unknown error';

      // Si c'est une erreur de connexion, réessayer
      if (
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED')
      ) {
        console.warn(
          JSON.stringify({
            event: 'database.operation_retry',
            attempt,
            maxRetries,
            type: lastError?.name || 'UnknownError',
          }),
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
          continue;
        }
      }

      // Pour les autres erreurs, ne pas réessayer
      throw error;
    }
  }

  throw lastError;
}
