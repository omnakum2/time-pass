import { useRef, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Suit, Player } from 'shared';
import { legalMoves } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { CardView } from '../components/CardView';
import { TrickArea } from '../components/TrickArea';
import { BidPanel } from '../components/BidPanel';
import { PlayerChip } from '../components/PlayerChip';
import { Popup } from '../components/Popup';
import { RoundResultOverlay } from '../components/RoundResultOverlay';
import { QuickMessages } from '../components/QuickMessages';

// ─── GamePage ─────────────────────────────────────────────────────────────────

export function GamePage() {
  const { gameState, playerId, lastRoundResult } = useGameStore();
  const prevTurnRef = useRef<string>('');
  const turnSeqRef = useRef(0);
  const prevTrickEmptyRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  // Derived turn values — computed null-safely so all hooks run before any early return
  const phase = gameState?.phase ?? '';
  const currentTurn = gameState?.currentTurn ?? null;
  const turnTimeoutMs = gameState?.turnTimeoutMs ?? 0;
  const currentTrick = gameState?.currentTrick ?? [];

  // Turn key resets timer on every new turn (sequence-based)
  const trickEmpty = currentTrick.length === 0;
  if (currentTurn && (currentTurn !== prevTurnRef.current || (trickEmpty && !prevTrickEmptyRef.current))) {
    turnSeqRef.current += 1;
    prevTurnRef.current = currentTurn;
    setSelectedCard(null); // reset selection on turn change
  }
  prevTrickEmptyRef.current = trickEmpty;
  const turnKey = String(turnSeqRef.current);

  useEffect(() => {
    setUrgent(false);
    if ((phase === 'BIDDING' || phase === 'PLAYING') && currentTurn) {
      const lead = Math.max(0, turnTimeoutMs - 6000);
      const id = setTimeout(() => setUrgent(true), lead);
      return () => clearTimeout(id);
    }
  }, [turnKey, turnTimeoutMs, phase, currentTurn]);

  if (!gameState || !playerId) {
    return <div className="page"><p>Loading game…</p></div>;
  }

  const {
    round, trump, yourHand, bids,
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
  const SUIT_ORDER = ['S', 'H', 'D', 'C'];
  const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
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

  const getTotal = (id: string) => {
    const rows = scoreboard[id] ?? [];
    return rows.length > 0 ? rows[rows.length - 1].total : 0;
  };

  const chipProps = (p: Player) => ({
    player: p,
    bid: bids[p.id] ?? null,
    tricksWon: tricksWon[p.id] ?? 0,
    isActive: currentTurn === p.id,
    phase,
    turnKey,
    timerMs: turnTimeoutMs,
    totalScore: getTotal(p.id),
  });

  const blindHidden = mode === 'blind' && (phase === 'BIDDING' || phase === 'DEALING');

  const activeName = currentTurn ? (players.find(p => p.id === currentTurn)?.name ?? '') : '';
  const statusText = phase === 'BIDDING'
    ? (isMyTurn ? 'Place your bid' : (currentTurn ? `Waiting for ${activeName} to bid…` : ''))
    : phase === 'PLAYING'
    ? (isMyTurn ? 'Your turn' : (currentTurn ? `Waiting for ${activeName}…` : ''))
    : '';

  return (
    <>
      {/* Round result popup */}
      <RoundResultOverlay result={lastRoundResult} visible={phase === 'ROUND_SCORING'} />

      {/* Bid popup — shown when it's MY turn to bid */}
      <Popup
        visible={phase === 'BIDDING' && isMyTurn}
        title={`Round ${round} · How many tricks will you win?`}
      >
        <BidPanel round={round!} turnKey={turnKey} durationMs={turnTimeoutMs} />
      </Popup>

      <div className="game-area">
        {/* ── Full-width Game panel ─────────────────────────── */}
        <div className="game-panel">

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
              <TrickArea trick={currentTrick} players={players} round={round} status={statusText} trump={trump} urgent={urgent} mode={mode} />
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
              turnKey={turnKey}
              timerMs={turnTimeoutMs}
              totalScore={getTotal(playerId)}
              isMe
            />
            {selectedCard && (
              <span style={{ fontSize: '0.8rem', opacity: 0.75, marginLeft: 8 }}>
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
