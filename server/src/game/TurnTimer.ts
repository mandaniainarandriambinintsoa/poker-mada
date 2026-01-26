import { Server } from 'socket.io';

interface TurnTimerConfig {
  tableId: string;
  playerId: string;
  timeoutSeconds: number;
  onTimeout: () => void;
  io: Server;
}

class TurnTimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private startTimes: Map<string, number> = new Map();

  startTimer(config: TurnTimerConfig): void {
    const timerKey = `${config.tableId}-${config.playerId}`;

    // Annuler tout timer existant pour cette table
    this.clearTableTimers(config.tableId);

    const startTime = Date.now();
    this.startTimes.set(timerKey, startTime);

    // Envoyer les updates du timer toutes les secondes
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, config.timeoutSeconds - elapsed);

      config.io.to(`table:${config.tableId}`).emit('game:timer-update', {
        playerId: config.playerId,
        timeRemaining: remaining,
        totalTime: config.timeoutSeconds,
      });

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    this.intervals.set(timerKey, interval);

    // Timer principal pour l'auto-fold
    const timer = setTimeout(() => {
      console.log(`Timer expired for player ${config.playerId} on table ${config.tableId}`);
      this.clearTimerByKey(timerKey);
      config.onTimeout();
    }, config.timeoutSeconds * 1000);

    this.timers.set(timerKey, timer);

    // Envoyer l'état initial du timer
    config.io.to(`table:${config.tableId}`).emit('game:timer-update', {
      playerId: config.playerId,
      timeRemaining: config.timeoutSeconds,
      totalTime: config.timeoutSeconds,
    });
  }

  clearTableTimers(tableId: string): void {
    // Trouver et supprimer tous les timers pour cette table
    for (const [key, timer] of this.timers.entries()) {
      if (key.startsWith(`${tableId}-`)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
    for (const [key, interval] of this.intervals.entries()) {
      if (key.startsWith(`${tableId}-`)) {
        clearInterval(interval);
        this.intervals.delete(key);
      }
    }
    for (const [key] of this.startTimes.entries()) {
      if (key.startsWith(`${tableId}-`)) {
        this.startTimes.delete(key);
      }
    }
  }

  private clearTimerByKey(timerKey: string): void {
    const timer = this.timers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(timerKey);
    }
    const interval = this.intervals.get(timerKey);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(timerKey);
    }
    this.startTimes.delete(timerKey);
  }

  clearPlayerTimer(tableId: string, playerId: string): void {
    const timerKey = `${tableId}-${playerId}`;
    this.clearTimerByKey(timerKey);
  }

  getRemainingTime(tableId: string, playerId: string, timeoutSeconds: number): number {
    const timerKey = `${tableId}-${playerId}`;
    const startTime = this.startTimes.get(timerKey);
    if (!startTime) return timeoutSeconds;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, timeoutSeconds - elapsed);
  }
}

export const turnTimerManager = new TurnTimerManager();
