interface TurnTimerProps {
  timeRemaining: number;
  totalTime: number;
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSeconds?: boolean;
}

export default function TurnTimer({
  timeRemaining,
  totalTime,
  isActive,
  size = 'md',
  showSeconds = true,
}: TurnTimerProps) {
  if (!isActive) return null;

  const percentage = Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  const state = percentage > 50 ? 'safe' : percentage > 25 ? 'warning' : 'danger';

  return (
    <div
      className={`turn-clock turn-clock--${size} turn-clock--${state}`}
      style={{ '--timer-progress': `${percentage * 3.6}deg` } as React.CSSProperties}
      role="timer"
      aria-label={`${timeRemaining} secondes restantes`}
    >
      <div className="turn-clock__inner">
        {showSeconds && <strong>{timeRemaining}</strong>}
      </div>
    </div>
  );
}
