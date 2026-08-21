import { useEffect, useRef, useState } from 'react';
import type { CurrencyState, Player } from 'shared';
import { CONFETTI_COLORS } from '../constants';

interface Props {
  currency: CurrencyState;
  players: Player[];
}

type Moment = { id: number; kind: 'jackpot' | 'bust'; name: string };
const MOMENT_MS = 3200;
let momentId = 0;

function fireJackpotConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  import('canvas-confetti').then(({ default: confetti }) => {
    const base = { colors: CONFETTI_COLORS, ticks: 220, gravity: 1 } as const;
    confetti({ ...base, particleCount: 80, spread: 95, startVelocity: 52, origin: { x: 0.5, y: 0.4 } });
    confetti({ ...base, particleCount: 60, spread: 120, startVelocity: 42, scalar: 0.85, origin: { x: 0.5, y: 0.4 } });
  }).catch(() => { /* confetti is a nice-to-have */ });
}

/**
 * Coin Rush "moments": a jackpot-claim celebration (detected when the jackpot
 * drops from >0 to 0 — the scooper is the seat whose chips jumped most) and a
 * bust-out banner (a seat newly appearing in `eliminated`). Banners queue so two
 * events in one round each get their beat. Mounted only in coinRush.
 */
export function CoinRushMoments({ currency, players }: Props) {
  const prevJackpot = useRef(currency.jackpot);
  const prevEliminated = useRef<string[]>(currency.eliminated);
  const prevChips = useRef<Record<string, number>>(currency.chips);
  const [queue, setQueue] = useState<Moment[]>([]);

  useEffect(() => {
    const next: Moment[] = [];

    // Jackpot scooped: it fell from a positive value to zero.
    if (prevJackpot.current > 0 && currency.jackpot === 0) {
      let claimer = '';
      let bestDelta = 0;
      for (const p of players) {
        const delta = (currency.chips[p.id] ?? 0) - (prevChips.current[p.id] ?? 0);
        if (delta > bestDelta) { bestDelta = delta; claimer = p.name; }
      }
      next.push({ id: ++momentId, kind: 'jackpot', name: claimer });
      fireJackpotConfetti();
    }

    // New eliminations since the last broadcast.
    const prevSet = new Set(prevEliminated.current);
    for (const id of currency.eliminated) {
      if (!prevSet.has(id)) {
        next.push({ id: ++momentId, kind: 'bust', name: players.find(p => p.id === id)?.name ?? 'A player' });
      }
    }

    if (next.length) setQueue(q => [...q, ...next]);
    prevJackpot.current = currency.jackpot;
    prevEliminated.current = currency.eliminated;
    prevChips.current = currency.chips;
  }, [currency, players]);

  // Auto-advance the queue: re-arms only when the visible head changes.
  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    const t = setTimeout(() => setQueue(q => q.slice(1)), MOMENT_MS);
    return () => clearTimeout(t);
  }, [head?.id]);

  if (!head) return null;

  return (
    <div className="cr-moment-overlay" aria-live="polite">
      <div className={`cr-moment cr-moment--${head.kind}`} key={head.id}>
        {head.kind === 'jackpot' ? (
          <>
            <span className="cr-moment__title">Jackpot!</span>
            <span className="cr-moment__sub">
              {head.name ? `${head.name} scooped the jackpot` : 'The jackpot was scooped'}
            </span>
          </>
        ) : (
          <>
            <span className="cr-moment__title">Bust-out</span>
            <span className="cr-moment__sub">{head.name} is out of chips</span>
          </>
        )}
      </div>
    </div>
  );
}
