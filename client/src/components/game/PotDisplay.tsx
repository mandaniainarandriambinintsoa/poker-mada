import { useMemo } from 'react';

interface PotDisplayProps {
  mainPot: number;
  sidePots?: { amount: number; eligiblePlayers: string[] }[];
  compact?: boolean;
  animate?: boolean;
}

// Définition des valeurs et couleurs des jetons pour le pot
const CHIP_VALUES = [
  { value: 10000, color: 'bg-gray-900 border-gray-600' },
  { value: 5000, color: 'bg-blue-700 border-blue-400' },
  { value: 1000, color: 'bg-green-600 border-green-400' },
  { value: 500, color: 'bg-red-600 border-red-400' },
  { value: 100, color: 'bg-white border-gray-300' },
];

interface ChipStack {
  color: string;
  count: number;
}

function calculatePotChips(amount: number, maxChips: number = 12): ChipStack[] {
  const chips: ChipStack[] = [];
  let remaining = amount;

  for (const chipDef of CHIP_VALUES) {
    if (remaining >= chipDef.value) {
      const count = Math.floor(remaining / chipDef.value);
      const displayCount = Math.min(count, 4); // Max 4 de chaque type
      chips.push({
        color: chipDef.color,
        count: displayCount,
      });
      remaining = remaining % chipDef.value;

      // Arrêter si on a assez de jetons
      const totalChips = chips.reduce((sum, c) => sum + c.count, 0);
      if (totalChips >= maxChips) break;
    }
  }

  return chips;
}

function formatPotAmount(amount: number): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M Ar';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'k Ar';
  }
  return amount + ' Ar';
}

export default function PotDisplay({
  mainPot,
  sidePots = [],
  compact = false,
  animate = false,
}: PotDisplayProps) {
  const potChips = useMemo(() => calculatePotChips(mainPot, compact ? 8 : 12), [mainPot, compact]);

  // Créer un tableau plat de tous les jetons
  const allChips: { color: string; stackIndex: number; chipIndex: number }[] = [];
  let stackIndex = 0;
  for (const stack of potChips) {
    for (let i = 0; i < stack.count; i++) {
      allChips.push({ color: stack.color, stackIndex, chipIndex: i });
    }
    stackIndex++;
  }

  // Organiser les jetons en colonnes pour un effet visuel
  const columns = useMemo(() => {
    const cols: typeof allChips[] = [[], [], []];
    allChips.forEach((chip, i) => {
      cols[i % 3].push(chip);
    });
    return cols;
  }, [allChips]);

  return (
    <div className="flex flex-col items-center">
      {/* Stacks de jetons visuels */}
      {mainPot > 0 && (
        <div className={`flex justify-center gap-1 mb-2 ${animate ? 'animate-pot-win' : ''}`}>
          {columns.map((column, colIdx) => (
            <div key={colIdx} className="relative" style={{ height: `${column.length * 4 + 20}px`, width: '24px' }}>
              {column.map((chip, chipIdx) => (
                <div
                  key={chipIdx}
                  className={`
                    absolute w-6 h-6 rounded-full border-2 border-dashed
                    ${chip.color}
                    shadow-sm
                  `}
                  style={{
                    bottom: `${chipIdx * 4}px`,
                    left: 0,
                    zIndex: chipIdx,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Montant du pot principal */}
      <div className={`
        text-poker-gold font-bold
        ${compact ? 'text-lg' : 'text-2xl'}
        bg-black/30 px-3 py-1 rounded-full
      `}>
        {formatPotAmount(mainPot)}
      </div>

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 justify-center">
          {sidePots.map((sidePot, i) => (
            <div
              key={i}
              className="bg-gray-700/50 px-2 py-1 rounded-lg text-sm"
            >
              <span className="text-gray-400">Side {i + 1}: </span>
              <span className="text-poker-gold font-semibold">
                {formatPotAmount(sidePot.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
