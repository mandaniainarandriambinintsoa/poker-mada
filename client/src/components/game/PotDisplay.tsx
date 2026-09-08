interface PotDisplayProps {
  mainPot: number;
  sidePots?: { amount: number; eligiblePlayers: string[] }[];
  compact?: boolean;
  animate?: boolean;
}

function formatPotAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M Ar`;
  return `${new Intl.NumberFormat('fr-MG').format(amount)} Ar`;
}

export default function PotDisplay({
  mainPot,
  sidePots = [],
  compact = false,
  animate = false,
}: PotDisplayProps) {
  return (
    <div className={`table-pot ${compact ? 'table-pot--compact' : ''} ${animate ? 'is-winning' : ''}`}>
      <div className="table-pot__chips" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="table-pot__amount">
        <span>Pot total</span>
        <strong>{formatPotAmount(mainPot)}</strong>
      </div>
      {sidePots.length > 0 && (
        <div className="table-pot__sides">
          {sidePots.map((sidePot, index) => (
            <span key={index}>Side pot {index + 1} · {formatPotAmount(sidePot.amount)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
