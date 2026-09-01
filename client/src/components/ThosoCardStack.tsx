import { Card } from 'shared';
import { CardView } from './CardView';

interface Props {
  /** The face-up top card of the pile, or `null` for an empty stack. */
  card: Card | null;
  /** Visual size — `sm` for player chips, `md` for the centre / own pile. */
  size?: 'sm' | 'md';
  /** When true the stack reacts to taps (cursor + hover); otherwise it's a static display. */
  interactive?: boolean;
  /** Subtle highlight on the top card (a selected transfer source). */
  selected?: boolean;
  onClick?: () => void;
}

/**
 * A small face-up card sitting on a face-down stack — a Thoso "pile". Only the top
 * card is ever public, so we render the visible top over two offset shadow layers
 * that stand in for the buried (hidden) cards. `null` renders an empty placeholder.
 */
export function ThosoCardStack({ card, size = 'sm', interactive = false, selected, onClick }: Props) {
  const base = `thoso-pile thoso-pile--${size}${interactive ? ' thoso-pile--interactive' : ''}`;

  if (!card) {
    return (
      <div className={`${base} thoso-pile--empty`} onClick={interactive ? onClick : undefined}>
        <div className="thoso-empty" aria-label="empty pile" />
      </div>
    );
  }

  return (
    <div className={base} onClick={interactive ? onClick : undefined}>
      <div className={`thoso-stack${interactive ? '' : ' thoso-stack--static'}`}>
        <div className="thoso-stack__layer thoso-stack__layer--b" aria-hidden />
        <div className="thoso-stack__layer thoso-stack__layer--a" aria-hidden />
        <div className="thoso-stack__top">
          <CardView card={card} selected={selected} mini={size === 'sm'} />
        </div>
      </div>
    </div>
  );
}
