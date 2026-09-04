import { useParams } from 'react-router-dom';
import { GAMES } from 'shared';
import { useThosoStore } from '../store/thosoStore';
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
import { ThosoTable } from '../components/ThosoTable';

/**
 * ThosoRoomPage — the Thoso in-room root (the descriptor's RoomRoot). A thin phase
 * switcher mirroring BidBaaziRoomRoot: LOBBY → <Lobby>, GAME_OVER → <GameOver>,
 * otherwise the game board <ThosoTable/>. The table body now lives in ThosoTable.
 */
export function ThosoRoomPage() {
  const { state } = useThosoStore();
  const { playerId, roomId } = useSessionStore();
  const roomClosed = useSessionStore(s => s.roomClosed);
  const leaveRoom = useLeaveRoom();
  const { game = 'thoso', roomId: urlRoomId } = useParams<{ game: string; roomId: string }>();

  // Player-count upper bound comes from the game registry (Thoso = 6).
  const maxAllowed = GAMES.find(g => g.id === game)?.maxPlayers ?? 6;

  const closeSecs = useSecondsRemaining(state?.roomExpiresInMs ?? null);

  // Fresh/stale visitor to a room link → stash the code and bounce home to enter a name +
  // join (shared with BidBaazi's LobbyPage; waits out an in-flight reconnect for THIS room).
  useJoinViaLinkRedirect(game, urlRoomId);

  // Invite link.
  const displayRoomId = roomId ?? state?.roomId ?? '';
  const hostName = state ? (state.players.find(p => p.id === state.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/thoso/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

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

  // ── TRANSFER / PLAYING (the game board) ─────────────────────────────────────
  return <ThosoTable />;
}
