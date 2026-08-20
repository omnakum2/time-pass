import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SPIN_SEGMENTS } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendSpin } from '../net/socket';
import { Modal } from './Modal';
import { Button } from './Button';
import { CoinIcon, GemIcon } from './CurrencyIcon';

// Visual clockwise order of the 8 segments around the wheel (position i shows
// SPIN_SEGMENTS[WHEEL_ORDER[i]]). Wedges alternate two golds strictly by
// position parity; gem wedges are marked by a gem glyph, not by fill colour.
// Reads at 12 o'clock clockwise: gem5 · 100 · 50 · 20 · gem1 · 80 · 30 · 10.
const WHEEL_ORDER = [7, 5, 3, 1, 6, 4, 2, 0];

// ─── Static wheel geometry (SVG 200×200 viewBox) ─────────────────────────────
const CENTER = 100;
const RADIUS = 96;
const LABEL_RADIUS = 62;
const WEDGE_DEG = 360 / WHEEL_ORDER.length; // 45°
const FULL_TURNS = 5; // whole rotations before landing, for drama

// Point on the wheel at `angleDeg` (clockwise from 12 o'clock) and `radius`.
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(a), y: CENTER - radius * Math.cos(a) };
}

// Precomputed wedge path + label for each visual position (module-level: static).
// Fill colour is decided at render time by position parity (two alternating
// golds); gem wedges carry an `isGem` flag so a gem glyph can mark them.
const WEDGES = WHEEL_ORDER.map((segIndex, i) => {
  const center = i * WEDGE_DEG;
  const p0 = polar(center - WEDGE_DEG / 2, RADIUS);
  const p1 = polar(center + WEDGE_DEG / 2, RADIUS);
  const path =
    `M ${CENTER} ${CENTER} ` +
    `L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` +
    `A ${RADIUS} ${RADIUS} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
  const label = polar(center, LABEL_RADIUS);
  const prize = SPIN_SEGMENTS[segIndex].prize;
  const isGem = prize.gems > 0;
  const text = isGem ? `${Math.round(prize.gems)}` : `${Math.round(prize.coins)}`;
  return { path, labelX: label.x, labelY: label.y, text, isGem };
});

// Confetti draws onto its own full-screen canvas layered ABOVE the modal (the
// library's default canvas sits below the modal overlay). Created once, reused.
let confettiFn: ReturnType<typeof confetti.create> | null = null;
function getConfetti(): ReturnType<typeof confetti.create> {
  if (confettiFn) return confettiFn;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1200;';
  document.body.appendChild(canvas);
  confettiFn = confetti.create(canvas, { resize: true, useWorker: true });
  return confettiFn;
}

// Burst on a prize reveal — a small gold pop for coins, a bigger emerald+gold
// celebration (with side cannons) when the spin lands on Gems.
function fireConfetti(gemWin: boolean): void {
  const fire = getConfetti();
  const goldColors = ['#F5CE6A', '#E9B84A', '#C08A2E', '#F3ECDD'];
  const gemColors = ['#5FD07A', '#2FA968', '#E9B84A', '#F3ECDD'];
  const colors = gemWin ? gemColors : goldColors;
  fire({
    particleCount: gemWin ? 150 : 70,
    spread: gemWin ? 100 : 70,
    startVelocity: gemWin ? 55 : 42,
    scalar: gemWin ? 1.15 : 0.9,
    ticks: 200,
    origin: { y: 0.62 },
    colors,
  });
  if (gemWin) {
    window.setTimeout(
      () => fire({ particleCount: 80, angle: 60, spread: 75, startVelocity: 50, origin: { x: 0, y: 0.7 }, colors }),
      130,
    );
    window.setTimeout(
      () => fire({ particleCount: 80, angle: 120, spread: 75, startVelocity: 50, origin: { x: 1, y: 0.7 }, colors }),
      260,
    );
  }
}

// Human text for the next spin's cost.
function costLabel(nextSpinCost: number | null): string {
  if (nextSpinCost === null) return 'No spins left today';
  if (nextSpinCost === 0) return 'Free spin';
  return `${nextSpinCost} coins`;
}

// Smallest rotation ≥ current that lands `visualPos` centred under the top
// pointer, plus FULL_TURNS extra whole turns so the wheel always spins forward.
// A wedge at position p sits at angle p*45° clockwise from the top; rotating the
// disc by R brings it to the pointer when R ≡ -p*45° (mod 360).
function computeTarget(current: number, visualPos: number): number {
  const targetMod = ((-visualPos * WEDGE_DEG) % 360 + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360; // forward distance to alignment (0..359)
  delta += 360 * FULL_TURNS;   // add the dramatic whole turns
  return current + delta;
}

/** Lucky Spin modal: a spinning octagon wheel that the server's result lands. */
export function LuckySpinModal({ onClose }: { onClose: () => void }) {
  const rewards = useGameStore((s) => s.rewards);
  const lastSpin = useGameStore((s) => s.lastSpin);
  const error = useGameStore((s) => s.error);
  const setLastSpin = useGameStore((s) => s.setLastSpin);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const awaitingRef = useRef(false);            // true after sendSpin, until a result/error/timeout
  const timeoutRef = useRef<number | null>(null);
  const confettiFiredRef = useRef(false);       // guards one confetti burst per revealed prize

  const nextSpinCost = rewards?.nextSpinCost ?? null;
  const canSpin = nextSpinCost !== null && !spinning;

  const clearFallback = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Fresh wheel on open: drop any prior result so no stale prize/position shows.
  useEffect(() => {
    setLastSpin(null);
    return clearFallback; // also clear the fallback timer on unmount
  }, [setLastSpin]);

  // A result arrived for the spin we started → animate the disc to that wedge.
  useEffect(() => {
    if (!lastSpin || !awaitingRef.current) return;
    awaitingRef.current = false;
    clearFallback();
    let visualPos = WHEEL_ORDER.indexOf(lastSpin.segmentIndex);
    if (visualPos < 0) visualPos = 0; // defensive: unknown index → first wedge
    setRotation((prev) => computeTarget(prev, visualPos));
  }, [lastSpin]);

  // Server rejected the spin (NO_SPINS_LEFT / INSUFFICIENT_COINS): no result will
  // come — the store surfaces the error toast, so just unstick the wheel.
  useEffect(() => {
    if (error && awaitingRef.current) {
      awaitingRef.current = false;
      clearFallback();
      setSpinning(false);
    }
  }, [error]);

  // Prize revealed (wheel stopped with a result) → fire a one-shot confetti burst,
  // a bigger one for a Gem win. Re-arms once the reveal clears (next spin).
  useEffect(() => {
    const revealed = !spinning && lastSpin !== null;
    if (revealed && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      fireConfetti(lastSpin.gems > 0);
    } else if (!revealed) {
      confettiFiredRef.current = false;
    }
  }, [spinning, lastSpin]);

  const handleSpin = async () => {
    if (spinning || nextSpinCost === null) return;
    setSpinning(true);
    setLastSpin(null);
    awaitingRef.current = true;
    // Safety net: if neither a result nor an error lands, release the button.
    timeoutRef.current = window.setTimeout(() => {
      if (awaitingRef.current) {
        awaitingRef.current = false;
        setSpinning(false);
      }
    }, 6000);
    try {
      await sendSpin();
    } catch {
      awaitingRef.current = false;
      clearFallback();
      setSpinning(false);
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform') return;
    setSpinning(false);
  };

  const showPrize = !spinning && lastSpin !== null;
  // Visual position of the wedge the wheel landed on — emphasised once at rest.
  const winPos = showPrize ? WHEEL_ORDER.indexOf(lastSpin.segmentIndex) : -1;

  return (
    <Modal open title="Lucky Spin" onClose={onClose}>
      <div className="spin-wheel">
        <div className="spin-wheel__pointer" aria-hidden />
        <div
          className="spin-wheel__disc"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.16, 1)' : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <svg viewBox="0 0 200 200" className="spin-wheel__svg" aria-hidden>
            {WEDGES.map((w, i) => (
              <path
                key={`w${i}`}
                d={w.path}
                className={
                  `spin-wheel__wedge spin-wheel__wedge--${i % 2 === 0 ? 'a' : 'b'}` +
                  (i === winPos ? ' spin-wheel__wedge--win' : '')
                }
              />
            ))}
            <circle cx={CENTER} cy={CENTER} r={RADIUS} className="spin-wheel__rim" />
            {WEDGES.map((w, i) => (
              <g key={`t${i}`}>
                {w.isGem && (
                  <use
                    href="#bc-gem"
                    x={w.labelX - 8}
                    y={w.labelY - 27}
                    width="16"
                    height="16"
                  />
                )}
                <text
                  x={w.labelX}
                  y={w.labelY}
                  className="spin-wheel__label"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {w.text}
                </text>
              </g>
            ))}
            <circle cx={CENTER} cy={CENTER} r={13} className="spin-wheel__hub" />
          </svg>
        </div>
      </div>

      <p className="reward-cost">{costLabel(nextSpinCost)}</p>

      <Button variant="primary" size="sm" onClick={() => void handleSpin()} disabled={!canSpin}>
        {spinning ? 'Spinning…' : 'Spin'}
      </Button>

      {showPrize && (
        <p className="reward-toast">
          You won {lastSpin.coins > 0 && <><CoinIcon size={15} /> {Math.round(lastSpin.coins)}</>}
          {lastSpin.coins > 0 && lastSpin.gems > 0 && ' / '}
          {lastSpin.gems > 0 && <><GemIcon size={15} /> {Math.round(lastSpin.gems)}</>}!
        </p>
      )}
    </Modal>
  );
}
