import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getIdToken, isSignedIn, isAuthEnabled } from '../auth';
import { sendGetRewards } from '../net/socket';
import { DailyRewardModal } from './DailyRewardModal';
import { LuckySpinModal } from './LuckySpinModal';

type OpenModal = 'daily' | 'spin' | null;

/**
 * V3 rewards launcher: two floating home-screen buttons (Daily Reward + Lucky
 * Spin) that each open a modal. Fetches reward status on mount when already
 * signed in; a first click triggers Google sign-in if needed. Renders nothing in
 * an anonymous build (Firebase not configured), matching the wallet chip.
 */
export function RewardsPanel() {
  const rewards = useGameStore((s) => s.rewards);
  const [open, setOpen] = useState<OpenModal>(null);

  useEffect(() => {
    if (isSignedIn()) void sendGetRewards();
  }, []);

  if (!isAuthEnabled()) return null;

  // Open a modal, signing in + refreshing status first when not yet signed in.
  const launch = (which: Exclude<OpenModal, null>) => async () => {
    if (!isSignedIn()) {
      await getIdToken(); // prompts the Google popup when needed
      await sendGetRewards();
    }
    setOpen(which);
  };

  const dailyReady = Boolean(rewards?.canClaimDaily);
  const spinFree = rewards?.nextSpinCost === 0;

  return (
    <>
      <div className="reward-fab-group">
        <button
          type="button"
          className="reward-fab"
          onClick={() => void launch('daily')()}
          aria-label={dailyReady ? 'Daily Reward — ready to claim' : 'Daily Reward'}
        >
          <span className="reward-fab__icon-wrap">
            <span className="reward-fab__icon" aria-hidden>🎁</span>
            {dailyReady && (
              <span className="reward-fab__dot" role="img" aria-label="Reward ready" />
            )}
          </span>
          <span className="reward-fab__label">Daily Reward</span>
        </button>
        <button
          type="button"
          className="reward-fab"
          onClick={() => void launch('spin')()}
          aria-label={spinFree ? 'Lucky Spin — free spin ready' : 'Lucky Spin'}
        >
          <span className="reward-fab__icon-wrap">
            <span className="reward-fab__icon" aria-hidden>🎡</span>
            {spinFree && (
              <span className="reward-fab__dot" role="img" aria-label="Reward ready" />
            )}
          </span>
          <span className="reward-fab__label">Lucky Spin</span>
        </button>
      </div>

      {open === 'daily' && <DailyRewardModal onClose={() => setOpen(null)} />}
      {open === 'spin' && <LuckySpinModal onClose={() => setOpen(null)} />}
    </>
  );
}
