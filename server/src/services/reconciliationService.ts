import { prisma } from '../config/database';

let getActivePlayers: () => Set<string> = () => new Set();
let interval: NodeJS.Timeout | undefined;
export function setActivePlayersProvider(provider: () => Set<string>) {
  getActivePlayers = provider;
}

// Missing in-memory game state is not evidence of refundable money. Detect and
// report orphan reservations; never infer a payout from frozenBalance.
export async function reconcileFrozenBalances() {
  const active = getActivePlayers();
  const where = {
    type: 'TABLE_BUY_IN' as const,
    status: 'PROCESSING' as const,
    userId: { notIn: [...active] },
  };
  const [reservations, unresolved] = await Promise.all([
    prisma.transaction.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, amount: true, user: { select: { username: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);
  return {
    checked: reservations.length,
    corrected: 0,
    unresolved,
    details: reservations.map((r) => ({
      odId: r.userId,
      username: r.user.username,
      amount: Number(r.amount),
      reservationId: r.id,
    })),
    message: unresolved
      ? 'Réservations à vérifier : aucun solde modifié.'
      : 'Aucune réservation orpheline détectée.',
  };
}

export function startPeriodicReconciliation() {
  stopPeriodicReconciliation();
  interval = setInterval(() => {
    void reconcileFrozenBalances()
      .then((result) => {
        if (result.unresolved)
          console.warn(
            JSON.stringify({ event: 'wallet.orphan_reservations', count: result.unresolved }),
          );
      })
      .catch(() => console.error(JSON.stringify({ event: 'wallet.reconciliation_failed' })));
  }, 300_000);
  interval.unref();
}

export function stopPeriodicReconciliation() {
  if (interval) clearInterval(interval);
  interval = undefined;
}
