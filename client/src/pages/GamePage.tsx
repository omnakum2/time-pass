import { useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Suit, Player } from 'shared';
import { legalMoves } from 'shared';
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { CardView } from '../components/CardView';
import { TrickArea } from '../components/TrickArea';
import { BidPanel } from '../components/BidPanel';
import { PlayerChip } from '../components/PlayerChip';
import { Scoreboard } from '../components/Scoreboard';
import { TurnTimer } from '../components/TurnTimer';
import { Popup } from '../components/Popup';
import { RoundResultOverlay } from '../components/RoundResultOverlay';

// ─── Suit helpers ─────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUIT_NAME:   Record<string, string> = { D: 'Diamonds', C: 'Clubs', H: 'Hearts', S: 'Spades' };
const RED_SUITS = new Set<Suit>(['D', 'H']);

// ─── Player seating helper ────────────────────────────────────────────────────

/**
 * Returns opponents ordered clockwise from me (seat +1, +2, …).
 * Then maps them to visual positions around the table.
 *
 * Positions by opponent count (clockwise from right → top → left):
 *   1 opp  → [top]
 *   2 opps → [top-right, top-left]
 *   3 opps → [right, top, left]
 *   4 opps → [right, top-right, top-left, left]
 *   5 opps → [right, top-right, top, top-left, left]
 *   6 opps → [right, top-right, top-cr, top-cl, top-left, left]
 */

type Zone = 'top' | 'right' | 'left';

const POSITION_ZONES: Record<number, Zone[]> = {
  1: ['top'],
  2: ['top', 'top'],
  3: ['right', 'top', 'left'],
  4: ['right', 'top', 'top', 'left'],
  5: ['right', 'top', 'top', 'top', 'left'],
  6: ['right', 'top', 'top', 'top', 'top', 'left'],
};

interface PlacedOpponent { player: Player; zone: Zone }

function placeOpponents(players: Player[], myId: string): PlacedOpponent[] {
  const me = players.find(p => p.id === myId);
  if (!me) return [];
  const n = players.length;
  const result: PlacedOpponent[] = [];
  for (let i = 1; i < n; i++) {
    const seatIdx = (me.seatIndex + i) % n;
    const opp = players.find(p => p.seatIndex === seatIdx);
    if (opp) result.push({ player: opp, zone: 'top' }); // will assign below
  }
  const zones = POSITION_ZONES[result.length] ?? result.map(() => 'top' as Zone);
  return result.map((r, i) => ({ ...r, zone: zones[i] }));
}

// ─── GamePage ─────────────────────────────────────────────────────────────────

export function GamePage() {
  const { gameState, playerId, lastRoundResult } = useGameStore();
  const prevTurnRef = useRef<string>('');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  if (!gameState || !playerId) {
    return <div className="page"><p>Loading game…</p></div>;
  }

  const {
    phase, round, trump, yourHand, handCounts, bids,
    currentTurn, currentTrick, players, tricksWon,
  } = gameState;

  const isMyTurn = currentTurn === playerId;
  const myBid    = bids[playerId] ?? null;
  const myWon    = tricksWon[playerId] ?? 0;
  const leadSuit: Suit | null = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // Turn key resets timer every time the active player changes
  if (currentTurn && currentTurn !== prevTurnRef.current) {
    prevTurnRef.current = currentTurn;
    setSelectedCard(null); // reset selection on turn change
  }
  const turnKey = prevTurnRef.current;

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

  // Place opponents around the table
  const placed = placeOpponents(players, playerId);
  const topOpps   = placed.filter(p => p.zone === 'top');
  const leftOpps  = placed.filter(p => p.zone === 'left');
  const rightOpps = placed.filter(p => p.zone === 'right');

  const chipProps = (p: Player) => ({
    player: p,
    cardCount: handCounts[p.id] ?? 0,
    bid: bids[p.id] ?? null,
    tricksWon: tricksWon[p.id] ?? 0,
    isActive: currentTurn === p.id,
    phase,
    turnKey,
  });

  const isRedTrump = trump && RED_SUITS.has(trump);

  return (
    <>
      {/* Round result popup */}
      <RoundResultOverlay result={lastRoundResult} visible={phase === 'ROUND_SCORING'} />

      {/* Bid popup — shown when it's MY turn to bid */}
      <Popup
        visible={phase === 'BIDDING' && isMyTurn}
        title={`Round ${round} — How many tricks will you win?`}
      >
        <BidPanel round={round!} turnKey={turnKey} />
      </Popup>

      <div className="game-split">
        {/* ── LEFT: Scoreboard ─────────────────────────────── */}
        <div className="scoreboard-panel">
          <h3>Scoreboard</h3>
          <Scoreboard gameState={gameState} />
        </div>

        {/* ── RIGHT: Game area ──────────────────────────────── */}
        <div className="game-panel">

          {/* Info bar */}
          <div className="info-bar">
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Round {round}</span>
              <span style={{ opacity: 0.55, marginLeft: 8, fontSize: '0.82rem' }}>
                {round} card{round !== 1 ? 's' : ''} each
              </span>
            </div>

            {trump && (
              <div className="trump-badge">
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Trump:</span>
                <span className={`trump-suit ${isRedTrump ? 'suit-red' : 'suit-black'}`}>
                  {SUIT_SYMBOL[trump]}
                </span>
                <span className={isRedTrump ? 'suit-red' : 'suit-black'}>
                  {SUIT_NAME[trump]}
                </span>
              </div>
            )}

            {/* My turn indicator + timer in top bar */}
            {isMyTurn && phase !== 'BIDDING' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '0.9rem' }}>
                  Your turn!
                </span>
                <TurnTimer durationMs={30_000} startKey={turnKey} />
              </div>
            )}
            {isMyTurn && phase === 'BIDDING' && (
              <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '0.9rem' }}>
                Place your bid…
              </span>
            )}
            {!isMyTurn && currentTurn && (
              <span style={{ opacity: 0.55, fontSize: '0.82rem' }}>
                Waiting for {players.find(p => p.id === currentTurn)?.name}…
              </span>
            )}
          </div>

          {/* ── Table with players around it ─── */}
          <div className="table-wrap">

            {/* Top opponents */}
            <div className="table-top-row">
              {topOpps.map(({ player }) => (
                <PlayerChip key={player.id} {...chipProps(player)} />
              ))}
            </div>

            {/* Middle: left | trick | right */}
            <div className="table-middle-row">
              <div className="table-side">
                {leftOpps.map(({ player }) => (
                  <PlayerChip key={player.id} {...chipProps(player)} />
                ))}
              </div>

              <TrickArea trick={currentTrick} players={players} />

              <div className="table-side">
                {rightOpps.map(({ player }) => (
                  <PlayerChip key={player.id} {...chipProps(player)} />
                ))}
              </div>
            </div>
          </div>

          {/* ── My status strip ─── */}
          <div className="my-strip">
            <PlayerChip
              player={players.find(p => p.id === playerId)!}
              cardCount={yourHand.length}
              bid={myBid}
              tricksWon={myWon}
              isActive={isMyTurn}
              phase={phase}
              turnKey={turnKey}
              isMe
            />
            {selectedCard && (
              <span style={{ fontSize: '0.8rem', opacity: 0.75, marginLeft: 8 }}>
                Tap again to play
              </span>
            )}
          </div>

          {/* ── My hand ─── */}
          <div className="hand-area">
            <div className="hand-cards">
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
