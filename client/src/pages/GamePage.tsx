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
import { Popup } from '../components/Popup';
import { RoundResultOverlay } from '../components/RoundResultOverlay';

// ─── Suit helpers ─────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUIT_NAME:   Record<string, string> = { D: 'Diamonds', C: 'Clubs', H: 'Hearts', S: 'Spades' };
const RED_SUITS = new Set<Suit>(['D', 'H']);

// ─── GamePage ─────────────────────────────────────────────────────────────────

export function GamePage() {
  const { gameState, playerId, lastRoundResult } = useGameStore();
  const prevTurnRef = useRef<string>('');
  const turnSeqRef = useRef(0);
  const prevTrickEmptyRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  if (!gameState || !playerId) {
    return <div className="page"><p>Loading game…</p></div>;
  }

  const {
    phase, round, trump, yourHand, bids,
    currentTurn, currentTrick, players, tricksWon,
  } = gameState;

  const isMyTurn = currentTurn === playerId;
  const myBid    = bids[playerId] ?? null;
  const myWon    = tricksWon[playerId] ?? 0;
  const leadSuit: Suit | null = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // Turn key resets timer on every new turn (sequence-based)
  const trickEmpty = currentTrick.length === 0;
  if (currentTurn && (currentTurn !== prevTurnRef.current || (trickEmpty && !prevTrickEmptyRef.current))) {
    turnSeqRef.current += 1;
    prevTurnRef.current = currentTurn;
    setSelectedCard(null); // reset selection on turn change
  }
  prevTrickEmptyRef.current = trickEmpty;
  const turnKey = String(turnSeqRef.current);

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

  const chipProps = (p: Player) => ({
    player: p,
    bid: bids[p.id] ?? null,
    tricksWon: tricksWon[p.id] ?? 0,
    isActive: currentTurn === p.id,
    phase,
    turnKey,
  });

  const isRedTrump = trump && RED_SUITS.has(trump);

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
              <TrickArea trick={currentTrick} players={players} round={round} status={statusText} />
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
              isMe
            />
            <div className="trump-badge">
              <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Trump</span>
              {trump ? (
                <>
                  <span className={`trump-suit ${isRedTrump ? 'suit-red' : 'suit-black'}`}>{SUIT_SYMBOL[trump]}</span>
                  <span className={isRedTrump ? 'suit-red' : 'suit-black'}>{SUIT_NAME[trump]}</span>
                </>
              ) : (
                <span style={{ fontWeight: 700 }}>No&nbsp;Trump</span>
              )}
            </div>
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
