import { useState } from 'react';

type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

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

function formatAriary(amount: number, short?: boolean): string {
  if (short) {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'k';
    }
    return amount.toString();
  }
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
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
  const callAmount = currentBet - myCurrentBet;

  const canCheck = availableActions.includes('check');
  const canCall = availableActions.includes('call');
  const canRaise = availableActions.includes('raise');

  const raisePresets = [
    { label: '1/2', amount: Math.floor(pot / 2) },
    { label: '3/4', amount: Math.floor(pot * 0.75) },
    { label: 'Pot', amount: pot },
  ];

  // Mode compact pour mobile
  if (compact) {
    return (
      <div className="w-full max-w-md">
        {/* Panneau de raise (si ouvert) */}
        {showRaisePanel && canRaise && (
          <div className="bg-gray-800 rounded-t-xl p-3 border-b border-gray-700">
            <div className="flex gap-1 mb-2">
              {raisePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRaiseAmount(Math.min(preset.amount, myStack))}
                  disabled={preset.amount > myStack}
                  className="btn btn-secondary text-xs px-2 py-1 flex-1"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={minRaise}
              max={myStack}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-poker-gold text-sm mt-1">
              {formatAriary(raiseAmount)}
            </div>
          </div>
        )}

        {/* Boutons d'action principaux */}
        <div className="bg-gray-800 rounded-xl p-2 flex gap-2">
          {/* Fold */}
          <button
            onClick={() => onAction('fold')}
            className="btn bg-red-600 hover:bg-red-500 text-white px-3 py-2 text-sm flex-1"
          >
            Fold
          </button>

          {/* Check ou Call */}
          {canCheck ? (
            <button
              onClick={() => onAction('check')}
              className="btn bg-green-600 hover:bg-green-500 text-white px-3 py-2 text-sm flex-1"
            >
              Check
            </button>
          ) : canCall ? (
            <button
              onClick={() => onAction('call')}
              className="btn bg-green-600 hover:bg-green-500 text-white px-3 py-2 text-sm flex-1"
            >
              Call {formatAriary(callAmount, true)}
            </button>
          ) : (
            <div className="flex-1" />
          )}

          {/* Raise toggle / confirm */}
          {canRaise && (
            showRaisePanel ? (
              <button
                onClick={() => {
                  onAction('raise', raiseAmount);
                  setShowRaisePanel(false);
                }}
                className="btn bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 text-sm flex-1"
              >
                Raise {formatAriary(raiseAmount, true)}
              </button>
            ) : (
              <button
                onClick={() => setShowRaisePanel(true)}
                className="btn bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 text-sm flex-1"
              >
                Raise
              </button>
            )
          )}

          {/* All-In */}
          <button
            onClick={() => onAction('all-in')}
            className="btn bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 text-sm flex-1"
          >
            All-In
          </button>
        </div>
      </div>
    );
  }

  // Mode desktop
  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap gap-3 justify-center">
        {/* Fold */}
        <button
          onClick={() => onAction('fold')}
          className="btn bg-red-600 hover:bg-red-500 text-white px-6 py-3"
        >
          Fold
        </button>

        {/* Check ou Call */}
        {canCheck ? (
          <button
            onClick={() => onAction('check')}
            className="btn bg-green-600 hover:bg-green-500 text-white px-6 py-3"
          >
            Check
          </button>
        ) : canCall ? (
          <button
            onClick={() => onAction('call')}
            className="btn bg-green-600 hover:bg-green-500 text-white px-6 py-3"
          >
            Call {formatAriary(callAmount)}
          </button>
        ) : null}

        {/* Raise */}
        {canRaise && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                {raisePresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setRaiseAmount(Math.min(preset.amount, myStack))}
                    disabled={preset.amount > myStack}
                    className="btn btn-secondary text-xs px-2 py-1"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={minRaise}
                max={myStack}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <button
              onClick={() => onAction('raise', raiseAmount)}
              className="btn bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3"
            >
              Raise {formatAriary(raiseAmount)}
            </button>
          </div>
        )}

        {/* All-In */}
        <button
          onClick={() => onAction('all-in')}
          className="btn bg-purple-600 hover:bg-purple-500 text-white px-6 py-3"
        >
          All-In ({formatAriary(myStack)})
        </button>
      </div>
    </div>
  );
}
