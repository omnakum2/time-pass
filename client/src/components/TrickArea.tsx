import { AnimatePresence } from 'framer-motion';
import { TrickCard, Player, Suit, SUIT_SYMBOL, SUIT_NAME, RED_SUITS } from 'shared';
import { CardView } from './CardView';
import { playerName } from '../lib/helpers';

interface Props {
  trick: TrickCard[];
  players: Player[];
  round: number | null;
  status: string;
  trump: Suit | null;
  urgent: boolean;
}

export function TrickArea({ trick, players, round, status, trump, urgent }: Props) {
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
              <span className="trick-card-slot__name">{playerName(players, playerId)}</span>
              <CardView card={card} played layoutId={`card-${card.id}`} />
            </div>
          ))}
        </AnimatePresence>

        {status && <div className={`trick-status${urgent ? ' trick-status--urgent' : ''}`}>{status}</div>}
      </div>
    </div>
  );
}
