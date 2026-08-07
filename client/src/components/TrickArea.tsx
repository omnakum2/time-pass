import { AnimatePresence } from 'framer-motion';
import { TrickCard, Player, Suit, GameMode, GAME_MODES, TrumpConfig, trumpLabel, trumpInfo } from 'shared';
import { CardView } from './CardView';
import { InfoTooltip } from './InfoTooltip';

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUIT_NAME: Record<string, string> = { D: 'Diamonds', C: 'Clubs', H: 'Hearts', S: 'Spades' };
const RED_SUITS = new Set<Suit>(['D', 'H']);

interface Props {
  trick: TrickCard[];
  players: Player[];
  round: number | null;
  status: string;
  trumpConfig: TrumpConfig | null;
  urgent: boolean;
  mode: GameMode;
}

export function TrickArea({ trick, players, round, status, trumpConfig, urgent, mode }: Props) {
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?';
  const modeShort = GAME_MODES.find(m => m.id === mode)?.short ?? '';

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
            {trumpConfig && trumpConfig.kind === 'suit' && trumpConfig.suit ? (
              <span className={RED_SUITS.has(trumpConfig.suit) ? 'suit-red' : 'suit-black'}>
                <span className="trump-chip__suit">{SUIT_SYMBOL[trumpConfig.suit]}</span>&nbsp;{SUIT_NAME[trumpConfig.suit]}
              </span>
            ) : (
              <span className="trump-chip__none">{trumpConfig ? trumpLabel(trumpConfig) : '—'}</span>
            )}
            {trumpConfig && <InfoTooltip text={trumpInfo(trumpConfig)} />}
          </div>
          <div className="mode-chip">{modeShort}</div>
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
