import { useRef, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Suit, Player } from 'shared';
import { legalMoves, SUIT_ORDER, RANK_ORDER, isHandHiddenForBid } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { getTotal } from '../lib/helpers';
import { CardView } from '../components/CardView';
import { TrickArea } from '../components/TrickArea';
import { BidPanel } from '../components/BidPanel';
import { TrumpPicker } from '../components/TrumpPicker';
import { PlayerChip } from '../components/PlayerChip';
import { Popup } from '../components/Popup';
import { RoundResultOverlay } from '../components/RoundResultOverlay';
import { QuickMessages } from '../components/QuickMessages';
import { Announcement } from '../components/Announcement';
import { PushPanel } from '../components/PushPanel';
import { CoinRushHud } from '../components/CoinRushHud';
import { CoinRushMoments } from '../components/CoinRushMoments';
import { URGENT_LEAD_MS } from '../constants';

// ─── GamePage ─────────────────────────────────────────────────────────────────

export function GamePage() {
  const { gameState, playerId, lastRoundResult } = useGameStore();
  const prevTurnRef = useRef<string>('');
  const prevTrickEmptyRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

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

  useEffect(() => {
    setUrgent(false);
    if (timerRunning && (phase === 'BIDDING' || phase === 'PLAYING' || phase === 'TRUMP_SELECT') && currentTurn) {
      const lead = Math.max(0, turnRemainingMs - URGENT_LEAD_MS);
      const id = setTimeout(() => setUrgent(true), lead);
      return () => clearTimeout(id);
    }
  }, [timerKey, timerRunning, turnRemainingMs, phase, currentTurn]);

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
  const sortedHand = [...yourHand].sort((a, b) => {
    const si = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    return si !== 0 ? si : RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });

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

  const chipProps = (p: Player) => ({
    player: p,
    bid: bids[p.id] ?? null,
    tricksWon: tricksWon[p.id] ?? 0,
    isActive: currentTurn === p.id,
    phase,
    remainingMs: turnRemainingMs,
    fullMs: turnTimeoutMs,
    startKey: timerKey,
    running: timerRunning,
    totalScore: getTotal(scoreboard, p.id),
    pushChoice: gameState.pushStatus?.[p.id],
  });

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

      {/* Coin Rush moments: jackpot-claim celebration + bust-out banners */}
      {gameState.currency && (
        <CoinRushMoments currency={gameState.currency} players={players} />
      )}

      {/* Round result popup */}
      <RoundResultOverlay result={lastRoundResult} visible={phase === 'ROUND_SCORING'} />

      {/* Push popup — Blind Bid: lock (×2) or push (×3) after the hand is revealed */}
      <Popup visible={phase === 'PUSH' && !pushDecided} title="Lock or Push?">
        <PushPanel
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
        <BidPanel round={round!} remainingMs={turnRemainingMs} fullMs={turnTimeoutMs} startKey={timerKey} running={timerRunning} />
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
        <TrumpPicker
          remainingMs={turnRemainingMs}
          fullMs={turnTimeoutMs}
          startKey={timerKey}
          running={timerRunning}
          limited={mode === 'upDown'}
        />
      </Popup>

      <div className="game-area">
        {/* ── Full-width Game panel ─────────────────────────── */}
        <div className="game-panel">

          {/* ── Coin Rush HUD: pot + jackpot + per-seat chip stacks ─── */}
          {gameState.currency && (
            <CoinRushHud currency={gameState.currency} players={players} playerId={playerId} />
          )}

          {/* ── Table with players around it ─── */}
          <div className="table-wrap">

            {/* Opponents in one horizontal row */}
            <div className="table-top-row">
              {opponents.map(p => (
                <PlayerChip key={p.id} {...chipProps(p)} />
              ))}
            </div>

            {/* Middle: trick area */}
            <div className="table-middle-row">
              <TrickArea trick={currentTrick} players={players} round={round} status={statusText} trumpConfig={trumpConfig} urgent={urgent} mode={mode} />
            </div>
          </div>

          {/* ── My status strip ─── */}
          <div className="my-strip">
            <PlayerChip
              player={players.find(p => p.id === playerId)!}
              bid={myBid}
              tricksWon={myWon}
              isActive={isMyTurn}
              phase={phase}
              remainingMs={turnRemainingMs}
              fullMs={turnTimeoutMs}
              startKey={timerKey}
              running={timerRunning}
              totalScore={getTotal(scoreboard, playerId)}
              pushChoice={gameState.pushStatus?.[playerId]}
              isMe
            />
            {selectedCard && (
              <span className="tag-faint" style={{ marginLeft: 8 }}>
                Tap again to play
              </span>
            )}
            <QuickMessages />
          </div>

          {/* ── My hand ─── */}
          <div className="hand-area">
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
          </div>
        </div>
      </div>
    </>
  );
}
