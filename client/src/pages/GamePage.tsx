import { useRef, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Suit, Player } from 'shared';
import { legalMoves, isHandHiddenForBid } from 'shared';
import { useSessionStore } from '../store/sessionStore';
import { useBidBaaziStore } from '../store/bidbaaziStore';
import { sortHand } from '../format';
import { sendMsg } from '../net/socket';
import { getTotal } from '../lib/helpers';
import { CardView } from '../components/CardView';
import { BidBaaziTrickArea } from '../components/BidBaaziTrickArea';
import { BidBaaziBidPanel } from '../components/BidBaaziBidPanel';
import { BidBaaziTrumpPicker } from '../components/BidBaaziTrumpPicker';
import { PlayerChip } from '../components/PlayerChip';
import { GameTable } from '../components/GameTable';
import { Delta } from '../components/Delta';
import { Popup } from '../components/Popup';
import { BidBaaziRoundResult } from '../components/BidBaaziRoundResult';
import { QuickMessages } from '../components/QuickMessages';
import { Announcement } from '../components/Announcement';
import { BidBaaziPushPanel } from '../components/BidBaaziPushPanel';
import { useUrgentTurn } from '../hooks/useUrgentTurn';

// ─── GamePage ─────────────────────────────────────────────────────────────────

export function GamePage() {
  const { gameState, lastRoundResult } = useBidBaaziStore();
  const playerId = useSessionStore((s) => s.playerId);
  const prevTurnRef = useRef<string>('');
  const prevTrickEmptyRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Derived turn values — computed null-safely so all hooks run before any early return
  const phase = gameState?.phase ?? '';
  const currentTurn = gameState?.currentTurn ?? null;
  const turnTimeoutMs = gameState?.turnTimeoutMs ?? 0;
  const turnRemainingMs = gameState?.turnRemainingMs ?? 0;
  const turnExpiresAt = gameState?.turnExpiresAt ?? null;
  // Timer key re-anchors the countdown only when the server's turn deadline changes
  // (new turn / pause-resume) — never on a plain reconnect. Running = a live turn.
  const timerKey = String(turnExpiresAt ?? 'none');
  const timerRunning = turnExpiresAt != null;
  const currentTrick = gameState?.currentTrick ?? [];

  // Reset the selected card whenever it becomes a new turn (new active player or a
  // fresh trick lead). The turn TIMER is driven separately by the server deadline.
  const trickEmpty = currentTrick.length === 0;
  if (currentTurn && (currentTurn !== prevTurnRef.current || (trickEmpty && !prevTrickEmptyRef.current))) {
    prevTurnRef.current = currentTurn;
    setSelectedCard(null); // reset selection on turn change
  }
  prevTrickEmptyRef.current = trickEmpty;

  const urgent = useUrgentTurn(
    timerKey,
    timerRunning,
    turnRemainingMs,
    (phase === 'BIDDING' || phase === 'PLAYING' || phase === 'TRUMP_SELECT') && !!currentTurn,
  );

  // Blind Bid: whether I've locked/pushed this round. Reset when the PUSH phase ends.
  const [pushDecided, setPushDecided] = useState(false);
  useEffect(() => { if (phase !== 'PUSH') setPushDecided(false); }, [phase]);

  if (!gameState || !playerId) {
    return <div className="page"><p>Loading game…</p></div>;
  }

  const {
    round, trumpConfig, yourHand, bids,
    players, tricksWon, scoreboard, mode,
  } = gameState;

  const isMyTurn = currentTurn === playerId;
  const myBid    = bids[playerId] ?? null;
  const myWon    = tricksWon[playerId] ?? 0;
  const leadSuit: Suit | null = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // Legal cards when it's my turn to play
  const legalIds = isMyTurn && phase === 'PLAYING'
    ? legalMoves(yourHand, leadSuit).map(c => c.id)
    : [];

  // Sort hand: by suit order then rank
  const sortedHand = sortHand(yourHand);

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn || phase !== 'PLAYING') return;
    if (!legalIds.includes(cardId)) return;
    if (selectedCard === cardId) {
      sendMsg({ type: 'playCard', cardId });
      setSelectedCard(null);
    } else {
      setSelectedCard(cardId);
    }
  };

  // Opponents in clockwise seat order from me
  const me = players.find(p => p.id === playerId);
  const opponents: Player[] = [];
  if (me) {
    const n = players.length;
    for (let i = 1; i < n; i++) {
      const seatIdx = (me.seatIndex + i) % n;
      const opp = players.find(p => p.seatIndex === seatIdx);
      if (opp) opponents.push(opp);
    }
  }

  // BidBaazi chip middle content — bid/tricks line + score/push total.
  const chipInfo = (bid: number | null, won: number, totalScore: number, pushChoice?: 'locked' | 'pushed') => (
    <>
      <div className="player-chip__stats">
        {bid !== null ? `Bid ${bid}` : (phase === 'BIDDING' ? 'bidding…' : 'no bid')}
        {' · '}Won {won}
      </div>
      <div className="player-chip__total">
        Score: <Delta value={totalScore} />
        {(phase === 'PUSH' || pushChoice) && (
          <>
            {' · '}
            <span
              className={`player-chip__push${pushChoice ? '' : ' player-chip__push--deciding'}`}
              title={pushChoice === 'locked' ? 'Locked ×2' : pushChoice === 'pushed' ? 'Pushed ×3' : 'Deciding'}
            >
              {pushChoice === 'locked' ? '×2' : pushChoice === 'pushed' ? '×3' : '?'}
            </span>
          </>
        )}
      </div>
    </>
  );

  const chipProps = (p: Player) => {
    const isMe = p.id === playerId;
    const isActive = currentTurn === p.id;
    const pushChoice = gameState.pushStatus?.[p.id];
    return {
      player: p,
      isMe,
      isActive,
      showTimer: isActive && (phase === 'PLAYING' || ((phase === 'BIDDING' || phase === 'TRUMP_SELECT') && !isMe)),
      remainingMs: turnRemainingMs,
      fullMs: turnTimeoutMs,
      startKey: timerKey,
      running: timerRunning,
      info: chipInfo(bids[p.id] ?? null, tricksWon[p.id] ?? 0, getTotal(scoreboard, p.id), pushChoice),
    };
  };

  const blindHidden = isHandHiddenForBid(mode, gameState.phase);

  const activeName = currentTurn ? (players.find(p => p.id === currentTurn)?.name ?? '') : '';
  const statusText = phase === 'TRUMP_SELECT'
    ? (isMyTurn ? 'Choose the trump' : (currentTurn ? `Waiting for ${activeName} to choose the trump…` : ''))
    : phase === 'BIDDING'
    ? (isMyTurn ? 'Place your bid' : (currentTurn ? `Waiting for ${activeName} to bid…` : ''))
    : phase === 'PLAYING'
    ? (isMyTurn ? 'Your turn' : (currentTurn ? `Waiting for ${activeName}…` : ''))
    : phase === 'PUSH'
    ? (pushDecided ? 'Waiting for others…' : 'Lock or push your blind bid')
    : '';

  return (
    <>
      {/* Round announcement banner (mode intro / Up & Down milestone) */}
      <Announcement announcement={gameState.announcement} />

      {/* Round result popup */}
      <BidBaaziRoundResult result={lastRoundResult} visible={phase === 'ROUND_SCORING'} />

      {/* Push popup — Blind Bid: lock (×2) or push (×3) after the hand is revealed */}
      <Popup visible={phase === 'PUSH' && !pushDecided} title="Lock or Push?">
        <BidBaaziPushPanel
          bid={myBid ?? 0}
          cards={round ?? 0}
          remainingMs={turnRemainingMs}
          fullMs={turnTimeoutMs}
          startKey={timerKey}
          running={timerRunning}
          onDecide={(push) => { sendMsg({ type: 'pushBid', push }); setPushDecided(true); }}
        />
      </Popup>

      {/* Bid popup — shown when it's MY turn to bid */}
      <Popup
        visible={phase === 'BIDDING' && isMyTurn}
        title={`Round ${round} · How many tricks will you win?`}
      >
        <BidBaaziBidPanel round={round!} remainingMs={turnRemainingMs} fullMs={turnTimeoutMs} startKey={timerKey} running={timerRunning} />
      </Popup>

      {/* Trump-select popup — shown when it's MY turn to pick the round's trump */}
      <Popup
        visible={phase === 'TRUMP_SELECT' && isMyTurn}
        title={
          mode === 'upDown' && round === 1 ? '⚔️ Last Stand · call the trump'
          : mode === 'upDown' && round === 7 ? '👑 Summit · call the trump'
          : "Choose this round's trump"
        }
      >
        <BidBaaziTrumpPicker
          remainingMs={turnRemainingMs}
          fullMs={turnTimeoutMs}
          startKey={timerKey}
          running={timerRunning}
          limited={mode === 'upDown'}
        />
      </Popup>

      <GameTable
        opponents={opponents.map(p => (
          <PlayerChip key={p.id} {...chipProps(p)} />
        ))}
        center={
          <BidBaaziTrickArea trick={currentTrick} players={players} round={round} status={statusText} trumpConfig={trumpConfig} urgent={urgent} mode={mode} />
        }
        myStrip={
          <>
            <PlayerChip
              player={players.find(p => p.id === playerId)!}
              isMe
              isActive={isMyTurn}
              showTimer={isMyTurn && phase === 'PLAYING'}
              remainingMs={turnRemainingMs}
              fullMs={turnTimeoutMs}
              startKey={timerKey}
              running={timerRunning}
              info={chipInfo(myBid, myWon, getTotal(scoreboard, playerId), gameState.pushStatus?.[playerId])}
            />
            {selectedCard && (
              <span className="tag-faint" style={{ marginLeft: 8 }}>
                Tap again to play
              </span>
            )}
            <QuickMessages />
          </>
        }
        hand={
          <div className="hand-cards">
            {blindHidden ? (
              Array.from({ length: round ?? 0 }).map((_, i) => (
                <div key={i} className="card card--back" aria-hidden="true" />
              ))
            ) : (
              <AnimatePresence>
                {sortedHand.map(card => (
                  <CardView
                    key={card.id}
                    card={card}
                    layoutId={`card-${card.id}`}
                    disabled={isMyTurn && phase === 'PLAYING' ? !legalIds.includes(card.id) : false}
                    selected={selectedCard === card.id}
                    onClick={() => handleCardClick(card.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        }
      />
    </>
  );
}
