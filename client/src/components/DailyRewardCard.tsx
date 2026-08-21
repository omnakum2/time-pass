import type { ReactNode } from 'react';
import { LOGIN_REWARDS } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendClaimDaily } from '../net/socket';
import { Button } from './Button';
import { CoinIcon, GemIcon } from './CurrencyIcon';

// Format a single day's reward for a streak tile (coins, or gems on D7).
function rewardLabel(day: number): ReactNode {
  const r = LOGIN_REWARDS[day];
  return r.gems > 0
    ? <><GemIcon size={15} /> {Math.round(r.gems)}</>
    : <><CoinIcon size={15} /> {Math.round(r.coins)}</>;
}

/** V3 daily-login streak card: a 7-day grid + a Claim button. Reads `rewards`. */
export function DailyRewardCard() {
  const rewards = useGameStore((s) => s.rewards);
  const rewardToast = useGameStore((s) => s.rewardToast);

  if (!rewards) return null;

  const { streak, canClaimDaily } = rewards;

  return (
    <div className="reward-card">
      <div className="reward-days">
        {LOGIN_REWARDS.slice(1).map((_, i) => {
          const day = i + 1; // LOGIN_REWARDS index 1..7
          const collected = day <= streak;
          const claimable = canClaimDaily && day === streak + 1;
          const isFinal = day === 7;
          const cls = [
            'reward-day',
            isFinal ? 'reward-day--final' : '',
            collected ? 'reward-day--collected' : '',
            claimable ? 'reward-day--claimable' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={day} className={cls}>
              <span className="reward-day__label">D{day}</span>
              <span className="reward-day__value">{rewardLabel(day)}</span>
              {collected && (
                <span className="reward-day__check" aria-label="Collected">✓</span>
              )}
            </div>
          );
        })}
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => void sendClaimDaily()}
        disabled={!canClaimDaily}
      >
        {canClaimDaily ? 'Claim reward' : 'Come back tomorrow'}
      </Button>
      {rewardToast?.kind === 'daily' && (
        <>
          <p className="reward-toast">
            You got {rewardToast.coins > 0 && <><CoinIcon size={15} /> {Math.round(rewardToast.coins)}</>}
            {rewardToast.coins > 0 && rewardToast.gems > 0 && ' / '}
            {rewardToast.gems > 0 && <><GemIcon size={15} /> {Math.round(rewardToast.gems)}</>}!
          </p>
          {/* V3 Phase 6: extra Coins from the Coin Rush win-streak (already in the wallet). */}
          {rewardToast.streakBonus != null && rewardToast.streakBonus > 0 && (
            <p className="reward-streak-bonus">
              <span className="reward-streak-bonus__badge">
                Win-streak bonus <CoinIcon size={14} /> +{Math.round(rewardToast.streakBonus)}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
