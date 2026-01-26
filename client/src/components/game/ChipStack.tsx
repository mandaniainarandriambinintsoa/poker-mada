import { useMemo } from 'react';

interface ChipStackProps {
  amount: number;
  maxChips?: number;
  size?: 'sm' | 'md' | 'lg';
  showAmount?: boolean;
  animate?: boolean;
}

// Définition des valeurs et couleurs des jetons
const CHIP_VALUES = [
  { value: 10000, color: 'bg-gray-900 border-gray-600', label: '10k' },
  { value: 5000, color: 'bg-blue-700 border-blue-400', label: '5k' },
  { value: 1000, color: 'bg-green-600 border-green-400', label: '1k' },
  { value: 500, color: 'bg-red-600 border-red-400', label: '500' },
  { value: 100, color: 'bg-white border-gray-300 text-gray-800', label: '100' },
];

const SIZES = {
  sm: { chip: 'w-5 h-5', offset: 2, fontSize: 'text-[6px]' },
  md: { chip: 'w-7 h-7', offset: 3, fontSize: 'text-[8px]' },
  lg: { chip: 'w-10 h-10', offset: 4, fontSize: 'text-xs' },
};

interface ChipDisplay {
  color: string;
  count: number;
  value: number;
}

function calculateChips(amount: number, maxChips: number): ChipDisplay[] {
  const chips: ChipDisplay[] = [];
  let remaining = amount;

  for (const chipDef of CHIP_VALUES) {
    if (remaining >= chipDef.value) {
      const count = Math.floor(remaining / chipDef.value);
      chips.push({
        color: chipDef.color,
        count: Math.min(count, maxChips),
        value: chipDef.value,
      });
      remaining = remaining % chipDef.value;
    }
  }

  // Limiter le nombre total de jetons affichés
  let totalChips = 0;
  const limitedChips: ChipDisplay[] = [];

  for (const chip of chips) {
    if (totalChips >= maxChips) break;
    const allowedCount = Math.min(chip.count, maxChips - totalChips);
    if (allowedCount > 0) {
      limitedChips.push({ ...chip, count: allowedCount });
      totalChips += allowedCount;
    }
  }

  return limitedChips;
}

export default function ChipStack({
  amount,
  maxChips = 8,
  size = 'md',
  showAmount = true,
  animate = false,
}: ChipStackProps) {
  const sizeConfig = SIZES[size];
  const chips = useMemo(() => calculateChips(amount, maxChips), [amount, maxChips]);

  if (amount <= 0) return null;

  // Créer un tableau plat de tous les jetons individuels
  const allChips: { color: string; index: number }[] = [];
  let chipIndex = 0;
  for (const chip of chips) {
    for (let i = 0; i < chip.count; i++) {
      allChips.push({ color: chip.color, index: chipIndex++ });
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Stack de jetons */}
      <div className="relative" style={{ height: `${allChips.length * sizeConfig.offset + 20}px` }}>
        {allChips.map((chip, i) => (
          <div
            key={i}
            className={`
              absolute ${sizeConfig.chip} rounded-full border-2 border-dashed
              ${chip.color}
              shadow-md
              ${animate ? 'animate-chip-stack' : ''}
            `}
            style={{
              bottom: `${i * sizeConfig.offset}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: i,
              animationDelay: animate ? `${i * 50}ms` : undefined,
            }}
          />
        ))}
      </div>

      {/* Montant affiché */}
      {showAmount && (
        <div className={`text-poker-gold font-bold ${sizeConfig.fontSize} mt-1 whitespace-nowrap`}>
          {formatAmount(amount)}
        </div>
      )}
    </div>
  );
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'k';
  }
  return amount.toString();
}
