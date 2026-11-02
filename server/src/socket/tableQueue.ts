// This engine runs in one process. Serialize asynchronous joins per table;
// the database wallet lock independently protects cross-table reservations.
const queues = new Map<string, Promise<void>>();
export async function queueTable<T>(tableId: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(tableId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  queues.set(tableId, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(tableId) === current) queues.delete(tableId);
  }
}
