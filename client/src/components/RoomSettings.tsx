import { useEffect, useState } from 'react';
import {
  GAME_MODES, GameMode,
  MIN_BET, BET_MULTIPLE, STARTING_CHIP_PRESETS,
  isValidBet, tableFee, buyInTotal,
} from 'shared';
import { CoinIcon } from './CurrencyIcon';

interface Props {
  maxPlayers: number;
  minPlayers: number;            // Home: 2, Lobby: max(2, seated)
  mode: GameMode;
  onCommitMaxPlayers: (n: number) => void; // Home: setMaxPlayers, Lobby: send updateRoomSettings
  onSelectMode: (m: GameMode) => void;
  // ── Coin Rush extras (shown only when mode === 'coinRush') ──
  betAmount?: number;
  startingChips?: number;
  onCommitBetAmount?: (n: number) => void;
  onCommitStartingChips?: (n: number) => void;
  coinBalance?: number | null;   // host's wallet, for a buy-in shortfall hint
}

/** Shared create/lobby room-settings: 2–7 player slider (commit-on-release) + mode
 *  picker, plus the Coin Rush buy-in controls (bet, starting chips, buy-in preview). */
export function RoomSettings({
  maxPlayers, minPlayers, mode, onCommitMaxPlayers, onSelectMode,
  betAmount = MIN_BET, startingChips = STARTING_CHIP_PRESETS[0],
  onCommitBetAmount, onCommitStartingChips, coinBalance,
}: Props) {
  const [drag, setDrag] = useState(maxPlayers);
  useEffect(() => { setDrag(maxPlayers); }, [maxPlayers]);
  const commit = (n: number) => {
    const v = Math.max(minPlayers, Math.min(7, n));
    setDrag(v);
    onCommitMaxPlayers(v);
  };

  const betValid = isValidBet(betAmount);
  const total = buyInTotal(betAmount);
  const short = coinBalance != null && betValid && coinBalance < total;

  return (
    <div className="flex-col gap-lg">
      <div className="flex-col gap-sm">
        <label className="field-label">Number of players ({minPlayers}-7)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={minPlayers} max={7} step={1}
            value={drag}
            onChange={e => setDrag(Number(e.target.value))}
            onMouseUp={e => commit(Number((e.target as HTMLInputElement).value))}
            onKeyUp={e => commit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={e => commit(Number((e.target as HTMLInputElement).value))}
            style={{ flex: 1, accentColor: 'var(--gold)' }}
          />
          <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', color: 'var(--gold)' }}>{drag}</span>
        </div>
      </div>
      <div className="flex-col gap-sm">
        <label className="field-label">Game mode</label>
        <div className="mode-picker">
          {GAME_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`mode-option${mode === m.id ? ' mode-option--active' : ''}`}
              onClick={() => onSelectMode(m.id)}
            >
              <span className="mode-option__label">{m.label}</span>
              <span className="mode-option__desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'coinRush' && (
        <div className="coinrush-setup flex-col gap-lg">
          {/* Buy-in bet (Gold Coins) */}
          <div className="flex-col gap-sm">
            <label className="field-label">
              Buy-in bet <span className="coinrush-unit"><CoinIcon size={13} /> Gold Coins</span>
            </label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={MIN_BET}
              step={BET_MULTIPLE}
              value={Number.isFinite(betAmount) ? betAmount : ''}
              onChange={e => onCommitBetAmount?.(Math.floor(Number(e.target.value)))}
              aria-invalid={!betValid}
            />
            {!betValid && (
              <span className="coinrush-error">
                Bet must be at least {MIN_BET.toLocaleString()} and a multiple of {BET_MULTIPLE}.
              </span>
            )}
          </div>

          {/* Starting chips presets */}
          <div className="flex-col gap-sm">
            <label className="field-label">Starting chips</label>
            <div className="chip-presets" role="group" aria-label="Starting chips">
              {STARTING_CHIP_PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`chip-preset${startingChips === p ? ' chip-preset--active' : ''}`}
                  onClick={() => onCommitStartingChips?.(p)}
                  aria-pressed={startingChips === p}
                >
                  <span className="cr-chip" aria-hidden="true" />
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Live buy-in + fee preview (poker-style) */}
          {betValid && (
            <div className="buyin-preview">
              <span className="buyin-preview__label">Buy-in + fee</span>
              <span className="buyin-preview__value">
                <CoinIcon size={16} /> {betAmount.toLocaleString()}
                <span className="buyin-preview__plus">+ {tableFee(betAmount).toLocaleString()}</span>
                <span className="buyin-preview__eq">=</span>
                <CoinIcon size={16} /> {total.toLocaleString()}
              </span>
            </div>
          )}

          {short && (
            <p className="coinrush-shortfall">
              You need <CoinIcon size={14} /> {(total - (coinBalance ?? 0)).toLocaleString()} more coins to host this table.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
