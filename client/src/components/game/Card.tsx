
interface CardProps {
  suit?: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank?: string;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const sizes = {
  xs: { card: 'w-8 h-11', corner: 'text-[8px]', center: 'text-xl' },
  sm: { card: 'w-11 h-16', corner: 'text-[10px]', center: 'text-2xl' },
  md: { card: 'w-14 h-20', corner: 'text-xs', center: 'text-3xl' },
  lg: { card: 'w-20 h-28', corner: 'text-sm', center: 'text-5xl' },
};

export default function Card({ suit, rank, faceDown = false, size = 'md' }: CardProps) {
  const sizeConfig = sizes[size];

  // Carte face cachée - Style bleu avec logo PM
  if (faceDown || !suit || !rank) {
    return (
      <div
        className={`${sizeConfig.card} rounded-lg shadow-lg overflow-hidden flex-shrink-0`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%)',
          border: '2px solid #2563eb',
        }}
      >
        <div className="w-full h-full p-[3px]">
          <div
            className="w-full h-full rounded-sm flex items-center justify-center"
            style={{
              border: '1px solid rgba(255,255,255,0.3)',
              background: `
                radial-gradient(circle at 50% 50%, rgba(37,99,235,0.3) 0%, transparent 60%),
                repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 3px,
                  rgba(255,255,255,0.05) 3px,
                  rgba(255,255,255,0.05) 6px
                ),
                repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 3px,
                  rgba(255,255,255,0.05) 3px,
                  rgba(255,255,255,0.05) 6px
                )
              `,
            }}
          >
            <div
              className="w-3/4 h-3/4 rounded-sm flex items-center justify-center"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.2) 0%, transparent 70%)',
              }}
            >
              <span
                className="font-bold text-blue-400/80"
                style={{
                  fontSize: size === 'lg' ? '1.25rem' : size === 'md' ? '0.75rem' : '0.5rem',
                  textShadow: '0 0 10px rgba(59,130,246,0.5)'
                }}
              >
                PM
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Carte face visible - Design uniforme avec grand symbole central
  return (
    <div
      className={`${sizeConfig.card} rounded-lg shadow-lg bg-white overflow-hidden flex-shrink-0 relative`}
      style={{ border: '1px solid #d1d5db' }}
    >
      <div className={`h-full w-full ${suitColors[suit]}`}>
        {/* Coin supérieur gauche */}
        <div className={`absolute top-0.5 left-1 flex flex-col items-center leading-tight ${sizeConfig.corner}`}>
          <span className="font-bold">{rank}</span>
          <span className="-mt-0.5">{suitSymbols[suit]}</span>
        </div>

        {/* Coin inférieur droit (inversé) */}
        <div className={`absolute bottom-0.5 right-1 flex flex-col items-center leading-tight rotate-180 ${sizeConfig.corner}`}>
          <span className="font-bold">{rank}</span>
          <span className="-mt-0.5">{suitSymbols[suit]}</span>
        </div>

        {/* Grand symbole central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${sizeConfig.center}`}>{suitSymbols[suit]}</span>
        </div>
      </div>
    </div>
  );
}
