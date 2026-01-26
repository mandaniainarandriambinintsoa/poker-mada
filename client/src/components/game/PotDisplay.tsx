import { useMemo } from 'react';

interface PotDisplayProps {
  mainPot: number;
  sidePots?: { amount: number; eligiblePlayers: string[] }[];
  compact?: boolean;
  animate?: boolean;
}

// Définition des valeurs et couleurs des jetons pour le pot - design amélioré
const CHIP_VALUES = [
  { value: 10000, bgColor: '#1a1a2e', borderColor: '#6366f1', innerColor: '#2d2d4a' },
  { value: 5000, bgColor: '#1e3a5f', borderColor: '#3b82f6', innerColor: '#2a5080' },
  { value: 1000, bgColor: '#14532d', borderColor: '#22c55e', innerColor: '#1a6637' },
  { value: 500, bgColor: '#7f1d1d', borderColor: '#ef4444', innerColor: '#991b1b' },
  { value: 100, bgColor: '#e5e5e5', borderColor: '#a3a3a3', innerColor: '#d4d4d4' },
];

interface ChipStack {
  bgColor: string;
  borderColor: string;
  innerColor: string;
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
        bgColor: chipDef.bgColor,
        borderColor: chipDef.borderColor,
        innerColor: chipDef.innerColor,
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
    return Math.floor(amount / 1000) + ' ' + String(amount % 1000).padStart(3, '0') + ' Ar';
  }
  return amount + ' Ar';
}

export default function PotDisplay({
  mainPot,
  sidePots = [],
  compact = false,
  animate = false,
}: PotDisplayProps) {
  const potChips = useMemo(() => calculatePotChips(mainPot, compact ? 6 : 10), [mainPot, compact]);

  // Créer un tableau plat de tous les jetons
  const allChips: { bgColor: string; borderColor: string; innerColor: string; stackIndex: number; chipIndex: number }[] = [];
  let stackIndex = 0;
  for (const stack of potChips) {
    for (let i = 0; i < stack.count; i++) {
      allChips.push({
        bgColor: stack.bgColor,
        borderColor: stack.borderColor,
        innerColor: stack.innerColor,
        stackIndex,
        chipIndex: i,
      });
    }
    stackIndex++;
  }

  // Organiser les jetons en colonnes
  const columns = useMemo(() => {
    const numCols = compact ? 2 : 3;
    const cols: typeof allChips[] = Array.from({ length: numCols }, () => []);
    allChips.forEach((chip, i) => {
      cols[i % numCols].push(chip);
    });
    return cols;
  }, [allChips, compact]);

  const chipSize = compact ? 20 : 26;
  const chipOffset = compact ? 3 : 4;

  return (
    <div className="flex flex-col items-center">
      {/* Montant du pot principal - affiché en premier */}
      <div
        className={`
          font-bold rounded-full flex items-center justify-center
          ${compact ? 'text-sm px-2 py-0.5' : 'text-lg px-3 py-1'}
          ${animate ? 'animate-pulse' : ''}
        `}
        style={{
          background: 'rgba(0,0,0,0.5)',
          color: '#ffd700',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {formatPotAmount(mainPot)}
      </div>

      {/* Stacks de jetons visuels en dessous */}
      {mainPot > 0 && allChips.length > 0 && (
        <div className={`flex justify-center gap-1 mt-2 ${animate ? 'animate-pot-win' : ''}`}>
          {columns.map((column, colIdx) => (
            <div
              key={colIdx}
              className="relative"
              style={{
                height: `${column.length * chipOffset + chipSize}px`,
                width: `${chipSize}px`,
              }}
            >
              {column.map((chip, chipIdx) => (
                <div
                  key={chipIdx}
                  className="absolute rounded-full"
                  style={{
                    width: `${chipSize}px`,
                    height: `${chipSize}px`,
                    bottom: `${chipIdx * chipOffset}px`,
                    left: 0,
                    zIndex: chipIdx,
                    background: `radial-gradient(circle at 30% 30%, ${chip.innerColor}, ${chip.bgColor})`,
                    border: `2px solid ${chip.borderColor}`,
                    boxShadow: `
                      inset 0 2px 4px rgba(255,255,255,0.2),
                      inset 0 -2px 4px rgba(0,0,0,0.3),
                      0 2px 4px rgba(0,0,0,0.4)
                    `,
                  }}
                >
                  {/* Motif central */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '55%',
                      height: '55%',
                      border: `1px dashed ${chip.borderColor}`,
                      opacity: 0.5,
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {sidePots.map((sidePot, i) => (
            <div
              key={i}
              className={`px-2 py-0.5 rounded-lg ${compact ? 'text-[10px]' : 'text-xs'}`}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-gray-400">Side {i + 1}: </span>
              <span className="text-yellow-400 font-semibold">
                {formatPotAmount(sidePot.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
