import type { IconType } from 'react-icons';
import {
  LuCopy, LuCheck, LuX, LuCrown, LuSwords,
  LuTrendingUp, LuTrendingDown, LuLock, LuChevronsUp, LuEllipsis, LuTable,
} from 'react-icons/lu';

// Central icon registry. Add the app's icons here — backed by react-icons, so any
// set (lu, fi, fa, md, …) is available; swap a glyph in one place.
const ICONS = {
  copy: LuCopy,
  check: LuCheck,
  close: LuX,
  crown: LuCrown,               // Up & Down Summit
  swords: LuSwords,             // Up & Down Last Stand
  trendingUp: LuTrendingUp,     // Up & Down stakes rising
  trendingDown: LuTrendingDown, // Up & Down stakes easing
  lock: LuLock,                 // Blind Bid — locked
  pushed: LuChevronsUp,         // Blind Bid — pushed
  deciding: LuEllipsis,         // Blind Bid — still deciding
  table: LuTable,               // full scoreboard viewer
} satisfies Record<string, IconType>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: Props) {
  const Glyph = ICONS[name];
  return <Glyph size={size} className={className} aria-hidden />;
}
