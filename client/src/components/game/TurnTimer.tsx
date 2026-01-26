import { useEffect, useState } from 'react';

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
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
  }, [timeRemaining]);

  // Calculer le pourcentage restant
  const percentage = Math.max(0, Math.min(100, (displayTime / totalTime) * 100));

  // Couleur basée sur le temps restant
  const getColor = () => {
    if (percentage > 50) return '#22c55e'; // vert
    if (percentage > 25) return '#eab308'; // jaune
    return '#ef4444'; // rouge
  };

  // Tailles
  const sizes = {
    sm: { width: 40, stroke: 3, fontSize: '10px' },
    md: { width: 50, stroke: 4, fontSize: '12px' },
    lg: { width: 60, stroke: 5, fontSize: '14px' },
  };

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  if (!isActive) return null;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={width}
        height={width}
        className={`transform -rotate-90 ${percentage <= 25 ? 'animate-pulse' : ''}`}
      >
        {/* Cercle de fond */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="rgba(0,0,0,0.5)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={stroke}
        />
        {/* Cercle de progression */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="transparent"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
          }}
        />
      </svg>
      {showSeconds && (
        <span
          className="absolute font-bold text-white"
          style={{ fontSize }}
        >
          {displayTime}
        </span>
      )}
    </div>
  );
}
