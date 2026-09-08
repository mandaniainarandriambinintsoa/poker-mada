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

const suitLabels = {
  hearts: 'cœur',
  diamonds: 'carreau',
  clubs: 'trèfle',
  spades: 'pique',
};

const rankLabels: Record<string, string> = {
  A: 'As',
  K: 'Roi',
  Q: 'Dame',
  J: 'Valet',
  T: 'Dix',
  '10': 'Dix',
};

export default function Card({ suit, rank, faceDown = false, size = 'md' }: CardProps) {
  if (faceDown || !suit || !rank) {
    return (
      <div className={`poker-card poker-card--${size} poker-card--back`} aria-label="Carte face cachée">
        <div className="poker-card__back-pattern">
          <span>PM</span>
          <i aria-hidden="true">♠</i>
        </div>
      </div>
    );
  }

  const symbol = suitSymbols[suit];
  const label = `${rankLabels[rank] ?? rank} de ${suitLabels[suit]}`;

  return (
    <div className={`poker-card poker-card--${size} poker-card--${suit}`} aria-label={label}>
      <div className="poker-card__corner poker-card__corner--top">
        <strong>{rank}</strong>
        <span>{symbol}</span>
      </div>
      <span className="poker-card__pip" aria-hidden="true">{symbol}</span>
      <div className="poker-card__corner poker-card__corner--bottom" aria-hidden="true">
        <strong>{rank}</strong>
        <span>{symbol}</span>
      </div>
    </div>
  );
}
