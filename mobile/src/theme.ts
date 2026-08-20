// Brand tokens for Bid Club (mobile-native).
// These mirror the web `:root` tokens in client/src/index.css — the single
// source of brand identity. Only the color palette is ported; the web CSS
// layout (flex shells, clamp() sizing, scrollbars) is intentionally NOT ported.

// Page gradient — Poker Room (mahogany → wine → ember): grad-1/2/3
export const gradient = ['#3B1F1B', '#5A2233', '#7A3B1E'] as const;

// R,G,B channels of `gold`, for building rgba() gold tints.
const goldRgb = '233, 184, 74';

export const colors = {
  // Page gradient triple (also on `gradient` above for convenience)
  grad1: '#3B1F1B',
  grad2: '#5A2233',
  grad3: '#7A3B1E',

  // Green felt table (the only green)
  tableGreen: '#1E7B46',
  tableGreenEdge: '#14532E',

  // Dark-wine cards
  card1: '#4A1F2B',
  card2: '#2E1720',

  // Text
  cream: '#F3ECDD',
  creamMuted: 'rgba(243,236,221,0.6)',
  moonlight: '#F6F2FF',
  text: '#F3ECDD', // alias of cream (web `--text: var(--cream)`)

  // Gold accents
  gold: '#E9B84A',
  goldDeep: '#C08A2E',
  hudBrown: '#A9701C',
  goldRgb,
  goldBorder: 'rgba(233,184,74,0.38)',
} as const;

// Semantic status — one set used everywhere (deltas, timer ring, urgency).
export const STATUS_COLORS = {
  success: '#5FD07A',
  warning: '#FFB300',
  danger: '#F0736C',
} as const;

// Corner radius (web `--radius: 10px`).
export const radius = 10;
