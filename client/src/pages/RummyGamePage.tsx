import { useEffect, useRef, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MeldKind, MELD_KINDS, MELD_SIZE, RummyGroups, RummyCard,
  validateDeclare, SUIT_ORDER, rankValue,
} from 'shared';
import { sendMsg } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { useRummyStore } from '../store/rummyStore';
import { storage } from '../storage';
import { CardView } from '../components/CardView';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Surface } from '../components/Surface';
import { MeldZone } from '../components/rummy/MeldZone';
import { RummyPlayerSeat } from '../components/rummy/RummyPlayerSeat';
import { RummyStandings } from '../components/rummy/RummyStandings';

const MELD_LABELS: Record<MeldKind, string> = {
  pure4: 'Pure Sequence (4)',
  pure3: 'Pure Sequence (3)',
  impure3: 'Impure Sequence (3)',
  set3: 'Set (3)',
};

const EMPTY_GROUPS: RummyGroups = { pure4: [], pure3: [], impure3: [], set3: [] };

// Suit, then rank, so a freshly dealt hand already reads grouped without any
// manual dragging.
function bySuitThenRank(a: RummyCard, b: RummyCard): number {
  const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  return suitDiff !== 0 ? suitDiff : rankValue(a.rank) - rankValue(b.rank);
}

