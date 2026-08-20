import './BalanceChip.css';
import { useGameStore } from '../store/gameStore';
import { CoinIcon, GemIcon } from './CurrencyIcon';

/**
 * BalanceChip — reusable currency wallet display for the V3 (gold-on-mahogany)
 * theme. Reads the authenticated `account` from the game store and renders a
 * gold-trimmed dark pill with coin + gem icons: coins in gold and gems in
 * jewel-green, each grouped with thousands separators. Renders nothing when
 * anonymous.
 */
export function BalanceChip() {
  const account = useGameStore((s) => s.account);
  if (!account) return null;

  const coins = Number(account.coins).toLocaleString();
  const gems = Number(account.gems).toLocaleString();

  return (
    <span className="balance-chip" title={account.displayName}>
      <span className="balance-chip__seg balance-chip__seg--coins">
        <span className="balance-chip__icon" aria-hidden="true"><CoinIcon size={16} /></span>
        <span className="balance-chip__value" aria-label={`${coins} coins`}>
          {coins}
        </span>
      </span>
      <span className="balance-chip__divider" aria-hidden="true" />
      <span className="balance-chip__seg balance-chip__seg--gems">
        <span className="balance-chip__icon" aria-hidden="true"><GemIcon size={16} /></span>
        <span className="balance-chip__value" aria-label={`${gems} gems`}>
          {gems}
        </span>
      </span>
    </span>
  );
}
