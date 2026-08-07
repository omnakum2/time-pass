import { TrickCard, Player, GameMode, GAME_MODES, TrumpConfig, trumpLabel, trumpInfo, SUIT_SYMBOL, SUIT_NAME, RED_SUITS } from 'shared';
import { CardView } from './CardView';
import { InfoTooltip } from './InfoTooltip';
import { playerName } from '../lib/helpers';
import { AnimatePresence } from 'framer-motion';

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

        {/* Round + Trump stay together in one centered row (never stacked). */}
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
        </div>

        {/* Mode label is pinned to the felt's top-right corner so a third chip
            never pushes Round/Trump into a stacked second row on small screens. */}
        {modeShort && <div className="mode-chip mode-chip--corner">{modeShort}</div>}

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
