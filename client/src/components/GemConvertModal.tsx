import { useEffect, useRef, useState } from 'react';
import { GEM_TO_COINS, coinsForGems, isValidGemAmount } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendConvertGems } from '../net/socket';
import { Modal } from './Modal';
import { Button } from './Button';
import { CoinIcon, GemIcon } from './CurrencyIcon';

/**
 * Gem → Coin conversion modal (V3 Phase 5). One-way: 1 Gem = GEM_TO_COINS Coins.
 * Shows the live wallet, a validated amount input with a "= N coins" preview, and
 * a Convert button that sends `convertGems`. The server's `account` reply updates
 * the wallet automatically (store) and we surface a brief success confirmation.
 * INSUFFICIENT_GEMS / INVALID_AMOUNT arrive via the global error toast; we also
 * keep the button disabled while the amount is invalid.
 */
export function GemConvertModal({ onClose }: { onClose: () => void }) {
  const account = useGameStore((s) => s.account);
  const error = useGameStore((s) => s.error);

  const [gemsStr, setGemsStr] = useState('1');
  const [converting, setConverting] = useState(false);
  const [success, setSuccess] = useState<{ gems: number; coins: number } | null>(null);

  const awaitingRef = useRef(false);                 // true after send, until account/error/timeout
  const pendingRef = useRef<{ gems: number; coins: number } | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const held = account?.gems ?? 0;
  const coins = account?.coins ?? 0;
  const gems = Number.parseInt(gemsStr, 10);
  const hasAmount = Number.isInteger(gems) && gems >= 1;
  const valid = isValidGemAmount(gems, held);
  const preview = hasAmount ? coinsForGems(gems) : 0;

  const clearFallback = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  useEffect(() => clearFallback, []); // clear the fallback timer on unmount

  // A fresh `account` arrived while we were awaiting a conversion → success.
  useEffect(() => {
    if (!awaitingRef.current) return;
    awaitingRef.current = false;
    clearFallback();
    setConverting(false);
    setSuccess(pendingRef.current);
    setGemsStr('1');
  }, [account]);

  // Server rejected the conversion (INSUFFICIENT_GEMS / INVALID_AMOUNT): the store
  // surfaces the toast; here we just release the button.
  useEffect(() => {
    if (error && awaitingRef.current) {
      awaitingRef.current = false;
      clearFallback();
      setConverting(false);
    }
  }, [error]);

  const inlineError =
    hasAmount && !valid
      ? gems > held
        ? 'You don’t have that many Gems.'
        : 'Enter a whole number of Gems.'
      : !hasAmount && gemsStr.trim() !== ''
        ? 'Enter a whole number of Gems.'
        : null;

  const handleConvert = async () => {
    if (!valid || converting) return;
    pendingRef.current = { gems, coins: coinsForGems(gems) };
    setSuccess(null);
    setConverting(true);
    awaitingRef.current = true;
    // Safety net: if neither an account update nor an error lands, release the button.
    timeoutRef.current = window.setTimeout(() => {
      if (awaitingRef.current) {
        awaitingRef.current = false;
        setConverting(false);
      }
    }, 6000);
    try {
      await sendConvertGems(gems);
    } catch {
      awaitingRef.current = false;
      clearFallback();
      setConverting(false);
    }
  };

  return (
    <Modal open title="Convert Gems" onClose={onClose}>
      <div className="gem-convert">
        {/* Live wallet */}
        <div className="gem-convert__wallet">
          <div className="gem-convert__stat">
            <span className="gem-convert__stat-label">Gems</span>
            <span className="gem-convert__stat-value gem-convert__stat-value--gems">
              <GemIcon size={16} /> {held.toLocaleString()}
            </span>
          </div>
          <div className="gem-convert__stat">
            <span className="gem-convert__stat-label">Coins</span>
            <span className="gem-convert__stat-value gem-convert__stat-value--coins">
              <CoinIcon size={16} /> {coins.toLocaleString()}
            </span>
          </div>
        </div>

        {held < 1 ? (
          <p className="gem-convert__empty">
            You have no Gems to convert yet. Win them from the Daily Reward streak or Lucky Spin!
          </p>
        ) : (
          <>
            <label className="gem-convert__field">
              <span className="field-label">Gems to convert</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={held}
                step={1}
                value={gemsStr}
                onChange={(e) => {
                  setGemsStr(e.target.value);
                  setSuccess(null);
                }}
                disabled={converting}
                aria-invalid={inlineError !== null}
                aria-label="Gems to convert"
              />
            </label>

            {/* Live conversion preview */}
            <p className="gem-convert__preview" aria-live="polite">
              <span className="gem-convert__preview-from">
                <GemIcon size={15} /> {hasAmount ? gems.toLocaleString() : 0}
              </span>
              <span className="gem-convert__preview-arrow" aria-hidden>→</span>
              <span className="gem-convert__preview-to">
                <CoinIcon size={15} /> {preview.toLocaleString()}
              </span>
            </p>

            {inlineError && <p className="gem-convert__error" role="alert">{inlineError}</p>}

            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleConvert()}
              disabled={!valid || converting}
            >
              {converting ? 'Converting…' : 'Convert'}
            </Button>

            {success && (
              <p className="reward-toast" role="status">
                Converted <GemIcon size={15} /> {success.gems.toLocaleString()} →{' '}
                <CoinIcon size={15} /> {success.coins.toLocaleString()}!
              </p>
            )}
          </>
        )}

        <p className="gem-convert__rule">
          1 <GemIcon size={13} /> Gem = {GEM_TO_COINS.toLocaleString()} <CoinIcon size={13} /> Coins · one-way
        </p>
      </div>
    </Modal>
  );
}
