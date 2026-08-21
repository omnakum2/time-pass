import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getIdToken, isSignedIn, isAuthEnabled } from '../auth';
import { sendGetRewards, sendAdReward } from '../net/socket';
import { isAdRewardEnabled } from '../flags';
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
  const account = useGameStore((s) => s.account);
  const error = useGameStore((s) => s.error);
  const [open, setOpen] = useState<OpenModal>(null);
  // Rewarded-ad top-up (flag-gated, default hidden). `adPending` guards against
  // double-taps until the server's account update or an error lands.
  const adEnabled = isAdRewardEnabled();
  const [adPending, setAdPending] = useState(false);
  const adAwaitingRef = useRef(false);

  useEffect(() => {
    if (isSignedIn()) void sendGetRewards();
  }, []);

  // Release the ad button once the wallet update (account) or an error arrives.
  useEffect(() => {
    if (adAwaitingRef.current) {
      adAwaitingRef.current = false;
      setAdPending(false);
    }
  }, [account, error]);

  if (!isAuthEnabled()) return null;

  // Open a modal, signing in + refreshing status first when not yet signed in.
  const launch = (which: Exclude<OpenModal, null>) => async () => {
    if (!isSignedIn()) {
      await getIdToken(); // prompts the Google popup when needed
      await sendGetRewards();
    }
    setOpen(which);
  };

  // Rewarded-ad top-up: PLACEHOLDER for a future ad SDK's reward callback — there
  // is no real ad, we just send `adReward`. Signs in first if needed. The wallet
  // updates via the server's `account` reply; AD_REWARD_LIMIT / AD_REWARD_DISABLED
  // surface through the global error toast.
  const watchAd = async () => {
    if (adPending) return;
    setAdPending(true);
    adAwaitingRef.current = true;
    try {
      if (!isSignedIn()) await getIdToken(); // prompts the Google popup when needed
      await sendAdReward();
    } catch {
      adAwaitingRef.current = false;
      setAdPending(false);
    }
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
        {adEnabled && (
          <button
            type="button"
            className="reward-fab"
            onClick={() => void watchAd()}
            disabled={adPending}
            aria-label="Watch an ad for Coins"
          >
            <span className="reward-fab__icon-wrap">
              <span className="reward-fab__icon" aria-hidden>📺</span>
            </span>
            <span className="reward-fab__label">{adPending ? 'Loading…' : 'Watch Ad'}</span>
          </button>
        )}
      </div>

      {open === 'daily' && <DailyRewardModal onClose={() => setOpen(null)} />}
      {open === 'spin' && <LuckySpinModal onClose={() => setOpen(null)} />}
    </>
  );
}
