import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Player, legalPlays, SUIT_ORDER, RANK_ORDER, highestLedSuitPlayer } from 'shared';
import { useThosoStore } from '../store/thosoStore';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';
import { ordinal } from '../format';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useCopyInvite } from '../hooks/useCopyInvite';
import { useJoinViaLinkRedirect } from '../hooks/useJoinViaLinkRedirect';
import { CardView } from '../components/CardView';
import { Announcement } from '../components/Announcement';
import { StandingsTable } from '../components/StandingsTable';
import { ThosoPlayerChip } from '../components/ThosoPlayerChip';
import { ThosoCardStack } from '../components/ThosoCardStack';
import { Surface } from '../components/Surface';
import { Button } from '../components/Button';
import { QuickMessages } from '../components/QuickMessages';
import { Icon } from '../components/Icon';
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
  const { playerId, roomId, reset } = useGameStore();
  const error = useGameStore(s => s.error);
  const navigate = useNavigate();
  const { game = 'thoso', roomId: urlRoomId } = useParams<{ game: string; roomId: string }>();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const pendingTargetRef = useRef<string | null>(null);

  // Null-safe turn primitives so all hooks run before any early return.
  const phase = state?.phase ?? 'LOBBY';
  const currentTurn = state?.currentTurn ?? null;
  const drawnCardId = state?.drawnCard?.id ?? null;

  const countdownSecs = useSecondsRemaining(state?.countdownMs ?? null);
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

  // Fresh/stale visitor to a room link → stash the code and bounce home to enter a name +
  // join. Shared with Bid Club's LobbyPage: it waits out an in-flight reconnect for THIS
  // room and only redirects on a genuine newcomer or a failed reconnect (fixes a leftover
  // session from a dead/other room stranding the user on "Loading…").
  useJoinViaLinkRedirect(game, urlRoomId);

  // Invite link (null-safe so the copy hook can run before the loading early-return).
  const displayRoomId = roomId ?? state?.roomId ?? '';
  const hostName = state ? (state.players.find(p => p.id === state.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/thoso/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;
  const { copied, copy } = useCopyInvite(joinUrl);

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const isMyTurn = currentTurn === playerId;

  // ── Leave helper ────────────────────────────────────────────────────────────
  const handleLeave = () => {
    sendMsg({ type: 'leaveRoom' });
    storage.clearSession();
    sessionStorage.removeItem(STORAGE_KEYS.pendingRoomId);
    sessionStorage.removeItem(STORAGE_KEYS.pendingHost);
    useThosoStore.getState().reset();
    reset();
    navigate('/', { replace: true });
  };

  const isHost = state.hostId === playerId;

  // ── LOBBY ───────────────────────────────────────────────────────────────────
  if (phase === 'LOBBY') {
    return (
      <div className="page">
        <Surface className="lobby flex-col gap-lg">
          <div className="text-center">
            <h2 className="card-title card-title--md">Waiting Room</h2>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: 3 }}>{displayRoomId}</span>
              <button className="icon-btn" onClick={copy} title="Copy invite link" aria-label="Copy invite link">
                {copied ? <Icon name="check" /> : <Icon name="copy" />}
              </button>
            </div>
            <p className="tag-faint" style={{ marginTop: 4 }}>Share this code or link for others to join</p>
          </div>

          <div className="flex-col gap-sm">
            <p className="hint">Players ({state.players.length}/{state.maxPlayers})</p>
            <ul className="player-list flex-col gap-sm">
              {state.players.map(p => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  {p.id === state.hostId && <span className="host-badge">HOST</span>}
                  {p.id === playerId && <span className="tag-faint">(you)</span>}
                  {p.status === 'reconnecting' && <span className="tag-faint">reconnecting…</span>}
                  {p.status === 'offline' && <span className="tag-faint">disconnected</span>}
                </li>
              ))}
            </ul>
          </div>

          {state.countdownMs != null ? (
            <p className="card-title card-title--sm">Starting in {countdownSecs ?? 0}…</p>
          ) : (
            <p className="text-center muted">Waiting for players ({state.players.length}/{state.maxPlayers})</p>
          )}

          {isHost && (
            <Button variant="primary" block onClick={() => sendMsg({ type: 'startGame' })} disabled={state.players.length < 2}>
              Start Game
            </Button>
          )}
        </Surface>
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
      <div className="winner-page-wrap">
        <Surface className="winner-card">
          <div style={{ fontSize: '3.4rem', lineHeight: 1 }}>🏁</div>
          <h1 className="card-title card-title--lg">Final Standings</h1>

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

          {isHost ? (
            <>
              {closeSecs != null && <p className="tag-faint" style={{ margin: 0 }}>Room closes in {closeSecs}s</p>}
              <Button variant="primary" block onClick={() => sendMsg({ type: 'restartGame' })}>Play Again</Button>
              <Button variant="secondary" block onClick={handleLeave}>Leave</Button>
            </>
          ) : (
            <>
              <p className="hint">Waiting for the host to start a rematch…</p>
              <Button variant="secondary" block onClick={handleLeave}>Leave</Button>
            </>
          )}
        </Surface>
      </div>
    );
  }

  // ── TRANSFER / PLAYING (the game table) ─────────────────────────────────────
  const tablePhase: 'TRANSFER' | 'PLAYING' = phase === 'PLAYING' ? 'PLAYING' : 'TRANSFER';
  const opponents = seatOrderedOpponents(state.players, playerId);
  const me = state.players.find(p => p.id === playerId)!;

  const turnTimeoutMs = state.turnTimeoutMs;
  const turnRemainingMs = state.turnRemainingMs ?? 0;
  const turnExpiresAt = state.turnExpiresAt;
  const timerKey = String(turnExpiresAt ?? 'none');
  const timerRunning = turnExpiresAt != null;

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
  const sortedHand = [...state.yourHand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    return s !== 0 ? s : RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
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

      <div className="game-area">
        <div className="game-panel">
          <div className="table-wrap">

            {/* Opponents around the table */}
            <div className="table-top-row">
              {opponents.map(p => (
                <ThosoPlayerChip
                  key={p.id}
                  player={p}
                  isActive={currentTurn === p.id}
                  finishedRank={rankOf(p.id)}
                  phase={tablePhase}
                  pileTop={state.pileTops[p.id] ?? null}
                  showCardRegion
                  remainingMs={turnRemainingMs}
                  fullMs={turnTimeoutMs}
                  startKey={timerKey}
                  running={timerRunning}
                  selectable={canTargetTransfer && rankOf(p.id) === undefined}
                  reject={rejectId === p.id}
                  onSelect={() => attemptTransfer(p.id)}
                  roundBadge={p.id === roundWinnerId ? roundBadgeText : undefined}
                />
              ))}
            </div>

            {/* Felt centre */}
            <div className="table-middle-row">
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

                  {statusText && <div className="trick-status">{statusText}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* My strip (identity + turn ring + finished/left state) */}
          <div className="my-strip">
            <ThosoPlayerChip
              player={me}
              isMe
              isActive={isMyTurn}
              finishedRank={rankOf(playerId)}
              phase={tablePhase}
              remainingMs={turnRemainingMs}
              fullMs={turnTimeoutMs}
              startKey={timerKey}
              running={timerRunning}
              roundBadge={playerId === roundWinnerId ? roundBadgeText : undefined}
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
          </div>

          {/* My area — pile top (Phase 1) or fanned hand (Phase 2) */}
          {tablePhase === 'TRANSFER' ? (
            <div className="hand-area">
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
            </div>
          ) : (
            <div className="hand-area">
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
