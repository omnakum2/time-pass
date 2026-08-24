import { motion } from 'framer-motion';
import { Card, SUIT_SYMBOL, isRedSuit } from 'shared';

interface Props {
  card: Card;
  disabled?: boolean;
  selected?: boolean;
  played?: boolean;
  onClick?: () => void;
  layoutId?: string;
  // Set when this card sits inside a parent that animates its own position/size
  // (e.g. a Reorder.Item) — keeps this card's face from stretching during that
  // parent's layout transition.
  layout?: boolean;
  style?: React.CSSProperties;
}

export function CardView({ card, disabled, selected, played, onClick, layoutId, layout, style }: Props) {
  const isRed = isRedSuit(card.suit);
  const cls = [
    'card',
    isRed ? 'card--red' : 'card--black',
    disabled ? 'card--disabled' : '',
    selected ? 'card--selected' : '',
    played ? 'card--played' : '',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={cls}
      layout={layout}
      layoutId={layoutId}
      onClick={disabled ? undefined : onClick}
      style={style}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={!disabled ? { y: -8 } : undefined}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
    >
      <span style={{ position: 'absolute', top: 4, left: 6, fontSize: '0.65em', lineHeight: 1 }}>
        {card.rank}<br />{SUIT_SYMBOL[card.suit]}
      </span>
      <span style={{ fontSize: '1.2em' }}>{SUIT_SYMBOL[card.suit]}</span>
      <span style={{ position: 'absolute', bottom: 4, right: 6, fontSize: '0.65em', lineHeight: 1, transform: 'rotate(180deg)' }}>
        {card.rank}<br />{SUIT_SYMBOL[card.suit]}
      </span>
    </motion.div>
  );
}
