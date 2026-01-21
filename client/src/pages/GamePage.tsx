import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/game/Card';
import ActionPanel from '../components/game/ActionPanel';

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
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  holeCards?: CardData[];
  hasActed: boolean;
  lastAction?: string;
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
  currentBet: number;
  minRaise: number;
  turnTimeout: number;
  availableActions: string[];
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
}

// Positions des sièges autour d'une table ovale (pour 9 joueurs)
const SEAT_POSITIONS = [
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

export default function GamePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHoleCards, setMyHoleCards] = useState<CardData[]>([]);

  useEffect(() => {
    if (!socket || !isConnected || !tableId) return;

    // Écouter les événements du jeu
    socket.on('game:state-update', (state: GameState) => {
      setGameState(state);
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

    return () => {
      socket.off('game:state-update');
      socket.off('game:deal-hole-cards');
      socket.off('game:your-turn');
      socket.off('table:left');
      socket.off('table:error');
    };
  }, [socket, isConnected, tableId, navigate]);

  const handleAction = (action: string, amount?: number) => {
    if (!socket || !tableId) return;
    socket.emit('game:action', { tableId, action, amount });
  };

  const handleLeaveTable = () => {
    if (!socket || !tableId) return;
    socket.emit('table:leave', { tableId });
  };

  const myPlayer = gameState?.players.find((p) => p.odId === user?.id);
  const isMyTurn = gameState?.currentPlayerId === user?.id;

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement de la table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">{gameState.tableName}</h1>
          <p className="text-sm text-gray-400">
            Blinds: {formatAriary(gameState.smallBlind)} / {formatAriary(gameState.bigBlind)} | Main #{gameState.handNumber}
          </p>
        </div>
        <button onClick={handleLeaveTable} className="btn btn-danger">
          Quitter la table
        </button>
      </div>

      {/* Table de poker */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl aspect-[2/1]">
          {/* Table ovale */}
          <div className="absolute inset-0 poker-table rounded-[50%]">
            {/* Pot au centre */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-poker-gold font-bold text-2xl mb-2">
                {formatAriary(gameState.mainPot)}
              </div>

              {/* Cartes communes */}
              <div className="flex gap-2 justify-center">
                {gameState.communityCards.map((card, i) => (
                  <Card key={i} suit={card.suit} rank={card.rank} size="md" />
                ))}
                {/* Espaces vides pour les cartes à venir */}
                {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-600/50" />
                ))}
              </div>
            </div>
          </div>

          {/* Sièges des joueurs */}
          {SEAT_POSITIONS.map((pos, seatNum) => {
            const player = gameState.players.find((p) => p.seatNumber === seatNum);
            const isMe = player?.odId === user?.id;

            return (
              <div
                key={seatNum}
                className="absolute"
                style={pos}
              >
                {player ? (
                  <div
                    className={`
                      bg-gray-800 rounded-xl p-3 min-w-[120px] text-center
                      ${isMe ? 'ring-2 ring-poker-gold' : ''}
                      ${player.isFolded ? 'opacity-50' : ''}
                      ${gameState.currentPlayerIndex === seatNum ? 'ring-2 ring-green-500 animate-pulse' : ''}
                    `}
                  >
                    {/* Dealer button */}
                    {player.isDealer && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white text-black rounded-full text-xs font-bold flex items-center justify-center">
                        D
                      </div>
                    )}

                    {/* Nom et stack */}
                    <div className="font-medium text-white text-sm truncate">
                      {player.username}
                    </div>
                    <div className="text-poker-gold font-bold">
                      {formatAriary(player.chipStack)}
                    </div>

                    {/* Mise actuelle */}
                    {player.currentBet > 0 && (
                      <div className="text-yellow-400 text-sm">
                        Mise: {formatAriary(player.currentBet)}
                      </div>
                    )}

                    {/* Cartes du joueur */}
                    {isMe && myHoleCards.length > 0 && (
                      <div className="flex gap-1 justify-center mt-2">
                        {myHoleCards.map((card, i) => (
                          <Card key={i} suit={card.suit} rank={card.rank} size="sm" />
                        ))}
                      </div>
                    )}

                    {/* Cartes face cachée pour les autres */}
                    {!isMe && !player.isFolded && gameState.phase !== 'waiting' && (
                      <div className="flex gap-1 justify-center mt-2">
                        <Card faceDown size="sm" />
                        <Card faceDown size="sm" />
                      </div>
                    )}

                    {/* Status */}
                    {player.isFolded && (
                      <div className="text-red-400 text-xs mt-1">Fold</div>
                    )}
                    {player.isAllIn && (
                      <div className="text-purple-400 text-xs mt-1">All-In</div>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600/50 flex items-center justify-center text-gray-500 text-xs">
                    Siège {seatNum + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel d'actions */}
      {isMyTurn && myPlayer && (
        <div className="p-4 flex justify-center">
          <ActionPanel
            availableActions={gameState.availableActions as any}
            currentBet={gameState.currentBet}
            myCurrentBet={myPlayer.currentBet}
            myStack={myPlayer.chipStack}
            minRaise={gameState.minRaise}
            pot={gameState.mainPot}
            onAction={handleAction}
          />
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
    </div>
  );
}
