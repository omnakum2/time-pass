import { motion } from 'framer-motion';
import { Card, SUIT_SYMBOL, isRedSuit } from 'shared';

interface Props {
  card: Card;
  disabled?: boolean;
  selected?: boolean;
  played?: boolean;
  onClick?: () => void;
  layoutId?: string;
  style?: React.CSSProperties;
  /** Card width. Keywords map to a fluid RATIO of the shared `--card-base`
   *  (sm/md/lg), so an explicitly-sized card still scales with the viewport; a
   *  number is an explicit px width. Omit to inherit the ambient `--card-w`. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Render a face-DOWN card (the shared `.card--back` look) instead of the front. */
  back?: boolean;
  /** Optional background for the back face (only used when `back` is true). */
  backColor?: string;
}

/** Resolve a `size` prop to a card-width CSS value. Keywords reference the shared
 *  fluid tokens (so they scale with the viewport, no fixed px); a number is px. */
function sizeToWidth(size: 'sm' | 'md' | 'lg' | number): string {
  if (typeof size === 'number') return `${size}px`;
  if (size === 'sm') return 'var(--card-w-sm)';
  if (size === 'lg') return 'var(--card-base)';
  return 'var(--card-w-md)'; // 'md'
}

export function CardView({ card, disabled, selected, played, onClick, layoutId, style, size, back, backColor }: Props) {
  const isRed = isRedSuit(card.suit);
  const cls = [
    'card',
    back ? 'card--back' : (isRed ? 'card--red' : 'card--black'),
    disabled ? 'card--disabled' : '',
    selected ? 'card--selected' : '',
    played ? 'card--played' : '',
  ].filter(Boolean).join(' ');

  // Only set the size vars when `size` is given; otherwise inherit ambient --card-w.
  const sizeVars: React.CSSProperties = size !== undefined
    ? { ['--card-w' as any]: sizeToWidth(size), ['--card-h' as any]: `calc(${sizeToWidth(size)} * 1.45)` }
    : {};
  const mergedStyle: React.CSSProperties = {
    ...sizeVars,
    ...(back && backColor ? { background: backColor } : {}),
    ...style,
  };

  return (
    <motion.div
      className={cls}
      layoutId={layoutId}
      onClick={disabled ? undefined : onClick}
      style={mergedStyle}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={!disabled ? { y: -8 } : undefined}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
    >
      {!back && (
        <>
          <span style={{ position: 'absolute', top: '0.3em', left: '0.42em', fontSize: '0.65em', lineHeight: 1 }}>
            {card.rank}<br />{SUIT_SYMBOL[card.suit]}
          </span>
          <span style={{ fontSize: '1.2em' }}>{SUIT_SYMBOL[card.suit]}</span>
          <span style={{ position: 'absolute', bottom: '0.3em', right: '0.42em', fontSize: '0.65em', lineHeight: 1, transform: 'rotate(180deg)' }}>
            {card.rank}<br />{SUIT_SYMBOL[card.suit]}
          </span>
        </>
      )}
    </motion.div>
  );
}
