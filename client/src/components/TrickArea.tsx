import { AnimatePresence } from 'framer-motion';
import { TrickCard, Player, Suit } from 'shared';
import { CardView } from './CardView';

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUIT_NAME: Record<string, string> = { D: 'Diamonds', C: 'Clubs', H: 'Hearts', S: 'Spades' };
const RED_SUITS = new Set<Suit>(['D', 'H']);

interface Props {
  trick: TrickCard[];
  players: Player[];
  round: number | null;
  status: string;
  trump: Suit | null;
  urgent: boolean;
}

export function TrickArea({ trick, players, round, status, trump, urgent }: Props) {
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?';

  return (
    <div className="trick-area">
      <div className="trick-felt">
        {/* Embossed table wordmark — suits over JHATPAT over a flourish */}
        <div className="felt-watermark">
          <div className="felt-watermark__suits">♠ ♥ ♦ ♣</div>
          <div className="felt-watermark__title">BID CLUB</div>
          <div className="felt-watermark__flourish">✦&nbsp;&nbsp;❦&nbsp;&nbsp;✦</div>
        </div>

        <div className="felt-badges">
          {round != null && <div className="round-chip">Round {round}</div>}
          <div className="trump-chip">
            <span className="trump-chip__label">Trump</span>
            {trump ? (
              <span className={RED_SUITS.has(trump) ? 'suit-red' : 'suit-black'}>
                <span className="trump-chip__suit">{SUIT_SYMBOL[trump]}</span>&nbsp;{SUIT_NAME[trump]}
              </span>
            ) : (
              <span className="trump-chip__none">No&nbsp;Trump</span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {trick.map(({ playerId, card }) => (
            <div key={`${playerId}-${card.id}`} className="trick-card-slot">
              <span className="trick-card-slot__name">{playerName(playerId)}</span>
              <CardView card={card} played layoutId={`card-${card.id}`} />
            </div>
          ))}
        </AnimatePresence>

        {status && <div className={`trick-status${urgent ? ' trick-status--urgent' : ''}`}>{status}</div>}
      </div>
    </div>
  );
}
