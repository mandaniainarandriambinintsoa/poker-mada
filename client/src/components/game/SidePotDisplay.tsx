
interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}

interface SidePotDisplayProps {
  sidePots: SidePot[];
  playerNames: Map<string, string>;
  compact?: boolean;
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

// Couleurs pour différencier les side pots
const SIDE_POT_COLORS = [
  'bg-blue-900/60 border-blue-500',
  'bg-purple-900/60 border-purple-500',
  'bg-orange-900/60 border-orange-500',
  'bg-pink-900/60 border-pink-500',
];

export default function SidePotDisplay({
  sidePots,
  playerNames,
  compact = false,
}: SidePotDisplayProps) {
  if (sidePots.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 justify-center ${compact ? 'mt-1' : 'mt-3'}`}>
      {sidePots.map((pot, index) => {
        const colorClass = SIDE_POT_COLORS[index % SIDE_POT_COLORS.length];
        const eligibleNames = pot.eligiblePlayers
          .map(id => playerNames.get(id) || 'Joueur')
          .slice(0, 3); // Max 3 noms affichés

        return (
          <div
            key={index}
            className={`
              ${colorClass}
              border rounded-lg px-2 py-1
              ${compact ? 'text-xs' : 'text-sm'}
            `}
          >
            <div className="flex items-center gap-2">
              {/* Badge du pot */}
              <span className="bg-white/20 rounded px-1 text-[10px] font-bold">
                S{index + 1}
              </span>

              {/* Montant */}
              <span className="text-poker-gold font-bold">
                {formatAmount(pot.amount)} Ar
              </span>
            </div>

            {/* Joueurs éligibles (visible uniquement sur desktop) */}
            {!compact && eligibleNames.length > 0 && (
              <div className="text-gray-300 text-[10px] mt-1 truncate max-w-[150px]">
                {eligibleNames.join(', ')}
                {pot.eligiblePlayers.length > 3 && ` +${pot.eligiblePlayers.length - 3}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
