import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Player, legalPlays, highestLedSuitPlayer, GAMES } from 'shared';
import { useThosoStore } from '../store/thosoStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { ordinal, sortHand } from '../format';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useJoinViaLinkRedirect } from '../hooks/useJoinViaLinkRedirect';
import { useLeaveRoom } from '../hooks/useLeaveRoom';
import { useUrgentTurn } from '../hooks/useUrgentTurn';
import { CardView } from '../components/CardView';
import { Announcement } from '../components/Announcement';
import { StandingsTable } from '../components/StandingsTable';
import { PlayerChip } from '../components/PlayerChip';
import { GameTable } from '../components/GameTable';
import { ThosoCardStack } from '../components/ThosoCardStack';
import { Button } from '../components/Button';
import { QuickMessages } from '../components/QuickMessages';
import { RoomSettings } from '../components/RoomSettings';
import { Lobby } from '../components/Lobby';
import { GameOver } from '../components/GameOver';
import '../styles/thoso.css';

/** Opponents in clockwise seat order starting just after me. */
function seatOrderedOpponents(players: Player[], playerId: string): Player[] {
  const me = players.find(p => p.id === playerId);
  if (!me) return players.filter(p => p.id !== playerId);
  const n = players.length;
  const out: Player[] = [];
  for (let i = 1; i < n; i++) {
    const seatIdx = (me.seatIndex + i) % n;
    const opp = players.find(p => p.seatIndex === seatIdx);
    if (opp) out.push(opp);
  }
  return out;
}

export function ThosoRoomPage() {
  const { state } = useThosoStore();
  const { playerId, roomId } = useSessionStore();
  const error = useSessionStore(s => s.error);
  const roomClosed = useSessionStore(s => s.roomClosed);
  const leaveRoom = useLeaveRoom();
  const { game = 'thoso', roomId: urlRoomId } = useParams<{ game: string; roomId: string }>();

  // Player-count upper bound comes from the game registry (Thoso = 6).
  const maxAllowed = GAMES.find(g => g.id === game)?.maxPlayers ?? 6;

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const pendingTargetRef = useRef<string | null>(null);

  // Null-safe turn primitives so all hooks run before any early return.
  const phase = state?.phase ?? 'LOBBY';
  const currentTurn = state?.currentTurn ?? null;
  const drawnCardId = state?.drawnCard?.id ?? null;

  // Null-safe turn-timer primitives (also consumed by the urgent effect below).
  const turnRemainingMs = state?.turnRemainingMs ?? 0;
  const turnExpiresAt = state?.turnExpiresAt ?? null;
  const timerKey = String(turnExpiresAt ?? 'none');
  const timerRunning = turnExpiresAt != null;

  const closeSecs = useSecondsRemaining(state?.roomExpiresInMs ?? null);

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

  // Near-timeout escalation — mirror GamePage: flag the turn "urgent" once the live
  // countdown drops below URGENT_LEAD_MS so the status line can flash. Reset (and only
  // re-armed) on a live turn; never during the round-hold (turnExpiresAt == null).
  const urgent = useUrgentTurn(
    timerKey,
    timerRunning,
    turnRemainingMs,
    (phase === 'TRANSFER' || phase === 'PLAYING') && !!currentTurn,
  );

  // Fresh/stale visitor to a room link → stash the code and bounce home to enter a name +
  // join. Shared with BidBaazi's LobbyPage: it waits out an in-flight reconnect for THIS
  // room and only redirects on a genuine newcomer or a failed reconnect (fixes a leftover
  // session from a dead/other room stranding the user on "Loading…").
  useJoinViaLinkRedirect(game, urlRoomId);

  // Invite link.
  const displayRoomId = roomId ?? state?.roomId ?? '';
  const hostName = state ? (state.players.find(p => p.id === state.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/thoso/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const isMyTurn = currentTurn === playerId;

  // ── Leave helper ────────────────────────────────────────────────────────────
  const handleLeave = leaveRoom;

  const isHost = state.hostId === playerId;

  // ── LOBBY ───────────────────────────────────────────────────────────────────
  if (phase === 'LOBBY') {
    return (
      <div className="page">
        <Lobby
          players={state.players}
          hostId={state.hostId}
          playerId={playerId}
          maxPlayers={state.maxPlayers}
          displayRoomId={displayRoomId}
          joinUrl={joinUrl}
          countdownMs={state.countdownMs ?? null}
          isHost={isHost}
          onStart={() => sendMsg({ type: 'startGame' })}
          settings={
            <RoomSettings
              maxPlayers={state.maxPlayers}
              minPlayers={2}
              maxAllowed={maxAllowed}
              showModes={false}
              mode={'classic'}
              onCommitMaxPlayers={(n) => sendMsg({ type: 'updateRoomSettings', maxPlayers: n })}
              onSelectMode={() => {}}
            />
          }
        />
      </div>
    );
  }

  // ── GAME_OVER ─────────────────────────────────────────────────────────────
  if (phase === 'GAME_OVER') {
    const nameOf = (id: string) => state.players.find(p => p.id === id)?.name ?? id;
    const ranked = [...state.finishedRanks].sort((a, b) => a.rank - b.rank);
    // Defensive: append anyone the server didn't rank (they'd be the last / loser).
    const rankedIds = new Set(ranked.map(r => r.playerId));
    const trailing = state.players.filter(p => !rankedIds.has(p.id));
    const rows = [
      ...ranked.map(r => ({ id: r.playerId, rank: r.rank })),
      ...trailing.map((p, i) => ({ id: p.id, rank: ranked.length + i + 1 })),
    ];
    const lastRank = rows.length;

    return (
      <GameOver
        icon={<div style={{ fontSize: '3.4rem', lineHeight: 1 }}>🏁</div>}
        headline="Final Standings"
        standings={
          <StandingsTable variant="lr">
            <thead>
              <tr><th>Rank</th><th>Player</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isLoser = r.rank === lastRank;
                return (
                  <tr key={r.id} className={r.rank === 1 ? 'row-highlight' : undefined}>
                    <td>
                      {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                      {ordinal(r.rank)}
                      {isLoser && <span className="tag-faint" style={{ marginLeft: 6 }}>(loser)</span>}
                    </td>
                    <td className={r.id === playerId ? 'cell-me' : undefined}>
                      {nameOf(r.id)}
                      {r.id === playerId && <span className="tag-faint" style={{ marginLeft: 5 }}>(you)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </StandingsTable>
        }
        isHost={isHost}
        roomClosed={roomClosed}
        secsLeft={closeSecs}
        onRematch={() => sendMsg({ type: 'restartGame' })}
        onLeave={handleLeave}
        onBackHome={handleLeave}
      />
    );
  }

  // ── TRANSFER / PLAYING (the game table) ─────────────────────────────────────
  const tablePhase: 'TRANSFER' | 'PLAYING' = phase === 'PLAYING' ? 'PLAYING' : 'TRANSFER';
  const opponents = seatOrderedOpponents(state.players, playerId);
  const me = state.players.find(p => p.id === playerId)!;

  // turnRemainingMs / turnExpiresAt / timerKey / timerRunning are computed null-safely
  // above (before the early return) so the urgent effect can consume them.
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
