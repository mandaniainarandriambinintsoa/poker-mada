import { useEffect, useState } from 'react';
import Card from './Card';

interface CardData {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  code: string;
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

interface WinnerAnnouncementProps {
  winners: WinnerInfo[];
  onDismiss?: () => void;
  autoDismissMs?: number;
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
}

export default function WinnerAnnouncement({
  winners,
  onDismiss,
  autoDismissMs = 5000,
}: WinnerAnnouncementProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animation d'entrée
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    }, autoDismissMs);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [autoDismissMs, onDismiss]);

  if (winners.length === 0) return null;

  const isSplitPot = winners.length > 1;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/70 backdrop-blur-sm
        transition-opacity duration-300
        ${isVisible && !isExiting ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onDismiss}
    >
      <div
        className={`
          bg-gradient-to-b from-gray-800 to-gray-900
          rounded-2xl p-6 mx-4 max-w-lg w-full
          border-2 border-poker-gold shadow-2xl
          transition-all duration-300
          ${isVisible && !isExiting ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titre */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-poker-gold">
            {isSplitPot ? 'Pot Partagé!' : 'Gagnant!'}
          </h2>
        </div>

        {/* Liste des gagnants */}
        <div className="space-y-4">
          {winners.map((winner) => (
            <div
              key={winner.odId}
              className={`
                bg-gray-700/50 rounded-xl p-4
                ${!isSplitPot ? 'animate-pulse-slow' : ''}
              `}
            >
              {/* En-tête du gagnant */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 bg-poker-gold rounded-full flex items-center justify-center text-black font-bold text-xl">
                    {winner.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg">
                      {winner.username}
                    </div>
                    <div className="text-poker-gold font-semibold">
                      +{formatAriary(winner.amount)}
                    </div>
                  </div>
                </div>

                {/* Badge de victoire */}
                <div className="bg-poker-gold text-black px-3 py-1 rounded-full text-sm font-bold">
                  {isSplitPot ? `${Math.round(100 / winners.length)}%` : 'Winner'}
                </div>
              </div>

              {/* Description de la main */}
              <div className="text-center mb-3">
                <span className="text-lg text-white font-semibold bg-gray-600/50 px-4 py-1 rounded-full">
                  {winner.handDescription}
                </span>
              </div>

              {/* Cartes du joueur */}
              {winner.holeCards && winner.holeCards.length > 0 && (
                <div className="flex justify-center gap-2">
                  {winner.holeCards.map((card, i) => (
                    <Card key={i} suit={card.suit} rank={card.rank} size="md" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bouton de fermeture */}
        <button
          onClick={onDismiss}
          className="mt-4 w-full btn btn-secondary"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
