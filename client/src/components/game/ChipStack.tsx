import { useMemo } from 'react';

interface ChipStackProps {
  amount: number;
  maxChips?: number;
  size?: 'sm' | 'md' | 'lg';
  showAmount?: boolean;
  animate?: boolean;
}

// Définition des valeurs et couleurs des jetons - design amélioré
const CHIP_VALUES = [
  { value: 10000, bgColor: '#1a1a2e', borderColor: '#4a4a6a', innerColor: '#2d2d4a', label: '10k' },
  { value: 5000, bgColor: '#1e3a5f', borderColor: '#3d7ab8', innerColor: '#2a5080', label: '5k' },
  { value: 1000, bgColor: '#1a4d2e', borderColor: '#2ecc71', innerColor: '#27693d', label: '1k' },
  { value: 500, bgColor: '#8b0000', borderColor: '#ff4444', innerColor: '#a52a2a', label: '500' },
  { value: 100, bgColor: '#f5f5f5', borderColor: '#999999', innerColor: '#e0e0e0', label: '100' },
];

const SIZES = {
  sm: { chip: 18, offset: 3, fontSize: 7, border: 2 },
  md: { chip: 24, offset: 4, fontSize: 9, border: 2 },
  lg: { chip: 32, offset: 5, fontSize: 11, border: 3 },
};

interface ChipDisplay {
  bgColor: string;
  borderColor: string;
  innerColor: string;
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
        bgColor: chipDef.bgColor,
        borderColor: chipDef.borderColor,
        innerColor: chipDef.innerColor,
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
  const allChips: { bgColor: string; borderColor: string; innerColor: string; index: number }[] = [];
  let chipIndex = 0;
  for (const chip of chips) {
    for (let i = 0; i < chip.count; i++) {
      allChips.push({
        bgColor: chip.bgColor,
        borderColor: chip.borderColor,
        innerColor: chip.innerColor,
        index: chipIndex++,
      });
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Stack de jetons */}
      <div className="relative" style={{ height: `${allChips.length * sizeConfig.offset + sizeConfig.chip}px`, width: `${sizeConfig.chip}px` }}>
        {allChips.map((chip, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${animate ? 'animate-chip-stack' : ''}`}
            style={{
              width: `${sizeConfig.chip}px`,
              height: `${sizeConfig.chip}px`,
              bottom: `${i * sizeConfig.offset}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: i,
              background: `radial-gradient(circle at 30% 30%, ${chip.innerColor}, ${chip.bgColor})`,
              border: `${sizeConfig.border}px solid ${chip.borderColor}`,
              boxShadow: `
                inset 0 2px 4px rgba(255,255,255,0.2),
                inset 0 -2px 4px rgba(0,0,0,0.3),
                0 2px 4px rgba(0,0,0,0.4)
              `,
              animationDelay: animate ? `${i * 50}ms` : undefined,
            }}
          >
            {/* Motif central du jeton */}
            <div
              className="absolute rounded-full"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '60%',
                border: `1px dashed ${chip.borderColor}`,
                opacity: 0.6,
              }}
            />
          </div>
        ))}
      </div>

      {/* Montant affiché */}
      {showAmount && (
        <div
          className="font-bold whitespace-nowrap text-center mt-1"
          style={{
            fontSize: `${sizeConfig.fontSize}px`,
            color: '#ffd700',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
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
