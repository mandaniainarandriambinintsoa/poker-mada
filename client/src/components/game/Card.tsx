import React from 'react';

interface CardProps {
  suit?: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank?: string;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-base',
};

export default function Card({ suit, rank, faceDown = false, size = 'md' }: CardProps) {
  if (faceDown || !suit || !rank) {
    return (
      <div
        className={`${sizes[size]} rounded-lg shadow-lg playing-card face-down flex items-center justify-center`}
      >
        <div className="w-3/4 h-3/4 border-2 border-blue-300 rounded opacity-50" />
      </div>
    );
  }

  return (
    <div className={`${sizes[size]} rounded-lg shadow-lg playing-card bg-white p-1`}>
      <div className={`h-full flex flex-col ${suitColors[suit]}`}>
        <div className="flex justify-between items-start">
          <span className="font-bold">{rank}</span>
          <span>{suitSymbols[suit]}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-3xl">
          {suitSymbols[suit]}
        </div>
        <div className="flex justify-between items-end rotate-180">
          <span className="font-bold">{rank}</span>
          <span>{suitSymbols[suit]}</span>
        </div>
      </div>
    </div>
  );
}
