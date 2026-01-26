import { useEffect, useState } from 'react';

interface AwayOverlayProps {
  isAway: boolean;
  awayStartTime?: number;
  onReturn: () => void;
}

// Temps total avant exclusion (5 minutes en millisecondes)
const AWAY_TIMEOUT_MS = 5 * 60 * 1000;

export default function AwayOverlay({ isAway, awayStartTime, onReturn }: AwayOverlayProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (!isAway || !awayStartTime) return;

    const updateRemainingTime = () => {
      const elapsed = Date.now() - awayStartTime;
      const remaining = Math.max(0, AWAY_TIMEOUT_MS - elapsed);
      setRemainingTime(Math.ceil(remaining / 1000));
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [isAway, awayStartTime]);

  if (!isAway) return null;

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-4 text-center shadow-2xl border border-yellow-500/50">
        <div className="text-yellow-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Vous etes marque comme absent</h2>

        <p className="text-gray-400 mb-4">
          Vous avez ete automatiquement fold plusieurs fois de suite.
          Cliquez sur le bouton ci-dessous pour revenir dans la partie.
        </p>

        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm mb-1">Temps restant avant exclusion</p>
          <p className="text-3xl font-bold text-red-500">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>

        <button
          onClick={onReturn}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all transform hover:scale-105 active:scale-95"
        >
          Je suis revenu !
        </button>

        <p className="text-gray-500 text-xs mt-4">
          Si vous ne revenez pas avant la fin du compte a rebours, vous serez automatiquement retire de la table et vos jetons seront rendus a votre portefeuille.
        </p>
      </div>
    </div>
  );
}
