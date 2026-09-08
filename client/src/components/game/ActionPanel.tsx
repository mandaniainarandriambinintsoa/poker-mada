import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

interface ActionPanelProps {
  availableActions: PlayerAction[];
  currentBet: number;
  myCurrentBet: number;
  myStack: number;
  minRaise: number;
  pot: number;
  onAction: (action: PlayerAction, amount?: number) => void;
  compact?: boolean;
}

function formatAriary(amount: number, short = false): string {
  if (short && amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (short && amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return `${new Intl.NumberFormat('fr-MG').format(amount)}${short ? '' : ' Ar'}`;
}

export default function ActionPanel({
  availableActions,
  currentBet,
  myCurrentBet,
  myStack,
  minRaise,
  pot,
  onAction,
  compact = false,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  const [confirmAllIn, setConfirmAllIn] = useState(false);
  const lastActionTime = useRef(0);

  const callAmount = Math.max(0, currentBet - myCurrentBet);
  const canCheck = availableActions.includes('check');
  const canCall = availableActions.includes('call');
  const canRaise = availableActions.includes('raise') && myStack >= minRaise;
  const sliderMax = Math.max(minRaise, myStack);

  useEffect(() => {
    setRaiseAmount((amount) => Math.min(Math.max(amount, minRaise), sliderMax));
  }, [minRaise, sliderMax]);

  const raisePresets = useMemo(() => [
    { label: '½ pot', amount: Math.max(minRaise, Math.floor(pot / 2)) },
    { label: '¾ pot', amount: Math.max(minRaise, Math.floor(pot * 0.75)) },
    { label: 'Pot', amount: Math.max(minRaise, pot) },
  ], [minRaise, pot]);

  const handleAction = useCallback((action: PlayerAction, amount?: number) => {
    const now = Date.now();
    if (now - lastActionTime.current < 350) return;
    lastActionTime.current = now;
    setConfirmAllIn(false);
    onAction(action, amount);
  }, [onAction]);

  const selectPreset = (amount: number) => {
    setRaiseAmount(Math.min(amount, myStack));
  };

  return (
    <section className={`action-dock ${compact ? 'action-dock--compact' : ''}`} aria-label="Actions de jeu">
      <div className="action-dock__turn">
        <span className="action-dock__pulse" aria-hidden="true" />
        <div>
          <span className="action-dock__eyebrow">À vous de jouer</span>
          <strong>{canCheck ? 'Vous pouvez checker' : `${formatAriary(callAmount)} à suivre`}</strong>
        </div>
      </div>

      {showRaisePanel && canRaise && (
        <div className="raise-builder">
          <div className="raise-builder__header">
            <span>Montant de la relance</span>
            <strong>{formatAriary(raiseAmount)}</strong>
          </div>
          <input
            aria-label="Montant de la relance"
            type="range"
            min={minRaise}
            max={sliderMax}
            step={Math.max(1, Math.round(minRaise / 2))}
            value={raiseAmount}
            onChange={(event) => setRaiseAmount(Number(event.target.value))}
          />
          <div className="raise-builder__presets">
            {raisePresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => selectPreset(preset.amount)}
                disabled={preset.amount > myStack}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="action-dock__buttons">
        <button type="button" className="game-action game-action--fold" onClick={() => handleAction('fold')}>
          <span>Se coucher</span>
          <small>Fold</small>
        </button>

        {canCheck ? (
          <button type="button" className="game-action game-action--primary" onClick={() => handleAction('check')}>
            <span>Checker</span>
            <small>0 Ar</small>
          </button>
        ) : canCall ? (
          <button type="button" className="game-action game-action--primary" onClick={() => handleAction('call')}>
            <span>Suivre</span>
            <small>{formatAriary(callAmount, true)} Ar</small>
          </button>
        ) : null}

        {canRaise && (
          <button
            type="button"
            className={`game-action game-action--raise ${showRaisePanel ? 'is-open' : ''}`}
            aria-expanded={showRaisePanel}
            onClick={() => {
              if (showRaisePanel) handleAction('raise', raiseAmount);
              else setShowRaisePanel(true);
            }}
          >
            <span>{showRaisePanel ? 'Confirmer' : 'Relancer'}</span>
            <small>{showRaisePanel ? `${formatAriary(raiseAmount, true)} Ar` : `min. ${formatAriary(minRaise, true)}`}</small>
          </button>
        )}

        <button
          type="button"
          className={`game-action game-action--all-in ${confirmAllIn ? 'is-armed' : ''}`}
          onClick={() => confirmAllIn ? handleAction('all-in') : setConfirmAllIn(true)}
          onBlur={() => setConfirmAllIn(false)}
        >
          <span>{confirmAllIn ? 'Confirmer tapis' : 'Tapis'}</span>
          <small>{formatAriary(myStack, true)} Ar</small>
        </button>
      </div>
    </section>
  );
}
