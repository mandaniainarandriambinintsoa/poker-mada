import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/game/Card';
import ActionPanel from '../components/game/ActionPanel';
import WinnerAnnouncement from '../components/game/WinnerAnnouncement';
import ChipStack from '../components/game/ChipStack';
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
    setGameState(state);

    // Détecter le showdown avec des gagnants
    if (state.phase === 'showdown' && state.lastWinners && state.lastWinners.length > 0) {
      setCurrentWinners(state.lastWinners);
      setShowWinnerAnnouncement(true);
    }
  }, []);

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

  const handleAction = (action: string, amount?: number) => {
    if (!socket || !tableId) return;
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

  // Debug logging for turn detection
  if (gameState && user) {
    console.log('[GamePage] Debug:', {
      userId: user.id,
      currentPlayerId: gameState.currentPlayerId,
      isMyTurn,
      myPlayerFound: !!myPlayer,
      myPlayerHoleCards: myPlayer?.holeCards?.length ?? 0,
      mySeatNumber,
      availableActions: gameState.availableActions,
      phase: gameState.phase,
      timerState: timerState ? { playerId: timerState.playerId, timeRemaining: timerState.timeRemaining } : null,
    });
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement de la table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* DEBUG PANEL - À RETIRER */}
      {myPlayer && (
        <div className="bg-red-900 text-white text-xs p-2">
          <div>DEBUG: holeCards={myPlayer.holeCards?.length ?? 'undefined'} | isMyTurn={isMyTurn ? 'OUI' : 'NON'} | timer={timerState ? timerState.timeRemaining + 's' : 'null'}</div>
          <div>phase={gameState.phase} | seat={mySeatNumber} | actions=[{gameState.availableActions.join(',')}]</div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <h1 className={`font-bold text-white truncate ${isMobile ? 'text-sm' : 'text-xl'}`}>
            {gameState.tableName}
          </h1>
          <p className={`text-gray-400 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
            {isMobile
              ? `${formatAriary(gameState.smallBlind)}/${formatAriary(gameState.bigBlind)} #${gameState.handNumber}`
              : `Blinds: ${formatAriary(gameState.smallBlind)} / ${formatAriary(gameState.bigBlind)} | Main #${gameState.handNumber}`
            }
          </p>
        </div>
        <button onClick={handleLeaveTable} className={`btn btn-danger whitespace-nowrap ${isMobile ? 'text-xs px-2 py-1' : ''}`}>
          {isMobile ? 'Quitter' : 'Quitter la table'}
        </button>
      </div>

      {/* Table de poker */}
      <div className={`flex-1 flex items-center justify-center p-2 sm:p-4 ${isMobile ? 'game-table-container' : ''}`}>
        <div className={`relative w-full ${isMobile ? 'max-w-md aspect-[3/4]' : 'max-w-5xl aspect-[2/1]'}`}>
          {/* Table ovale */}
          <div className={`absolute inset-0 poker-table ${isMobile ? 'rounded-[40%]' : 'rounded-[50%]'}`}>
            {/* Pot au centre */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              {/* Affichage visuel du pot avec jetons */}
              <PotDisplay
                mainPot={gameState.mainPot}
                sidePots={gameState.sidePots}
                compact={isMobile}
                animate={gameState.phase === 'showdown'}
              />

              {/* Cartes communes */}
              <div className={`flex justify-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
                {gameState.communityCards.map((card, i) => (
                  <Card key={i} suit={card.suit} rank={card.rank} size={cardSize} />
                ))}
                {/* Espaces vides pour les cartes à venir */}
                {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className={`rounded-lg border-2 border-dashed border-gray-600/50 ${
                      isMobile ? 'w-8 h-12' : isTablet ? 'w-10 h-14' : 'w-14 h-20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sièges des joueurs - tournés pour que le joueur actuel soit en bas */}
          {seatPositions.map((pos, visualSeatNum) => {
            // Utiliser la position visuelle pour obtenir le joueur (rotation)
            const player = getPlayerAtVisualPosition(visualSeatNum);
            const isMe = player?.odId === user?.id;

            return (
              <div
                key={visualSeatNum}
                className="absolute"
                style={pos}
              >
                {player ? (
                  <div
                    className={`
                      relative flex flex-col items-center text-center
                      ${player.isFolded ? 'opacity-40' : ''}
                      ${gameState.currentPlayerId === player.odId ? 'scale-105' : ''}
                      transition-transform duration-200
                    `}
                  >
                    {/* Dealer button */}
                    {player.isDealer && (
                      <div className={`absolute bg-yellow-400 text-black rounded-full font-bold flex items-center justify-center shadow-lg z-10 ${
                        isMobile ? '-top-1 -right-3 w-5 h-5 text-[9px]' : '-top-2 -right-4 w-7 h-7 text-xs'
                      }`}>
                        D
                      </div>
                    )}

                    {/* Timer au-dessus pour le joueur actuel */}
                    {timerState && timerState.playerId === player.odId && gameState.currentPlayerId === player.odId && (
                      <div className="mb-1">
                        <TurnTimer
                          timeRemaining={timerState.timeRemaining}
                          totalTime={timerState.totalTime}
                          isActive={true}
                          size={isMobile ? 'sm' : 'md'}
                        />
                      </div>
                    )}

                    {/* Stack */}
                    <div className={`text-poker-gold font-bold drop-shadow-lg ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {formatAriary(player.chipStack)}
                    </div>

                    {/* Cartes au milieu */}
                    <div className={`flex justify-center my-1 ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
                      {/* Cartes du joueur (moi) */}
                      {isMe && player.holeCards && player.holeCards.length > 0 && (
                        <>
                          {player.holeCards.map((card, i) => (
                            <Card key={i} suit={card.suit} rank={card.rank} size={holeCardSize} />
                          ))}
                        </>
                      )}

                      {/* Cartes face cachée pour les autres */}
                      {!isMe && !player.isFolded && gameState.phase !== 'waiting' && (
                        <>
                          <Card faceDown size={holeCardSize} />
                          <Card faceDown size={holeCardSize} />
                        </>
                      )}

                      {/* Placeholder si folded ou waiting */}
                      {(player.isFolded || gameState.phase === 'waiting') && !isMe && (
                        <div className={`${isMobile ? 'w-10 h-14' : 'w-14 h-20'}`} />
                      )}
                    </div>

                    {/* Pseudo en bas */}
                    <div
                      className={`
                        px-2 py-0.5 rounded-full font-medium truncate max-w-[90px]
                        ${isMobile ? 'text-[10px]' : 'text-xs'}
                        ${isMe ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black' : 'bg-gray-800/90 text-white'}
                        ${gameState.currentPlayerId === player.odId && !timerState ? 'ring-2 ring-green-400' : ''}
                        shadow-lg
                      `}
                    >
                      {player.username}
                    </div>

                    {/* Mise actuelle avec jetons visuels */}
                    {player.currentBet > 0 && (
                      <div className={`absolute ${isMobile ? '-bottom-5' : '-bottom-7'}`}>
                        <ChipStack
                          amount={player.currentBet}
                          size={isMobile ? 'sm' : 'md'}
                          maxChips={isMobile ? 3 : 5}
                          showAmount={true}
                        />
                      </div>
                    )}

                    {/* Status badges */}
                    {player.isFolded && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] px-2 py-0.5 rounded font-bold shadow">
                        FOLD
                      </div>
                    )}
                    {player.isAllIn && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] px-2 py-0.5 rounded font-bold shadow animate-pulse">
                        ALL-IN
                      </div>
                    )}
                    {player.isAway && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-600 text-white text-[8px] px-2 py-0.5 rounded font-bold shadow animate-pulse">
                        ABSENT
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`rounded-full border-2 border-dashed border-gray-600/50 flex items-center justify-center text-gray-500 ${
                    isMobile ? 'w-12 h-12 text-[8px]' : 'w-20 h-20 text-xs'
                  }`}>
                    {/* Afficher le numéro de siège réel, pas visuel */}
                    {isMobile ? ((visualSeatNum + mySeatNumber) % gameState.maxPlayers) + 1 : `Siège ${((visualSeatNum + mySeatNumber) % gameState.maxPlayers) + 1}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel d'actions avec cartes du joueur sur mobile */}
      {isMyTurn && myPlayer && (
        <div className={`flex flex-col items-center ${isMobile ? 'fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur safe-area-bottom' : 'p-4'}`}>
          {/* Cartes du joueur affichées au-dessus des actions sur mobile */}
          {isMobile && myPlayer.holeCards && myPlayer.holeCards.length > 0 && (
            <div className="flex items-center gap-3 py-2 border-b border-gray-700 w-full justify-center">
              <span className="text-gray-400 text-xs">Vos cartes:</span>
              <div className="flex gap-1">
                {myPlayer.holeCards.map((card, i) => (
                  <Card key={i} suit={card.suit} rank={card.rank} size="sm" />
                ))}
              </div>
              <span className="text-poker-gold text-xs font-bold">{formatAriary(myPlayer.chipStack)}</span>
            </div>
          )}
          <div className={isMobile ? 'p-2 w-full' : ''}>
            <ActionPanel
              availableActions={gameState.availableActions as any}
              currentBet={gameState.currentBet}
              myCurrentBet={myPlayer.currentBet}
              myStack={myPlayer.chipStack}
              minRaise={gameState.minRaise}
              pot={gameState.mainPot}
              onAction={handleAction}
              compact={isMobile}
            />
          </div>
        </div>
      )}

      {/* Status */}
      {!isMyTurn && gameState.phase !== 'waiting' && (
        <div className="p-4 text-center text-gray-400">
          {gameState.currentPlayerId
            ? `En attente de ${gameState.players.find((p) => p.odId === gameState.currentPlayerId)?.username}...`
            : 'Phase: ' + gameState.phase}
        </div>
      )}

      {gameState.phase === 'waiting' && (
        <div className="p-4 text-center text-yellow-400">
          En attente d'autres joueurs...
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
    </div>
  );
}
