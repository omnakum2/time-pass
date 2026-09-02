import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Surface } from './Surface';
import { Button } from './Button';
import { fireWinnerConfetti } from '../confetti';

interface GameOverProps {
  icon: ReactNode;
  headline: ReactNode;
  /** Game-specific standings table. */
  standings: ReactNode;
  /** Optional (e.g. BidBaazi full-scoreboard button + modal). */
  extra?: ReactNode;
  isHost: boolean;
  roomClosed: boolean;
  hostChanged?: boolean;
  secsLeft?: number | null;
  onRematch: () => void;
  onLeave: () => void;
  onBackHome: () => void;
}

/** Shared game-over shell used by every game's end screen. */
export function GameOver({
  icon,
  headline,
  standings,
  extra,
  isHost,
  roomClosed,
  hostChanged,
  secsLeft,
  onRematch,
  onLeave,
  onBackHome,
}: GameOverProps) {
  // Winner celebration — an energetic, two-burst confetti pop for EVERYONE at game
  // over (win or lose). Fires once on mount. Skipped for reduced-motion viewers.
  useEffect(() => {
    fireWinnerConfetti();
  }, []);

  return (
    <div className="winner-page-wrap">
      <Surface className="winner-card">
        {icon}

        <h1 className="card-title card-title--lg">{headline}</h1>

        {standings}

        {extra}

        {roomClosed ? (
          <>
            <p className="hint">This game has ended and the room has closed.</p>
            <Button variant="primary" block onClick={onBackHome}>
              Back to Home
            </Button>
          </>
        ) : isHost ? (
          <>
            {hostChanged && (
              <p className="hint">The previous host left, so you're the host now.</p>
            )}
            {secsLeft != null && (
              <p className="tag-faint" style={{ margin: 0 }}>Room closes in {secsLeft}s</p>
            )}
            <Button variant="primary" block onClick={onRematch}>
              Play Again
            </Button>
            <Button variant="secondary" block onClick={onLeave}>
              Leave
            </Button>
          </>
        ) : (
          <>
            <p className="hint">Waiting for the host to start a rematch…</p>
            <Button variant="secondary" block onClick={onLeave}>
              Leave
            </Button>
          </>
        )}
      </Surface>
    </div>
  );
}
