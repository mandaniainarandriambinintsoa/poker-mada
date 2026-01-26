import { useEffect, useState } from 'react';

interface ChipAnimationProps {
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  amount: number;
  onComplete?: () => void;
  duration?: number;
}

// Couleurs des jetons basées sur le montant
function getChipColor(amount: number): string {
  if (amount >= 10000) return 'bg-gray-900 border-gray-600';
  if (amount >= 5000) return 'bg-blue-700 border-blue-400';
  if (amount >= 1000) return 'bg-green-600 border-green-400';
  if (amount >= 500) return 'bg-red-600 border-red-400';
  return 'bg-white border-gray-300';
}

export default function ChipAnimation({
  fromPosition,
  toPosition,
  amount,
  onComplete,
  duration = 500,
}: ChipAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [position, setPosition] = useState(fromPosition);

  useEffect(() => {
    // Démarrer l'animation après un court délai pour que le composant soit monté
    const startTimer = setTimeout(() => {
      setPosition(toPosition);
    }, 50);

    // Fin de l'animation
    const endTimer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, duration + 50);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [toPosition, duration, onComplete]);

  if (!isAnimating) return null;

  const chipColor = getChipColor(amount);
  const numChips = Math.min(Math.ceil(amount / 1000), 5);

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {Array.from({ length: numChips }).map((_, i) => (
        <div
          key={i}
          className={`
            absolute w-6 h-6 rounded-full border-2 border-dashed
            ${chipColor}
            shadow-lg
          `}
          style={{
            left: position.x,
            top: position.y,
            transform: `translate(-50%, -50%) translateY(${-i * 3}px)`,
            transition: `all ${duration}ms ease-out`,
            transitionDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Hook pour gérer les animations de jetons
interface PendingAnimation {
  id: string;
  fromSeat: number;
  amount: number;
  timestamp: number;
}

export function useChipAnimations() {
  const [animations, setAnimations] = useState<PendingAnimation[]>([]);

  const addAnimation = (fromSeat: number, amount: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    setAnimations(prev => [...prev, { id, fromSeat, amount, timestamp: Date.now() }]);
  };

  const removeAnimation = (id: string) => {
    setAnimations(prev => prev.filter(a => a.id !== id));
  };

  return { animations, addAnimation, removeAnimation };
}
