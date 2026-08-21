import { useEffect, useRef, useState } from 'react';
import { REFERRAL_REWARD, isValidReferralCodeShape, normalizeReferralCode } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendGetReferral, sendApplyReferral } from '../net/socket';
import { COPY_FEEDBACK_MS } from '../constants';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';
import { CoinIcon } from './CurrencyIcon';

/**
 * Referral invites modal (V3 Phase 6). On open it fetches the player's referral
 * standing (`getReferral`) and shows: their own shareable code with a
 * copy-to-clipboard button, how many friends have joined with it, and — only
 * until they've used someone else's code — an input to apply a friend's code.
 * A successful apply credits BOTH sides REFERRAL_REWARD Coins: the server sends
 * an updated `account` (wallet auto-updates) plus a fresh `referralStatus`
 * (referredBy → true), which makes the apply section disappear. Errors
 * (INVALID_REFERRAL / ALREADY_REFERRED / SELF_REFERRAL) surface via the global
 * error toast; we just release the button.
 */
export function ReferralModal({ onClose }: { onClose: () => void }) {
  const referral = useGameStore((s) => s.referral);
  const error = useGameStore((s) => s.error);

  const [codeStr, setCodeStr] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const awaitingRef = useRef(false);          // true after send, until referralStatus / error / timeout
  const timeoutRef = useRef<number | null>(null);

  // Fetch the player's standing on open (the modal only opens when signed in).
  useEffect(() => {
    void sendGetReferral();
  }, []);

  const clearFallback = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  useEffect(() => clearFallback, []); // clear the fallback timer on unmount

  // A fresh referralStatus arrived while we were applying → success (referredBy
  // flips true, so the apply section unmounts on its own).
  useEffect(() => {
    if (!awaitingRef.current) return;
    awaitingRef.current = false;
    clearFallback();
    setApplying(false);
    setCodeStr('');
  }, [referral]);

  // Server rejected the code: the store surfaces the toast; here we release the button.
  useEffect(() => {
    if (error && awaitingRef.current) {
      awaitingRef.current = false;
      clearFallback();
      setApplying(false);
    }
  }, [error]);

  const code = referral?.code ?? '';
  const normalized = normalizeReferralCode(codeStr);
  const shapeOk = isValidReferralCodeShape(normalized);
  const isOwn = shapeOk && code !== '' && normalized === code;
  const valid = shapeOk && !isOwn;

  const inlineError = isOwn
    ? "That's your own code — share it with a friend instead."
    : null;

  const copyCode = async () => {
    if (!code) return;
    const mark = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    };
    // Preferred path: async Clipboard API (secure contexts only).
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        mark();
        return;
      }
    } catch {
      /* fall through to the legacy path */
    }
    // Fallback for non-secure origins: hidden textarea + execCommand('copy').
    try {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) mark();
    } catch {
      /* clipboard genuinely unavailable — the user can still select the code manually */
    }
  };

  const handleApply = async () => {
    if (!valid || applying) return;
    setApplying(true);
    awaitingRef.current = true;
    // Safety net: if neither a referralStatus nor an error lands, release the button.
    timeoutRef.current = window.setTimeout(() => {
      if (awaitingRef.current) {
        awaitingRef.current = false;
        setApplying(false);
      }
    }, 6000);
    try {
      await sendApplyReferral(normalized);
    } catch {
      awaitingRef.current = false;
      clearFallback();
      setApplying(false);
    }
  };

  return (
    <Modal open title="Invite Friends" onClose={onClose}>
      <div className="referral">
        {referral === null ? (
          <p className="referral__note">Loading…</p>
        ) : (
          <>
            {/* The player's own shareable code + copy button */}
            <div className="referral__code-block">
              <span className="referral__code-label">Your code</span>
              <div className="referral__code-row">
                <span className="referral__code" aria-label={`Your referral code is ${code}`}>{code}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void copyCode()}
                  title="Copy code"
                  aria-label="Copy referral code"
                >
                  {copied ? <Icon name="check" /> : <Icon name="copy" />}
                </button>
              </div>
            </div>

            {/* Reward explainer */}
            <p className="referral__reward">
              You and your friend each get <CoinIcon size={15} /> {REFERRAL_REWARD.toLocaleString()} Coins.
            </p>

            {/* Invite count */}
            <div className="referral__stat">
              <span className="referral__stat-label">Friends joined</span>
              <span className="referral__stat-value">{referral.invitedCount.toLocaleString()}</span>
            </div>

            {/* Apply a friend's code — only until the player has used one */}
            {referral.referredBy ? (
              <p className="referral__used">You've already used a referral code.</p>
            ) : (
              <div className="referral__apply">
                <label className="referral__field">
                  <span className="field-label">Have a friend's code?</span>
                  <input
                    className="input referral__input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ABC123"
                    maxLength={12}
                    value={codeStr}
                    onChange={(e) => setCodeStr(e.target.value)}
                    disabled={applying}
                    aria-invalid={inlineError !== null}
                    aria-label="Friend's referral code"
                  />
                </label>

                {inlineError && <p className="referral__error" role="alert">{inlineError}</p>}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleApply()}
                  disabled={!valid || applying}
                >
                  {applying ? 'Applying…' : 'Apply code'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
