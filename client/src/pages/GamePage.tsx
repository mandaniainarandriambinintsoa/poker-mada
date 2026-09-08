import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/game/Card';
import ActionPanel, { type PlayerAction } from '../components/game/ActionPanel';
import WinnerAnnouncement from '../components/game/WinnerAnnouncement';
import PotDisplay from '../components/game/PotDisplay';
import TurnTimer from '../components/game/TurnTimer';
import AwayOverlay from '../components/game/AwayOverlay';
import { useResponsive } from '../hooks/useResponsive';

interface TimerState {
  playerId: string;
  timeRemaining: number;
  totalTime: number;
}

interface CardData {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  code: string;
}

interface TablePlayer {
  odId: string
  username: string;
  avatar?: string;
  seatNumber: number;
  chipStack: number;
  currentBet: number;
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isAway: boolean;
  awayStartTime?: number;
  consecutiveTimeouts: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  holeCards?: CardData[];
  hasActed: boolean;
  lastAction?: string;
}

interface WinnerInfo {
  odId: string;
  username: string;
  amount: number;
  handDescription: string;
  handRank: string;
  winningCards: CardData[];
  holeCards: CardData[];
  potType: 'main' | 'side';
  isSplit: boolean;
}

interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}

interface GameState {
  sessionId: string;
  tableId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  phase: string;
  handNumber: number;
  players: TablePlayer[];
  maxPlayers: number;
  dealerPosition: number;
  currentPlayerIndex: number;
  currentPlayerId?: string;
  communityCards: CardData[];
  mainPot: number;
  sidePots?: SidePot[];
  currentBet: number;
  minRaise: number;
  turnTimeout: number;
  availableActions: string[];
  lastWinners?: WinnerInfo[];
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'En attente',
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// Positions des sièges autour d'une table ovale (pour 9 joueurs)
// Positions pour Desktop
const SEAT_POSITIONS_DESKTOP = [
  { top: '85%', left: '50%', transform: 'translate(-50%, -50%)' }, // 0 - bas centre
  { top: '75%', left: '15%', transform: 'translate(-50%, -50%)' }, // 1 - bas gauche
  { top: '50%', left: '5%', transform: 'translate(-50%, -50%)' }, // 2 - milieu gauche
  { top: '25%', left: '15%', transform: 'translate(-50%, -50%)' }, // 3 - haut gauche
  { top: '10%', left: '35%', transform: 'translate(-50%, -50%)' }, // 4 - haut gauche centre
  { top: '10%', left: '65%', transform: 'translate(-50%, -50%)' }, // 5 - haut droit centre
  { top: '25%', left: '85%', transform: 'translate(-50%, -50%)' }, // 6 - haut droit
  { top: '50%', left: '95%', transform: 'translate(-50%, -50%)' }, // 7 - milieu droit
  { top: '75%', left: '85%', transform: 'translate(-50%, -50%)' }, // 8 - bas droit
];

// Positions pour Tablet (légèrement condensées)
const SEAT_POSITIONS_TABLET = [
  { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' }, // 0 - bas centre
  { top: '78%', left: '12%', transform: 'translate(-50%, -50%)' }, // 1 - bas gauche
  { top: '50%', left: '2%', transform: 'translate(-50%, -50%)' }, // 2 - milieu gauche
  { top: '22%', left: '12%', transform: 'translate(-50%, -50%)' }, // 3 - haut gauche
  { top: '8%', left: '35%', transform: 'translate(-50%, -50%)' }, // 4 - haut gauche centre
  { top: '8%', left: '65%', transform: 'translate(-50%, -50%)' }, // 5 - haut droit centre
  { top: '22%', left: '88%', transform: 'translate(-50%, -50%)' }, // 6 - haut droit
  { top: '50%', left: '98%', transform: 'translate(-50%, -50%)' }, // 7 - milieu droit
  { top: '78%', left: '88%', transform: 'translate(-50%, -50%)' }, // 8 - bas droit
];

// Positions pour Mobile (optimisées pour écran vertical)
const SEAT_POSITIONS_MOBILE = [
  { top: '78%', left: '50%', transform: 'translate(-50%, -50%)' }, // 0 - bas centre (joueur) - remonté pour laisser place aux cartes
  { top: '68%', left: '8%', transform: 'translate(-50%, -50%)' }, // 1 - bas gauche
  { top: '45%', left: '2%', transform: 'translate(-50%, -50%)' }, // 2 - milieu gauche
  { top: '22%', left: '8%', transform: 'translate(-50%, -50%)' }, // 3 - haut gauche
  { top: '5%', left: '30%', transform: 'translate(-50%, -50%)' }, // 4 - haut gauche centre
  { top: '5%', left: '70%', transform: 'translate(-50%, -50%)' }, // 5 - haut droit centre
  { top: '22%', left: '92%', transform: 'translate(-50%, -50%)' }, // 6 - haut droit
  { top: '45%', left: '98%', transform: 'translate(-50%, -50%)' }, // 7 - milieu droit
  { top: '68%', left: '92%', transform: 'translate(-50%, -50%)' }, // 8 - bas droit
];

function getSeatPositions(deviceType: 'mobile' | 'tablet' | 'desktop') {
  switch (deviceType) {
    case 'mobile':
      return SEAT_POSITIONS_MOBILE;
    case 'tablet':
      return SEAT_POSITIONS_TABLET;
    default:
      return SEAT_POSITIONS_DESKTOP;
  }
}

export default function GamePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { deviceType, isMobile, isTablet } = useResponsive();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [, setMyHoleCards] = useState<CardData[]>([]);
  const [showWinnerAnnouncement, setShowWinnerAnnouncement] = useState(false);
  const [currentWinners, setCurrentWinners] = useState<WinnerInfo[]>([]);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [isAway, setIsAway] = useState(false);
  const [awayStartTime, setAwayStartTime] = useState<number | undefined>(undefined);
  const hasJoinedRef = useRef(false);
  // État pour la modal de confirmation de départ
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [canForceFold, setCanForceFold] = useState(false);

  // Positions des sièges adaptées à la taille d'écran
  const seatPositions = useMemo(() => getSeatPositions(deviceType), [deviceType]);

  // Taille des cartes adaptée
  const cardSize = useMemo(() => {
    if (isMobile) return 'sm' as const;
    if (isTablet) return 'sm' as const;
    return 'md' as const;
  }, [isMobile, isTablet]);

  // Taille des cartes des joueurs - agrandie pour meilleure visibilité
  const holeCardSize = useMemo(() => {
    if (isMobile) return 'sm' as const;
    return 'md' as const;
  }, [isMobile]);

  // Gestionnaire de mise à jour d'état avec détection de gagnant
  const handleGameStateUpdate = useCallback((state: GameState) => {
    setGameState((prevState) => {
      // Reset l'état "absent" quand une nouvelle main commence
      if (prevState && state.handNumber !== prevState.handNumber) {
        setIsAway(false);
        setAwayStartTime(undefined);
      }
      return state;
    });

    // Vérifier si le joueur actuel n'est plus marqué comme away côté serveur
    if (user) {
      const myPlayer = state.players.find(p => p.odId === user.id);
      if (myPlayer && !myPlayer.isAway) {
        setIsAway(false);
        setAwayStartTime(undefined);
      }
    }

    // Détecter le showdown avec des gagnants
    if (state.phase === 'showdown' && state.lastWinners && state.lastWinners.length > 0) {
      setCurrentWinners(state.lastWinners);
      setShowWinnerAnnouncement(true);
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !isConnected || !tableId) return;

    // Si buyIn est dans l'URL et on n'a pas encore rejoint, rejoindre la table
    const buyIn = searchParams.get('buyIn');
    if (buyIn && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      socket.emit('table:join', { tableId, buyIn: parseInt(buyIn, 10) });
    } else {
      // Sinon, demander l'état actuel de la table
      socket.emit('table:get-state', { tableId });
    }

    // Écouter les événements du jeu
    socket.on('game:state-update', handleGameStateUpdate);

    // Recevoir l'état initial après avoir rejoint
    socket.on('table:joined', (data: { tableId: string; gameState: GameState }) => {
      if (data.tableId === tableId) {
        handleGameStateUpdate(data.gameState);
      }
    });

    // Recevoir l'état demandé
    socket.on('table:state', (data: { tableId: string; gameState: GameState }) => {
      if (data.tableId === tableId) {
        handleGameStateUpdate(data.gameState);
      }
    });

    socket.on('game:deal-hole-cards', (cards: CardData[]) => {
      setMyHoleCards(cards);
    });

    socket.on('game:your-turn', (data) => {
      // Jouer un son ou vibrer
      console.log('Your turn!', data);
    });

    socket.on('table:left', () => {
      navigate('/lobby');
    });

    socket.on('table:error', (error) => {
      console.error('Table error:', error);
    });

    // Écouter les mises à jour du timer
    socket.on('game:timer-update', (data: TimerState) => {
      setTimerState(data);
    });

    // Écouter les événements d'absence
    socket.on('player:away', (data: { odId: string; username: string; awayStartTime: number }) => {
      console.log('[AWAY EVENT] Received player:away', data, 'user?.id=', user?.id);
      if (data.odId === user?.id) {
        console.log('[AWAY EVENT] Setting isAway to true');
        setIsAway(true);
        setAwayStartTime(data.awayStartTime);
      }
    });

    socket.on('player:returned', (data: { odId: string; username: string }) => {
      if (data.odId === user?.id) {
        setIsAway(false);
        setAwayStartTime(undefined);
      }
    });

    socket.on('player:excluded', (data: { odId: string; username: string; reason: string }) => {
      if (data.odId === user?.id) {
        // Le joueur a été exclu, rediriger vers le lobby
        setIsAway(false);
        setAwayStartTime(undefined);
        navigate('/lobby');
      }
    });

    // Écouter le refus de quitter la table (règles du poker)
    socket.on('table:leave-denied', (data: { reason: string; canForceFold: boolean }) => {
      setLeaveReason(data.reason);
      setCanForceFold(data.canForceFold);
      setShowLeaveConfirm(true);
    });

    return () => {
      socket.off('game:state-update');
      socket.off('table:joined');
      socket.off('table:state');
      socket.off('game:deal-hole-cards');
      socket.off('game:your-turn');
      socket.off('table:left');
      socket.off('table:error');
      socket.off('game:timer-update');
      socket.off('player:away');
      socket.off('player:returned');
      socket.off('player:excluded');
      socket.off('table:leave-denied');
    };
  }, [socket, isConnected, tableId, navigate, handleGameStateUpdate, searchParams, user]);

  const handleAction = (action: PlayerAction, amount?: number) => {
    if (!socket || !tableId) return;
    // Reset l'état "absent" quand le joueur fait une action
    if (isAway) {
      setIsAway(false);
      setAwayStartTime(undefined);
    }
    socket.emit('game:action', { tableId, action, amount });
  };

  const handleLeaveTable = () => {
    if (!socket || !tableId) return;
    socket.emit('table:leave', { tableId });
  };

  const handleForceFoldAndLeave = () => {
    if (!socket || !tableId) return;
    setShowLeaveConfirm(false);
    socket.emit('table:leave', { tableId, forceFold: true });
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
    setLeaveReason('');
    setCanForceFold(false);
  };

  const handleDismissWinnerAnnouncement = useCallback(() => {
    setShowWinnerAnnouncement(false);
    setCurrentWinners([]);
  }, []);

  const handleReturn = useCallback(() => {
    if (!socket || !tableId) return;
    socket.emit('player:return', { tableId });
  }, [socket, tableId]);

  const myPlayer = gameState?.players.find((p) => p.odId === user?.id);
  const isMyTurn = gameState?.currentPlayerId === user?.id;

  // Calculer la rotation pour que le joueur actuel soit toujours en position 0 (bas centre)
  const mySeatNumber = myPlayer?.seatNumber ?? 0;

  // Fonction pour obtenir le joueur à une position visuelle donnée
  // La position visuelle 0 = bas centre (moi), les autres sont tournés autour
  const getPlayerAtVisualPosition = useCallback((visualPos: number): TablePlayer | undefined => {
    if (!gameState) return undefined;
    // Calculer le seatNumber réel basé sur la rotation
    const realSeatNumber = (visualPos + mySeatNumber) % gameState.maxPlayers;
    return gameState.players.find((p) => p.seatNumber === realSeatNumber);
  }, [gameState, mySeatNumber]);

  if (!gameState) {
    return (
      <div className="game-loading">
        <span className="game-loading__mark">PM</span>
        <div>
          <strong>Préparation de la table</strong>
          <span>On mélange les cartes…</span>
        </div>
      </div>
    );
  }

  return (
    <main className={`game-room ${isMyTurn ? 'game-room--my-turn' : ''}`}>
      <header className="game-topbar mobile-safe-top">
        <button type="button" onClick={handleLeaveTable} className="game-topbar__back" aria-label="Quitter la table">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Lobby</span>
        </button>
        <div className="game-topbar__identity">
          <span className="game-topbar__kicker">Poker Mada · Cash game</span>
          <h1>{gameState.tableName}</h1>
        </div>
        <div className="game-topbar__meta">
          <div>
            <span>Blinds</span>
            <strong>{formatAriary(gameState.smallBlind)} / {formatAriary(gameState.bigBlind)}</strong>
          </div>
          <div>
            <span>Main</span>
            <strong>#{gameState.handNumber}</strong>
          </div>
          <span className={`connection-pill ${isConnected ? 'is-online' : ''}`}>
            <i aria-hidden="true" />
            {isConnected ? 'En ligne' : 'Reconnexion'}
          </span>
        </div>
      </header>

      <section className="game-arena" aria-label="Table de poker">
        <div className={`game-table-wrap ${isMobile ? 'is-mobile' : ''}`}>
          <div className="poker-table">
            <div className="poker-table__line" aria-hidden="true" />
            <div className="poker-table__brand" aria-hidden="true">
              <span>PM</span>
              <small>Madagascar</small>
            </div>

            <div className="community-zone">
              <div className="community-zone__phase">
                <span>{PHASE_LABELS[gameState.phase] ?? gameState.phase}</span>
                <i />
                <span>{gameState.communityCards.length}/5 cartes</span>
              </div>
              <div className="community-cards">
                {gameState.communityCards.map((card, i) => (
                  <Card key={i} suit={card.suit} rank={card.rank} size={cardSize} />
                ))}
                {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div key={`empty-${i}`} className={`poker-card-slot poker-card-slot--${cardSize}`} />
                ))}
              </div>
            </div>