export function RummyGamePage() {
  const playerId = useGameStore(s => s.playerId);
  const gameState = useRummyStore(s => s.gameState);
  const gameOver = useRummyStore(s => s.gameOver);
  const navigate = useNavigate();

  const [groups, setGroups] = useState<RummyGroups>(EMPTY_GROUPS);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // Whether any hand card is mid-drag — highlights the meld zones as drop targets.
  const [isDraggingHandCard, setIsDraggingHandCard] = useState(false);
  // Purely a display order for "Your Hand" — lets you drag cards around to group
  // them visually without that ordering meaning anything to the server.
  const [handOrder, setHandOrder] = useState<string[]>([]);
  // DOM refs to each meld zone, so a hand-card drag can be hit-tested against
  // them on release to drop the card straight into that zone.
  const zoneRefs = useRef<Partial<Record<MeldKind, HTMLDivElement>>>({});
  // DOM refs to each hand-row card, so a drop that misses every zone can still
  // be resolved into a reordered position by comparing against its neighbours.
  const handCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // The selected-to-discard card is only meaningful for the turn it was picked in.
  useEffect(() => {
    setSelectedCardId(null);
  }, [gameState?.currentTurn, gameState?.hasDrawnThisTurn]);

  // Meld arrangements should survive turn changes (yours and everyone else's) —
  // only drop card ids that actually left your hand (discarded, or a brand-new
  // deal replaced the whole hand).
  useEffect(() => {
    const validIds = new Set((gameState?.yourHand ?? []).map(c => c.id));
    setGroups(prev => {
      let changed = false;
      const next = {} as RummyGroups;
      for (const kind of MELD_KINDS) {
        const filtered = prev[kind].filter(id => validIds.has(id));
        if (filtered.length !== prev[kind].length) changed = true;
        next[kind] = filtered;
      }
      return changed ? next : prev;
    });
  }, [gameState?.yourHand]);

  // Keep handOrder in sync with the real hand: drop ids that left, preserve
  // everything else exactly where you put it. A freshly dealt hand (nothing
  // carried over) starts pre-sorted by suit/rank; a single card drawn mid-turn
  // just joins the end so it doesn't disturb an arrangement you're mid-way
  // through building.
  useEffect(() => {
    const hand = gameState?.yourHand ?? [];
    const idSet = new Set(hand.map(c => c.id));
    setHandOrder(prev => {
      const kept = prev.filter(id => idSet.has(id));
      const keptSet = new Set(kept);
      const addedCards = hand.filter(c => !keptSet.has(c.id));
      if (kept.length === 0 && addedCards.length > 1) {
        return [...addedCards].sort(bySuitThenRank).map(c => c.id);
      }
      return [...kept, ...addedCards.map(c => c.id)];
    });
  }, [gameState?.yourHand]);

  const yourHand = gameState?.yourHand ?? [];
  const isMyTurn = gameState?.currentTurn === playerId;
  const assignedIds = new Set(MELD_KINDS.flatMap(k => groups[k]));
  const cardsById = new Map<string, RummyCard>(yourHand.map(c => [c.id, c]));
  const handPool = yourHand.filter(c => !assignedIds.has(c.id));
  const remaining13 = yourHand.filter(c => assignedIds.has(c.id));
  const orderedHandPool = handOrder
    .filter(id => !assignedIds.has(id))
    .map(id => cardsById.get(id))
    .filter((c): c is RummyCard => !!c);

  function reorderHandPool(newPoolOrder: string[]) {
    setHandOrder(prev => {
      const poolIdSet = new Set(newPoolOrder);
      let i = 0;
      return prev.map(id => (poolIdSet.has(id) ? newPoolOrder[i++] : id));
    });
  }

  const canDeclare = !!gameState &&
    isMyTurn && gameState.hasDrawnThisTurn && handPool.length === 1 && remaining13.length === 13 &&
    handPool[0].id !== gameState.justDrawnCardId && !!gameState.trumpCard &&
    validateDeclare(remaining13, groups, gameState.trumpCard, gameState.deckMode);

  // A stable fingerprint of the current arrangement (order-independent within
  // each zone). Used, alongside `canDeclare`, to re-trigger the auto-declare
  // below on any real change to the arrangement — not just on canDeclare's
  // false→true edge. Guards against getting stuck: if a declare attempt is
  // ever rejected (e.g. a stale race) while canDeclare stays continuously
  // true, the boolean alone would never re-fire the effect again, silently
  // stranding a genuinely valid hand with no button left to retry it.
  const groupsSignature = MELD_KINDS.map(k => [...groups[k]].sort().join(',')).join('|');

  // The arrangement is complete and valid the moment the last card lands in a
  // meld — declare right away instead of waiting on a manual button press.
  useEffect(() => {
    if (!canDeclare) return;
    sendMsg({ type: 'declare', cardIdToDiscard: handPool[0].id, groups });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDeclare, groupsSignature]);

  if (!gameState || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const {
    players, hostId, deckMode, trumpCard, handCounts,
    discardTop, currentTurn, hasDrawnThisTurn, justDrawnCardId, ranks,
    turnTimeoutMs, turnRemainingMs, turnExpiresAt, phase,
  } = gameState;

  // Once a player has declared, their arrangement is final — no more rearranging.
  const hasDeclared = ranks[playerId] != null;

  const groupCards = (kind: MeldKind): RummyCard[] =>
    groups[kind].map(id => cardsById.get(id)).filter((c): c is RummyCard => !!c);

  const canDiscard =
    isMyTurn && hasDrawnThisTurn && !!selectedCardId && selectedCardId !== justDrawnCardId &&
    !assignedIds.has(selectedCardId);

  function selectHandCard(id: string) {
    if (hasDeclared) return;
    setSelectedCardId(prev => (prev === id ? null : id));
  }

  function assignCardToZone(cardId: string, kind: MeldKind) {
    if (hasDeclared) return;
    setGroups(prev => {
      if (prev[kind].includes(cardId) || prev[kind].length >= MELD_SIZE[kind]) return prev;
      return { ...prev, [kind]: [...prev[kind], cardId] };
    });
  }

  function assignToZone(kind: MeldKind) {
    if (!selectedCardId) return;
    assignCardToZone(selectedCardId, kind);
    setSelectedCardId(null);
  }

  function removeFromZone(kind: MeldKind, cardId: string) {
    if (hasDeclared) return;
    setGroups(prev => ({ ...prev, [kind]: prev[kind].filter(id => id !== cardId) }));
  }

  // A hand card was dragged and released. info.point is page-relative
  // (includes document scroll); zone/card rects from getBoundingClientRect()
  // are viewport-relative, so shift by scroll first for a fair comparison.
  function handleHandCardDragEnd(cardId: string, info: PanInfo) {
    setIsDraggingHandCard(false);
    if (hasDeclared) return;
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;

    // Dropped on a meld zone — place it there directly.
    for (const kind of MELD_KINDS) {
      const rect = zoneRefs.current[kind]?.getBoundingClientRect();
      if (!rect) continue;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        assignCardToZone(cardId, kind);
        setSelectedCardId(prev => (prev === cardId ? null : prev));
        return;
      }
    }

    // Otherwise, resolve it into a reordered slot within the hand row based on
    // where it landed relative to its neighbours' current midpoints.
    const siblings: { id: string; midX: number }[] = [];
    handCardRefs.current.forEach((el, id) => {
      if (id === cardId) return;
      const rect = el.getBoundingClientRect();
      siblings.push({ id, midX: (rect.left + rect.right) / 2 });
    });
    siblings.sort((a, b) => a.midX - b.midX);
    let insertAt = siblings.findIndex(s => x < s.midX);
    if (insertAt === -1) insertAt = siblings.length;
    const newPoolOrder = siblings.map(s => s.id);
    newPoolOrder.splice(insertAt, 0, cardId);
    reorderHandPool(newPoolOrder);
  }

  function draw(source: 'pile' | 'discard') {
    sendMsg({ type: 'drawCard', source });
  }

  function discard() {
    if (!canDiscard || !selectedCardId) return;
    sendMsg({ type: 'discardCard', cardId: selectedCardId });
  }

  function rematch() {
    sendMsg({ type: 'restartGame' });
  }

  function leave() {
    sendMsg({ type: 'leaveRoom' });
    storage.clearSession();
    navigate('/rummy');
  }

  const isGameOver = phase === 'GAME_OVER';
  const standingsRows = players.map(p => ({
    playerId: p.id,
    name: p.name,
    rank: (gameOver?.ranks[p.id] ?? ranks[p.id]) ?? players.length,
    isMe: p.id === playerId,
  }));

  return (
    <div className="page">
      <Surface className="flex-col gap-md">
        <div className="table-top-row flex-row gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {players.map(p => (
            <RummyPlayerSeat
              key={p.id}
              player={p}
              handCount={p.id === playerId ? yourHand.length : (handCounts[p.id] ?? 0)}
              rank={ranks[p.id] ?? null}
              isActive={currentTurn === p.id}
              isMe={p.id === playerId}
              remainingMs={turnRemainingMs ?? undefined}
              fullMs={turnTimeoutMs}
              startKey={`${p.id}-${turnExpiresAt ?? ''}`}
              expiresAt={turnExpiresAt}
            />
          ))}
        </div>

        <div className="flex-row gap-lg" style={{ justifyContent: 'center', alignItems: 'flex-start' }}>
          <div className="flex-col gap-sm" style={{ alignItems: 'center' }}>
            <p className="tag-faint">Trump</p>
            {trumpCard ? <CardView card={trumpCard} /> : <div className="card" />}
          </div>

          <div className="flex-col gap-sm" style={{ alignItems: 'center' }}>
            <p className="tag-faint">Draw Pile</p>
            <button
              type="button"
              className="card"
              disabled={!isMyTurn || hasDrawnThisTurn}
              onClick={() => draw('pile')}
              aria-label="Draw from pile"
            />
          </div>

          <div className="flex-col gap-sm" style={{ alignItems: 'center' }}>
            <p className="tag-faint">Discard Pile</p>
            {discardTop ? (
              <CardView
                card={discardTop}
                disabled={!isMyTurn || hasDrawnThisTurn}
                onClick={() => draw('discard')}
              />
            ) : (
              <div className="card" />
            )}
          </div>
        </div>

        <div className="flex-row gap-lg" style={{ justifyContent: 'center' }}>
          <Button variant="secondary" disabled={!canDiscard} onClick={discard}>Discard Selected</Button>
        </div>

        <p className="text-center">
          {isGameOver ? 'Game over' : isMyTurn
            ? (hasDrawnThisTurn ? 'Your turn — discard or declare' : 'Your turn — draw a card')
            : `${players.find(p => p.id === currentTurn)?.name ?? '…'}'s turn`}
        </p>

        <div
          className={`meld-zones-row${isDraggingHandCard ? ' meld-zones-row--drop-target' : ''}`}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
            pointerEvents: hasDeclared ? 'none' : undefined, opacity: hasDeclared ? 0.7 : undefined,
          }}
        >
          {MELD_KINDS.map(kind => (
            <div key={kind} ref={el => { zoneRefs.current[kind] = el ?? undefined; }}>
              <MeldZone
                kind={kind}
                label={MELD_LABELS[kind]}
                cards={groupCards(kind)}
                trumpCard={trumpCard}
                deckMode={deckMode}
                onZoneClick={() => assignToZone(kind)}
                onCardClick={(cardId) => removeFromZone(kind, cardId)}
              />
            </div>
          ))}
        </div>

        <div className="flex-col gap-sm">
          <p className="hint">Your Hand</p>
          <div
            className="hand-cards"
            style={{ pointerEvents: hasDeclared ? 'none' : undefined, opacity: hasDeclared ? 0.7 : undefined }}
          >
            {orderedHandPool.map(c => (
              <motion.div
                key={c.id}
                ref={el => {
                  if (el) handCardRefs.current.set(c.id, el);
                  else handCardRefs.current.delete(c.id);
                }}
                layout
                className="hand-card-slot"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                drag
                dragMomentum={false}
                dragSnapToOrigin
                whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: '0 14px 28px rgba(0,0,0,0.55)' }}
                onDragStart={() => setIsDraggingHandCard(true)}
                onDragEnd={(_e, info) => handleHandCardDragEnd(c.id, info)}
              >
                <CardView
                  card={c}
                  layout
                  layoutId={`rummy-card-${c.id}`}
                  selected={selectedCardId === c.id}
                  onClick={() => selectHandCard(c.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </Surface>

      <Modal open={isGameOver} title="Game Over" dismissable={false}>
        <RummyStandings rows={standingsRows} />
        <div className="flex-col gap-sm" style={{ marginTop: 16 }}>
          {playerId === hostId && (
            <Button variant="primary" onClick={rematch}>Rematch</Button>
          )}
          <Button variant="secondary" onClick={leave}>Leave</Button>
        </div>
      </Modal>
    </div>
  );
}
