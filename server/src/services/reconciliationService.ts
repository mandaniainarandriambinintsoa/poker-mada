/**
 * Service de réconciliation des balances gelées
 *
 * Ce service vérifie périodiquement que les balances gelées correspondent
 * à des joueurs réellement présents sur des tables actives.
 *
 * Si un joueur a une balance gelée mais n'est sur aucune table,
 * la balance est automatiquement libérée.
 */

import { prisma } from '../config/database';

// Référence aux tables actives (sera injectée depuis socketManager)
let getActivePlayersFunc: (() => Set<string>) | null = null;

/**
 * Injecte la fonction pour obtenir les joueurs actifs sur les tables
 */
export function setActivePlayersProvider(fn: () => Set<string>): void {
  getActivePlayersFunc = fn;
}

/**
 * Réconcilie les balances gelées
 * Retourne le nombre de corrections effectuées
 */
export async function reconcileFrozenBalances(): Promise<{
  checked: number;
  corrected: number;
  details: Array<{ odId: string; username: string; amount: number }>;
}> {
  const details: Array<{ odId: string; username: string; amount: number }> = [];

  // Obtenir tous les utilisateurs avec une balance gelée > 0
  const usersWithFrozen = await prisma.user.findMany({
    where: {
      wallet: {
        frozenBalance: { gt: 0 },
      },
    },
    include: {
      wallet: true,
    },
  });

  if (usersWithFrozen.length === 0) {
    return { checked: 0, corrected: 0, details };
  }

  // Obtenir les joueurs actuellement sur les tables
  const activePlayers = getActivePlayersFunc ? getActivePlayersFunc() : new Set<string>();

  let corrected = 0;

  for (const user of usersWithFrozen) {
    if (!user.wallet) continue;

    const frozenAmount = Number(user.wallet.frozenBalance);
    if (frozenAmount <= 0) continue;

    // Vérifier si le joueur est sur une table active
    const isOnTable = activePlayers.has(user.id);

    if (!isOnTable) {
      // Le joueur a une balance gelée mais n'est sur aucune table
      // => Libérer la balance gelée
      console.log(`[RECONCILIATION] Libération de ${frozenAmount} Ar pour ${user.username} (${user.id})`);

      await prisma.$transaction([
        // Transférer le frozen vers le balance disponible
        prisma.wallet.update({
          where: { userId: user.id },
          data: {
            balance: { increment: frozenAmount },
            frozenBalance: 0,
          },
        }),
        // Créer une transaction de type REFUND pour tracer
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'REFUND',
            amount: frozenAmount,
            balanceBefore: Number(user.wallet.balance),
            balanceAfter: Number(user.wallet.balance) + frozenAmount,
            status: 'COMPLETED',
            description: '[SYSTEM] Réconciliation automatique - balance gelée orpheline',
            completedAt: new Date(),
          },
        }),
        // Logger dans AdminAuditLog
        prisma.adminAuditLog.create({
          data: {
            adminId: user.id, // Self-action par le système
            action: 'AUTO_RECONCILE',
            targetType: 'WALLET',
            targetId: user.wallet.id,
            details: {
              userId: user.id,
              username: user.username,
              frozenAmount,
              reason: 'Balance gelée sans présence sur table active',
            },
          },
        }),
      ]);

      details.push({
        odId: user.id,
        username: user.username,
        amount: frozenAmount,
      });

      corrected++;
    }
  }

  const result = {
    checked: usersWithFrozen.length,
    corrected,
    details,
  };

  if (corrected > 0) {
    console.log(`[RECONCILIATION] Terminé: ${corrected}/${usersWithFrozen.length} corrections`);
  }

  return result;
}

// Intervalle de réconciliation (5 minutes)
const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;

let reconciliationInterval: NodeJS.Timeout | null = null;

/**
 * Démarre la réconciliation périodique
 */
export function startPeriodicReconciliation(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
  }

  // Exécuter immédiatement au démarrage
  console.log('[RECONCILIATION] Démarrage du service de réconciliation...');
  reconcileFrozenBalances()
    .then((result) => {
      if (result.corrected > 0) {
        console.log(`[RECONCILIATION] Initial: ${result.corrected} corrections effectuées`);
      } else {
        console.log('[RECONCILIATION] Initial: Aucune correction nécessaire');
      }
    })
    .catch((err) => {
      console.error('[RECONCILIATION] Erreur initiale:', err);
    });

  // Puis exécuter périodiquement
  reconciliationInterval = setInterval(() => {
    reconcileFrozenBalances().catch((err) => {
      console.error('[RECONCILIATION] Erreur périodique:', err);
    });
  }, RECONCILIATION_INTERVAL_MS);

  console.log(`[RECONCILIATION] Service démarré (intervalle: ${RECONCILIATION_INTERVAL_MS / 1000}s)`);
}

/**
 * Arrête la réconciliation périodique
 */
export function stopPeriodicReconciliation(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
    console.log('[RECONCILIATION] Service arrêté');
  }
}
