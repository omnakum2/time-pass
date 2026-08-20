// Bid Club currency icons — coin + gem.
//
// The SVG is lifted VERBATIM from the approved design artifact ("Bid Club coins
// & gems") — do not restyle or deviate. `CurrencySprite` defines the two
// <symbol>s ONCE at app root; `CoinIcon` / `GemIcon` are thin <use> wrappers so
// the gradients are declared a single time (no gradient-id collisions across the
// many render spots — header chip, streak tiles, spin wheel, toasts).

import type { CSSProperties } from 'react';

type IconProps = { size?: number | string; className?: string };

const wrapStyle: CSSProperties = { display: 'inline-block', verticalAlign: '-0.15em' };

/** Mount ONCE near the app root. Renders nothing visible — just the sprite defs. */
export function CurrencySprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="bc-coin" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="bc-coin-grad" cx="48%" cy="42%" r="64%">
            <stop offset="0%" stopColor="#F7C24A" />
            <stop offset="58%" stopColor="#ED9F32" />
            <stop offset="100%" stopColor="#C6771D" />
          </radialGradient>
          <clipPath id="bc-coin-clip">
            <circle cx="50" cy="48.5" r="40" />
          </clipPath>
        </defs>
        <circle cx="50" cy="52" r="45.5" fill="#8F520E" />
        <circle cx="50" cy="48.5" r="45.5" fill="#E29A2E" />
        <circle cx="50" cy="48.5" r="40" fill="url(#bc-coin-grad)" />
        <circle cx="50" cy="48.5" r="40" fill="none" stroke="#AC6317" strokeWidth="1.5" opacity="0.55" />
        <circle cx="50" cy="48.5" r="38.3" fill="none" stroke="#F6D386" strokeWidth="0.8" opacity="0.32" />
        <g clipPath="url(#bc-coin-clip)">
          <text x="50" y="49.5" textAnchor="middle" dominantBaseline="central" fontFamily="Outfit, Arial, sans-serif" fontWeight="700" fontSize="40" fill="#F7D07A" opacity="0.4">G</text>
          <text x="50" y="48" textAnchor="middle" dominantBaseline="central" fontFamily="Outfit, Arial, sans-serif" fontWeight="700" fontSize="40" fill="#8F520E" opacity="0.55">G</text>
          <ellipse cx="50" cy="34" rx="24" ry="8" fill="#FFD46A" opacity="0.13" />
        </g>
      </symbol>

      <symbol id="bc-gem" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="bc-gem-grad" cx="44%" cy="36%" r="74%">
            <stop offset="0%" stopColor="#199160" />
            <stop offset="52%" stopColor="#0B6244" />
            <stop offset="100%" stopColor="#04301E" />
          </radialGradient>
        </defs>
        <g transform="rotate(20 50 50)">
          <polygon points="31.8,6 68.2,6 94,31.8 94,68.2 68.2,94 31.8,94 6,68.2 6,31.8" fill="url(#bc-gem-grad)" stroke="#04281A" strokeWidth="1.6" />
          <polygon points="36,18 64,18 83,36 83,64 64,83 36,83 17,64 17,36" fill="#20A06E" opacity="0.26" />
        </g>
      </symbol>
    </svg>
  );
}

/** Gold coin token. Default 1em so it scales with surrounding text. */
export function CoinIcon({ size = '1em', className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={wrapStyle} aria-hidden="true">
      <use href="#bc-coin" />
    </svg>
  );
}

/** Emerald gem. Default 1em so it scales with surrounding text. */
export function GemIcon({ size = '1em', className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={wrapStyle} aria-hidden="true">
      <use href="#bc-gem" />
    </svg>
  );
}
