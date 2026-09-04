import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { legalPlays, highestLedSuitPlayer } from 'shared';
import { useThosoStore } from '../store/thosoStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { sortHand, seatOrderedOpponents } from '../format';
import { useUrgentTurn } from '../hooks/useUrgentTurn';
import { CardView } from './CardView';
import { Announcement } from './Announcement';
import { PlayerChip } from './PlayerChip';
import { GameTable } from './GameTable';
import { ThosoCardStack } from './ThosoCardStack';
import { Button } from './Button';
import { QuickMessages } from './QuickMessages';
import '../styles/thoso.css';

/**
 * ThosoTable — the TRANSFER/PLAYING game board. Prop-less: reads its own store
 * (mirrors BidBaazi's GamePage). Rendered by ThosoRoomPage once the phase leaves
 * LOBBY and before GAME_OVER.
 */
export function ThosoTable() {
  const { state } = useThosoStore();
  const { playerId } = useSessionStore();
  const error = useSessionStore(s => s.error);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const pendingTargetRef = useRef<string | null>(null);

  // Null-safe turn primitives so all hooks run before any early return.
  const phase = state?.phase ?? 'LOBBY';
  const currentTurn = state?.currentTurn ?? null;
  const drawnCardId = state?.drawnCard?.id ?? null;
  const turnRemainingMs = state?.turnRemainingMs ?? 0;
  const turnExpiresAt = state?.turnExpiresAt ?? null;
  const timerKey = String(turnExpiresAt ?? 'none');
  const timerRunning = turnExpiresAt != null;

  // Drop the transfer selection whenever the turn, the drawn card, or the phase changes.
  useEffect(() => { setSelectedCardId(null); }, [currentTurn, drawnCardId, phase]);

  // An error while a transfer is pending = an illegal transfer → shake that target chip.
  useEffect(() => {
    if (!error) return;
    const target = pendingTargetRef.current;
    if (!target) return;
    setRejectId(target);
    pendingTargetRef.current = null;
    const t = setTimeout(() => setRejectId(null), 350);
    return () => clearTimeout(t);
  }, [error]);

  // Near-timeout escalation — flag the turn "urgent" once the live countdown drops below
  // URGENT_LEAD_MS so the status line can flash. Only on a live turn (turnExpiresAt != null).
  const urgent = useUrgentTurn(
    timerKey,
    timerRunning,
    turnRemainingMs,
    (phase === 'TRANSFER' || phase === 'PLAYING') && !!currentTurn,
  );

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const isMyTurn = currentTurn === playerId;
  const tablePhase: 'TRANSFER' | 'PLAYING' = phase === 'PLAYING' ? 'PLAYING' : 'TRANSFER';
  const opponents = seatOrderedOpponents(state.players, playerId);
  const me = state.players.find(p => p.id === playerId)!;

  const turnTimeoutMs = state.turnTimeoutMs;

  const rankOf = (id: string) => state.finishedRanks.find(f => f.playerId === id)?.rank;

  const ann = state.announcement;

  const myPileTop = state.pileTops[playerId] ?? null;
  const drawnCard = state.drawnCard;

  // Transfer: tap my pile top or the drawn card to select a source (toggle off on re-tap).
  const selectSource = (cardId: string) => {
    if (!isMyTurn || tablePhase !== 'TRANSFER') return;
    setSelectedCardId(prev => (prev === cardId ? null : cardId));
  };

  // Transfer: with a source selected, tapping an opponent chip fires the transfer.
  const attemptTransfer = (toPlayerId: string) => {
    if (!selectedCardId) return;
    pendingTargetRef.current = toPlayerId;
    sendMsg({ type: 'thosoTransfer', cardId: selectedCardId, toPlayerId });
    setSelectedCardId(null);
  };

  // Phase-2 double-tap: first tap raises the card, a second tap on it plays it.
  const legalIds = isMyTurn && tablePhase === 'PLAYING'
    ? legalPlays(state.yourHand, state.ledSuit, state.mustLeadAceOfSpades).map(c => c.id)
    : [];

  // Phase-2 hand shown suit-grouped (♠♥♣♦) then rank 2→A. legalIds is id-based and
  // layoutId keeps framer-motion animations correct regardless of render order.
  const sortedHand = sortHand(state.yourHand);
  const playCard = (cardId: string) => {
    if (!isMyTurn || tablePhase !== 'PLAYING' || !legalIds.includes(cardId)) return;
    if (selectedCardId === cardId) {
      sendMsg({ type: 'thosoPlay', cardId });
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const activeName = currentTurn ? (state.players.find(p => p.id === currentTurn)?.name ?? '') : '';
  const statusText = isMyTurn ? 'Your turn' : (currentTurn ? `Waiting for ${activeName}…` : '');

  const canTargetTransfer = isMyTurn && tablePhase === 'TRANSFER' && selectedCardId != null;

  // While a completed Phase-2 round is held on screen, highlight who won it — they
  // lead next, or pick the trick up on a thoso (an off-suit card was played).
  const roundWinnerId = state.roundResolving && state.ledSuit ? highestLedSuitPlayer(state.currentTrick, state.ledSuit) : null;
  const wasThoso = state.roundResolving && state.ledSuit ? state.currentTrick.some(tc => tc.card.suit !== state.ledSuit) : false;
  const roundBadgeText = wasThoso ? 'Picks up' : 'Leads';

  return (
    <>
      <Announcement announcement={ann} />
      {state.penaltyReveal && state.penaltyReveal.length > 0 && (
        <div className="thoso-penalty-reveal">
          <span className="thoso-penalty-reveal__label">
            Penalty +{state.penaltyReveal.length} — cards added to your pile
          </span>
          <div className="thoso-penalty-reveal__cards">
            {state.penaltyReveal.map(c => (
              <CardView key={c.id} card={c} />
            ))}
          </div>
        </div>
      )}

      <GameTable
        opponents={opponents.map(p => {
          const rank = rankOf(p.id);
          const finished = rank !== undefined;
          return (
            <PlayerChip
              key={p.id}
              player={p}
              isActive={currentTurn === p.id}
              showTimer={currentTurn === p.id && !finished}
              finishedRank={rank}
              remainingMs={turnRemainingMs}
              fullMs={turnTimeoutMs}
              startKey={timerKey}
              running={timerRunning}
              selectable={canTargetTransfer && rank === undefined}
              reject={rejectId === p.id}
              onSelect={() => attemptTransfer(p.id)}
              roundBadge={p.id === roundWinnerId ? roundBadgeText : undefined}
              info={!finished && tablePhase === 'TRANSFER'
                ? <div className="thoso-chip__region"><ThosoCardStack card={state.pileTops[p.id] ?? null} size="sm" /></div>
                : null}
            />
          );
        })}
        center={
          <div className="trick-area">
            <div className="trick-felt">
              <div className="felt-watermark">
                <div className="felt-watermark__suits">♠ ♥ ♦ ♣</div>
                <div className="felt-watermark__title">THOSO</div>
                <div className="felt-watermark__flourish">✦&nbsp;&nbsp;❦&nbsp;&nbsp;✦</div>
              </div>

              {tablePhase === 'TRANSFER' ? (
                <div className="thoso-center">
                  <div className="thoso-drawpile-wrap">
                    <span className="thoso-drawn__label">Draw pile</span>
                    <div className="thoso-drawpile" aria-label={`${state.drawPileCount} cards left`}>
                      <span className="thoso-drawpile__count">{state.drawPileCount}</span>
                    </div>
                  </div>

                  {drawnCard && (
                    <div className="thoso-drawn">
                      <span className="thoso-drawn__label">Drawn</span>
                      <ThosoCardStack
                        card={drawnCard}
                        size="md"
                        interactive={isMyTurn}
                        selected={selectedCardId === drawnCard.id}
                        onClick={() => selectSource(drawnCard.id)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="thoso-play-area">
                  <div className="thoso-trick">
                    <AnimatePresence>
                      {state.currentTrick.map(({ playerId: pid, card }) => (
                        <div key={`${pid}-${card.id}`} className="trick-card-slot">
                          <span className="trick-card-slot__name">
                            {state.players.find(p => p.id === pid)?.name ?? ''}
                          </span>
                          <CardView card={card} played layoutId={`card-${card.id}`} />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {statusText && <div className={`trick-status${urgent ? ' trick-status--urgent' : ''}`}>{statusText}</div>}
            </div>
          </div>
        }
        myStrip={
          <>
            <PlayerChip
              player={me}
              isMe
              isActive={isMyTurn}
              showTimer={isMyTurn && rankOf(playerId) === undefined}
              finishedRank={rankOf(playerId)}
              remainingMs={turnRemainingMs}
              fullMs={turnTimeoutMs}
              startKey={timerKey}
              running={timerRunning}
              roundBadge={playerId === roundWinnerId ? roundBadgeText : undefined}
              info={null}
            />
            {tablePhase === 'TRANSFER' && isMyTurn && !selectedCardId && (
              <span className="tag-faint">Tap your card, then an opponent to transfer — or Draw</span>
            )}
            {tablePhase === 'TRANSFER' && selectedCardId && (
              <span className="tag-faint">Tap an opponent to transfer</span>
            )}
            {tablePhase === 'PLAYING' && selectedCardId && (
              <span className="tag-faint">Tap again to play</span>
            )}
            {tablePhase === 'PLAYING' && isMyTurn && state.mustLeadAceOfSpades && (
              <span className="tag-faint">Play the Ace of Spades ♠A to start</span>
            )}
            <QuickMessages />
          </>
        }
        hand={
          tablePhase === 'TRANSFER' ? (
            <div className="thoso-my-pile">
              <span className="thoso-my-pile__label">Your pile</span>
              <div className="thoso-my-pile__row">
                <ThosoCardStack
                  card={myPileTop}
                  size="md"
                  interactive={isMyTurn}
                  selected={selectedCardId === myPileTop?.id}
                  onClick={() => myPileTop && selectSource(myPileTop.id)}
                />
                {isMyTurn && tablePhase === 'TRANSFER' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="thoso-draw-btn"
                    onClick={() => sendMsg({ type: 'thosoDraw' })}
                  >
                    Draw
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="thoso-hand-scroll">
              <div className="hand-cards">
                <AnimatePresence>
                  {sortedHand.map(card => (
                    <CardView
                      key={card.id}
                      card={card}
                      layoutId={`card-${card.id}`}
                      disabled={isMyTurn ? !legalIds.includes(card.id) : false}
                      selected={selectedCardId === card.id}
                      onClick={() => playCard(card.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )
        }
      />
    </>
  );
}
