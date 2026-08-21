import { useEffect } from 'react';
import type { LeaderboardEntry } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendGetLeaderboard } from '../net/socket';
import { Modal } from './Modal';
import { CoinIcon } from './CurrencyIcon';

// Turn an IST ISO-week key ('2026-W34') into a friendly label. Falls back to the
// raw key for any unexpected shape.
function formatWeek(week: string): string {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(week);
  return m ? `Week ${Number(m[2])} · ${m[1]}` : week;
}

/** One leaderboard row. `pinned` renders the sticky "your rank" row below the top N. */
function Row({ entry, pinned }: { entry: LeaderboardEntry; pinned?: boolean }) {
  const cls = [
    'leaderboard__row',
    entry.isYou ? 'leaderboard__row--you' : '',
    pinned ? 'leaderboard__row--pinned' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="leaderboard__rank">{entry.rank > 0 ? `#${entry.rank}` : '—'}</span>
      <span className="leaderboard__name">
        {entry.displayName}
        {entry.isYou && <span className="leaderboard__you-tag">You</span>}
      </span>
      <span className="leaderboard__wins">
        {entry.wins.toLocaleString()}<span className="leaderboard__wins-unit"> W</span>
      </span>
      <span className="leaderboard__coins">
        <CoinIcon size={14} /> {entry.coins.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * Weekly leaderboard modal (V3 Phase 5). Prestige-only — no prizes. Fetches a
 * fresh board on open, renders the top LEADERBOARD_SIZE ranked by wins then coins,
 * highlights the requester's own row, and pins a "your rank" row when the player
 * sits outside the visible top rows.
 */
export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const leaderboard = useGameStore((s) => s.leaderboard);
  const setLeaderboard = useGameStore((s) => s.setLeaderboard);

  // Fresh board on open: drop any prior fetch so the week/you shown always match
  // the current request, then ask the server.
  useEffect(() => {
    setLeaderboard(null);
    void sendGetLeaderboard();
  }, [setLeaderboard]);

  const entries = leaderboard?.entries ?? [];
  const you = leaderboard?.you ?? null;
  const youInTop = entries.some((e) => e.isYou);
  const showPinned = you !== null && !youInTop;

  return (
    <Modal open title="Weekly Leaderboard" onClose={onClose}>
      <div className="leaderboard">
        {leaderboard && (
          <p className="leaderboard__week">{formatWeek(leaderboard.week)}</p>
        )}

        {leaderboard === null ? (
          <p className="leaderboard__note">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard__note">No wins yet this week — play a Coin Rush game!</p>
        ) : (
          <>
            <div className="leaderboard__head" aria-hidden>
              <span className="leaderboard__rank">#</span>
              <span className="leaderboard__name">Player</span>
              <span className="leaderboard__wins">Wins</span>
              <span className="leaderboard__coins">Coins</span>
            </div>
            <div className="leaderboard__list">
              {entries.map((e) => (
                <Row key={e.rank} entry={e} />
              ))}
            </div>
            {showPinned && you && (
              <>
                <div className="leaderboard__pinned-sep" aria-hidden>· · ·</div>
                <Row entry={you} pinned />
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
