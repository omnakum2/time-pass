import { AnimatePresence } from 'framer-motion';
import { TrickCard, Player } from 'shared';
import { CardView } from './CardView';

interface Props {
  trick: TrickCard[];
  players: Player[];
}

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };

export function TrickArea({ trick, players }: Props) {
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?';

  return (
    <div className="trick-area">
      {trick.length === 0 ? (
        <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Trick will appear here</p>
      ) : (
        <AnimatePresence>
          {trick.map(({ playerId, card }) => (
            <div key={`${playerId}-${card.id}`} style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', opacity: 0.7, display: 'block', marginBottom: 4 }}>
                {playerName(playerId)}
              </span>
              <CardView
                card={card}
                played
                layoutId={`card-${card.id}`}
              />
            </div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