            <div className="pot-zone">
              <PotDisplay
                mainPot={gameState.mainPot}
                sidePots={gameState.sidePots}
                compact={isMobile}
                animate={gameState.phase === 'showdown'}
              />
            </div>
          </div>

          {seatPositions.map((pos, visualSeatNum) => {
            const player = getPlayerAtVisualPosition(visualSeatNum);
            const isMe = player?.odId === user?.id;
            const isCurrent = gameState.currentPlayerId === player?.odId;

            return (
              <div key={visualSeatNum} className="game-seat" style={pos}>
                {player ? (
                  <div className={`player-seat ${isMe ? 'player-seat--hero' : ''} ${isCurrent ? 'is-active' : ''} ${player.isFolded ? 'is-folded' : ''}`}>
                    {player.isDealer && (
                      <span className="dealer-chip" aria-label="Donneur">D</span>
                    )}

                    {player.currentBet > 0 && (
                      <span className="player-bet">
                        <i aria-hidden="true" />
                        {formatAriary(player.currentBet)}
                      </span>
                    )}

                    <div className="player-seat__cards">
                      {isMe && player.holeCards?.map((card, i) => (
                        <Card key={i} suit={card.suit} rank={card.rank} size={holeCardSize} />
                      ))}
                      {!isMe && !player.isFolded && gameState.phase !== 'waiting' && (
                        <>
                          <Card faceDown size={isMobile ? 'xs' : 'sm'} />
                          <Card faceDown size={isMobile ? 'xs' : 'sm'} />
                        </>
                      )}
                    </div>

                    <div className="player-seat__panel">
                      <div className="player-avatar" aria-hidden="true">{getInitials(player.username)}</div>
                      <div className="player-seat__info">
                        <strong>{isMe ? 'Vous' : player.username}</strong>
                        <span>{formatAriary(player.chipStack)}</span>
                      </div>
                      {timerState && timerState.playerId === player.odId && isCurrent && (
                        <TurnTimer
                          timeRemaining={timerState.timeRemaining}
                          totalTime={timerState.totalTime}
                          isActive
                          size={isMobile ? 'sm' : 'md'}
                        />
                      )}
                    </div>

                    {(player.lastAction || player.isFolded || player.isAllIn || player.isAway) && (
                      <span className={`player-status ${player.isAllIn ? 'is-all-in' : ''}`}>
                        {player.isFolded ? 'Couché' : player.isAllIn ? 'Tapis' : player.isAway ? 'Absent' : player.lastAction}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="empty-seat" aria-label={`Siège ${((visualSeatNum + mySeatNumber) % gameState.maxPlayers) + 1} libre`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 7a7 7 0 0 1 14 0" />
                    </svg>
                    <span>Libre</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isMyTurn && myPlayer && (
        <div className="game-actions safe-area-bottom">
          <ActionPanel
            availableActions={gameState.availableActions as PlayerAction[]}
            currentBet={gameState.currentBet}
            myCurrentBet={myPlayer.currentBet}
            myStack={myPlayer.chipStack}
            minRaise={gameState.minRaise}
            pot={gameState.mainPot}
            onAction={handleAction}
            compact={isMobile}
          />
        </div>
      )}

      {!isMyTurn && gameState.phase !== 'waiting' && (
        <div className="game-status" role="status">
          <span className="game-status__dots" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <span>La partie continue</span>
            <strong>
              {gameState.currentPlayerId
                ? `Au tour de ${gameState.players.find((p) => p.odId === gameState.currentPlayerId)?.username}`
                : PHASE_LABELS[gameState.phase] ?? gameState.phase}
            </strong>
          </div>
        </div>
      )}

      {gameState.phase === 'waiting' && (
        <div className="game-status game-status--waiting" role="status">
          <span className="game-status__dots" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <span>Table ouverte</span>
            <strong>En attente d’autres joueurs</strong>
          </div>
        </div>
      )}

      {/* Annonce du gagnant */}
      {showWinnerAnnouncement && currentWinners.length > 0 && (
        <WinnerAnnouncement
          winners={currentWinners}
          onDismiss={handleDismissWinnerAnnouncement}
          autoDismissMs={5000}
        />
      )}

      {/* Overlay d'absence */}
      <AwayOverlay
        isAway={isAway}
        awayStartTime={awayStartTime}
        onReturn={handleReturn}
      />

      {/* Modal de confirmation pour quitter la table */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-auto text-center shadow-2xl border border-red-500/50">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-3">Impossible de quitter</h2>

            <p className="text-gray-300 mb-6">{leaveReason}</p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Rester
              </button>
              {canForceFold && (
                <button
                  onClick={handleForceFoldAndLeave}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Fold et Quitter
                </button>
              )}
            </div>

            {canForceFold && (
              <p className="text-gray-500 text-xs mt-4">
                En cliquant sur "Fold et Quitter", vous abandonnerez la main en cours et vos mises actuelles.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
