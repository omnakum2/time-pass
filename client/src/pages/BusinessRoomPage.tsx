import { useParams } from 'react-router-dom';
import { GAMES } from 'shared';
import { useBusinessStore } from '../store/businessStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { ordinal } from '../format';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useJoinViaLinkRedirect } from '../hooks/useJoinViaLinkRedirect';
import { useLeaveRoom } from '../hooks/useLeaveRoom';
import { StandingsTable } from '../components/StandingsTable';
import { RoomSettings } from '../components/RoomSettings';
import { Lobby } from '../components/Lobby';
import { GameOver } from '../components/GameOver';
import { BusinessTable } from '../components/BusinessTable';

/**
 * BusinessRoomPage — the Business in-room root (the descriptor's RoomRoot). A thin
 * phase switcher mirroring ThosoRoomPage: LOBBY → <Lobby>, GAME_OVER → <GameOver>,
 * otherwise the game board <BusinessTable/>. The board body lives in BusinessTable.
 */
export function BusinessRoomPage() {
  const { state } = useBusinessStore();
  const { playerId, roomId } = useSessionStore();
  const roomClosed = useSessionStore(s => s.roomClosed);
  const leaveRoom = useLeaveRoom();
  const { game = 'business', roomId: urlRoomId } = useParams<{ game: string; roomId: string }>();

  // Player-count upper bound comes from the game registry (Business = 4).
  const maxAllowed = GAMES.find(g => g.id === game)?.maxPlayers ?? 4;

  const closeSecs = useSecondsRemaining(state?.roomExpiresInMs ?? null);

  // Fresh/stale visitor to a room link → stash the code and bounce home to enter a name +
  // join (shared with BidBaazi/Thoso's LobbyPage; waits out an in-flight reconnect for THIS room).
  useJoinViaLinkRedirect(game, urlRoomId);

  // Invite link.
  const displayRoomId = roomId ?? state?.roomId ?? '';
  const hostName = state ? (state.players.find(p => p.id === state.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/business/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const handleLeave = leaveRoom;
  const isHost = state.hostId === playerId;
  const phase = state.phase;

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
    // Phase-1 ranking: richest surviving player first; bankrupt players trail (worst).
    const bankruptSet = new Set(state.bankrupt);
    const survivors = state.players
      .filter(p => !bankruptSet.has(p.id))
      .sort((a, b) => (state.cash[b.id] ?? 0) - (state.cash[a.id] ?? 0));
    // Bankrupt players keep their elimination order (earliest out = worst rank).
    const eliminated = state.bankrupt
      .map(id => state.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .reverse();
    const rows = [...survivors, ...eliminated].map((p, i) => ({ id: p.id, rank: i + 1 }));
    const lastRank = rows.length;

    return (
      <GameOver
        icon={<div style={{ fontSize: '3.4rem', lineHeight: 1 }}>🏢</div>}
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

  // ── ROLLING / BUYING (the game board) ───────────────────────────────────────
  return <BusinessTable />;
}
