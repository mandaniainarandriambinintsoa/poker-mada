/**
 * AWAY MANAGER - Gestion des joueurs absents/déconnectés
 *
 * Quand un joueur a 2 auto-folds consécutifs, il est marqué comme "away".
 * Il a 5 minutes pour revenir (bouton "Je suis revenu").
 * Après 5 minutes, il est automatiquement exclu de la table.
 */

import { Server } from 'socket.io';

// Temps d'attente avant exclusion automatique (5 minutes)
const AWAY_TIMEOUT_MS = 5 * 60 * 1000;

// Nombre d'auto-folds consécutifs avant d'être marqué comme absent
const CONSECUTIVE_TIMEOUTS_THRESHOLD = 2;

interface AwayPlayer {
  odId: string;
  tableId: string;
  username: string;
  awayStartTime: number;
  exclusionTimer: NodeJS.Timeout;
}

class AwayManager {
  private awayPlayers: Map<string, AwayPlayer> = new Map();

  /**
   * Vérifie si un joueur doit être marqué comme absent après un auto-fold
   * @returns true si le joueur vient d'être marqué comme absent
   */
  checkAndMarkAway(
    playerId: string,
    tableId: string,
    username: string,
    consecutiveTimeouts: number,
    io: Server,
    onExclude: () => void
  ): boolean {
    // Vérifier si le seuil d'auto-folds consécutifs est atteint
    if (consecutiveTimeouts < CONSECUTIVE_TIMEOUTS_THRESHOLD) {
      return false;
    }

    // Si déjà marqué comme absent, ne rien faire
    if (this.awayPlayers.has(playerId)) {
      return true;
    }

    const awayStartTime = Date.now();

    // Créer le timer d'exclusion automatique
    const exclusionTimer = setTimeout(() => {
      console.log(`[AWAY] Auto-excluding player ${username} from table ${tableId} (5 min timeout)`);
      this.awayPlayers.delete(playerId);
      onExclude();
    }, AWAY_TIMEOUT_MS);

    // Enregistrer le joueur comme absent
    this.awayPlayers.set(playerId, {
      odId: playerId,
      tableId,
      username,
      awayStartTime,
      exclusionTimer,
    });

    console.log(`[AWAY] Player ${username} marked as away on table ${tableId}`);

    // Notifier tous les joueurs de la table
    io.to(`table:${tableId}`).emit('player:away', {
      odId: playerId,
      username,
      awayStartTime,
      exclusionTime: awayStartTime + AWAY_TIMEOUT_MS,
    });

    return true;
  }

  /**
   * Le joueur revient - annuler le timer d'exclusion
   * @returns true si le joueur était absent et est revenu
   */
  playerReturned(playerId: string, io: Server): boolean {
    const awayPlayer = this.awayPlayers.get(playerId);
    if (!awayPlayer) {
      return false;
    }

    // Annuler le timer d'exclusion
    clearTimeout(awayPlayer.exclusionTimer);
    this.awayPlayers.delete(playerId);

    console.log(`[AWAY] Player ${awayPlayer.username} returned to table ${awayPlayer.tableId}`);

    // Notifier tous les joueurs de la table
    io.to(`table:${awayPlayer.tableId}`).emit('player:returned', {
      odId: playerId,
      username: awayPlayer.username,
    });

    return true;
  }

  /**
   * Vérifie si un joueur est marqué comme absent
   */
  isAway(playerId: string): boolean {
    return this.awayPlayers.has(playerId);
  }

  /**
   * Obtenir les infos d'un joueur absent
   */
  getAwayInfo(playerId: string): AwayPlayer | undefined {
    return this.awayPlayers.get(playerId);
  }

  /**
   * Temps restant avant exclusion (en secondes)
   */
  getRemainingTime(playerId: string): number {
    const awayPlayer = this.awayPlayers.get(playerId);
    if (!awayPlayer) return 0;

    const elapsed = Date.now() - awayPlayer.awayStartTime;
    const remaining = Math.max(0, AWAY_TIMEOUT_MS - elapsed);
    return Math.ceil(remaining / 1000);
  }

  /**
   * Retirer un joueur de la liste des absents (quand il quitte la table)
   */
  removePlayer(playerId: string): void {
    const awayPlayer = this.awayPlayers.get(playerId);
    if (awayPlayer) {
      clearTimeout(awayPlayer.exclusionTimer);
      this.awayPlayers.delete(playerId);
    }
  }

  /**
   * Réinitialiser le compteur d'auto-folds quand le joueur joue activement
   * (Cette méthode sera appelée depuis socketManager quand le joueur fait une action manuelle)
   */
  resetConsecutiveTimeouts(playerId: string): void {
    // Le compteur est stocké dans Table.ts, pas ici
    // Cette méthode est un placeholder pour la logique
  }
}

export const awayManager = new AwayManager();
export { CONSECUTIVE_TIMEOUTS_THRESHOLD, AWAY_TIMEOUT_MS };
