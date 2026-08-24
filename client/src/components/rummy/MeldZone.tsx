import { RummyCard, MeldKind, MELD_SIZE, DeckMode, validateMeld } from 'shared';
import { CardView } from '../CardView';

interface Props {
  kind: MeldKind;
  label: string;
  cards: RummyCard[];
  trumpCard: RummyCard | null;
  deckMode: DeckMode;
  onZoneClick: () => void;
  onCardClick: (cardId: string) => void;
}

/** One of the 4 required melds. Tap a selected hand card's target zone (label or an
 * empty slot) to place it; tap a placed card to send it back to the hand. */
export function MeldZone({ kind, label, cards, trumpCard, deckMode, onZoneClick, onCardClick }: Props) {
  const size = MELD_SIZE[kind];
  const isFull = cards.length === size;
  const isValid = isFull && trumpCard ? validateMeld(cards, kind, trumpCard, deckMode) : false;
  const cls = ['meld-zone', isFull ? (isValid ? 'meld-zone--valid' : 'meld-zone--invalid') : ''].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <button type="button" className="meld-zone__label" onClick={onZoneClick}>
        {label} ({cards.length}/{size})
      </button>
      <div className="meld-zone__cards">
        {cards.map(c => (
          <CardView key={c.id} card={c} layout layoutId={`rummy-card-${c.id}`} onClick={() => onCardClick(c.id)} />
        ))}
        {Array.from({ length: size - cards.length }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            className="meld-zone__slot"
            onClick={onZoneClick}
            aria-label={`Place selected card in ${label}`}
          />
        ))}
      </div>
    </div>
  );
}
