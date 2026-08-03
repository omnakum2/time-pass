import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Card, Suit } from 'shared';
import { legalMoves } from 'shared';
import { CardView } from './CardView';
import { sendMsg } from '../net/socket';

interface Props {
  hand: Card[];
  isMyTurn: boolean;
  leadSuit: Suit | null;
  phase: string;
}

export function HandView({ hand, isMyTurn, leadSuit, phase }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const legal = isMyTurn && phase === 'PLAYING'
    ? legalMoves(hand, leadSuit).map(c => c.id)
    : [];

  const handleClick = (cardId: string) => {
    if (!isMyTurn || phase !== 'PLAYING') return;
    if (!legal.includes(cardId)) return;

    if (selected === cardId) {
      sendMsg({ type: 'playCard', cardId });
      setSelected(null);
    } else {
      setSelected(cardId);
    }
  };

  // Sort hand: by suit then rank
  const SUIT_ORDER = ['S', 'H', 'D', 'C'];
  const sorted = [...hand].sort((a, b) => {
    const si = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (si !== 0) return si;
    return ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(a.rank) -
           ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(b.rank);
  });

  return (
    <div className="hand-area">
      <div className="hand-cards">
        <AnimatePresence>
          {sorted.map(card => (
            <CardView
              key={card.id}
              card={card}
              layoutId={`card-${card.id}`}
              disabled={isMyTurn && phase === 'PLAYING' ? !legal.includes(card.id) : false}
              selected={selected === card.id}
              onClick={() => handleClick(card.id)}
            />
          ))}
        </AnimatePresence>
      </div>
      {selected && (
        <div style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', fontSize: '0.8rem', opacity: 0.8 }}>
          Tap again to play
        </div>
      )}
    </div>
  );
}
