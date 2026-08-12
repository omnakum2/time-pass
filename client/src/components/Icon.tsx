import type { IconType } from 'react-icons';
import { LuCopy, LuCheck, LuX } from 'react-icons/lu';

// Central icon registry. Add the app's icons here — backed by react-icons, so any
// set (lu, fi, fa, md, …) is available; swap a glyph in one place.
const ICONS = {
  copy: LuCopy,
  check: LuCheck,
  close: LuX,
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
