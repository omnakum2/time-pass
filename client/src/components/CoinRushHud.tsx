import { useEffect, useRef, useState } from 'react';
import type { CurrencyState, Player } from 'shared';
import { JACKPOT_MIN_BID } from 'shared';
import { CoinIcon } from './CurrencyIcon';

interface Props {
  currency: CurrencyState;
  players: Player[];
  playerId: string | null;
}

/**
 * Coin Rush in-game HUD (rendered only when the room has a live currency block).
 * Surfaces the prize pot (Coins), the growing Jackpot (chips, with a grow pulse
 * whenever it rises), and every seat's chip stack — eliminated seats greyed out.
 * The other four modes never mount this, so their HUD is untouched.
 */
export function CoinRushHud({ currency, players, playerId }: Props) {
  const { pool, jackpot, chips, eliminated } = currency;

  // Pulse the jackpot whenever it grows (a missed bid feeds it).
  const prevJackpot = useRef(jackpot);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (jackpot > prevJackpot.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 900);
      prevJackpot.current = jackpot;
      return () => clearTimeout(t);
    }
    prevJackpot.current = jackpot;
  }, [jackpot]);

  const outSet = new Set(eliminated);
  // Show seats in play order; eliminated ones sink to the end.
  const seated = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const ordered = [
    ...seated.filter(p => !outSet.has(p.id)),
    ...seated.filter(p => outSet.has(p.id)),
  ];

  return (
    <div className="cr-hud" aria-label="Coin Rush status">
      <div className="cr-hud__pots">
        <div className="cr-hud__stat cr-hud__stat--pot">
          <span className="cr-hud__label">Pot</span>
          <span className="cr-hud__value">
            <CoinIcon size={16} /> {pool.toLocaleString()}
          </span>
        </div>
        <div className={`cr-hud__stat cr-hud__stat--jackpot${bump ? ' cr-hud__stat--bump' : ''}`}>
          <span className="cr-hud__label">Jackpot</span>
          <span className="cr-hud__value">
            <span className="cr-chip cr-chip--lg" aria-hidden="true" />
            {jackpot.toLocaleString()}
          </span>
          <span className="cr-hud__hint">won by an exact {JACKPOT_MIN_BID}+ bid</span>
        </div>
      </div>

      <div className="cr-hud__players">
        {ordered.map(p => {
          const out = outSet.has(p.id);
          return (
            <div
              key={p.id}
              className={`cr-stack${out ? ' cr-stack--out' : ''}${p.id === playerId ? ' cr-stack--me' : ''}`}
              title={out ? `${p.name} — eliminated` : p.name}
            >
              <span className="cr-stack__name">{p.name}</span>
              <span className="cr-stack__chips">
                <span className="cr-chip" aria-hidden="true" />
                {(chips[p.id] ?? 0).toLocaleString()}
              </span>
              {out && <span className="cr-stack__out">OUT</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
