import { AnimatePresence } from 'framer-motion';
import { TrickCard, Player } from 'shared';
import { CardView } from './CardView';

interface Props {
  trick: TrickCard[];
  players: Player[];
  round: number | null;
  status: string;
}

export function TrickArea({ trick, players, round, status }: Props) {
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

        {round != null && <div className="round-chip">Round {round}</div>}

        <AnimatePresence>
          {trick.map(({ playerId, card }) => (
            <div key={`${playerId}-${card.id}`} className="trick-card-slot">
              <span className="trick-card-slot__name">{playerName(playerId)}</span>
              <CardView card={card} played layoutId={`card-${card.id}`} />
            </div>
          ))}
        </AnimatePresence>

        {status && <div className="trick-status">{status}</div>}
      </div>
    </div>
  );
}
