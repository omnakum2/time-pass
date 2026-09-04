import { useParams } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { useBidBaaziStore } from '../store/bidbaaziStore';
import { storage } from '../storage';
import { useJoinViaLinkRedirect } from '../hooks/useJoinViaLinkRedirect';
import { sendMsg } from '../net/socket';
import { Lobby } from '../components/Lobby';
import { RoomSettings } from '../components/RoomSettings';
import { GAME_MODES } from 'shared';

export function LobbyPage() {
  const { roomId: urlRoomId, game = 'bidbaazi' } = useParams<{ roomId: string; game: string }>();
  const gameState = useBidBaaziStore((s) => s.state);
  const { playerId, roomId, reconnectFailed } = useSessionStore();

  // Someone landing directly on /:game/room/:id without being in the room → stash the
  // code and bounce home to enter a name + join (waits out an in-flight reconnect).
  useJoinViaLinkRedirect(game, urlRoomId);

  // Locally tick down the countdown coming from the server.
  const countdownMs = gameState?.countdownMs ?? null;

  // Invite link.
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const hostName = gameState ? (gameState.players.find(p => p.id === gameState.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/${game}/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  if (!gameState || !playerId) {
    const s = storage.getSession();
    const reconnectingHere = !reconnectFailed && s?.roomId?.toUpperCase() === urlRoomId?.toUpperCase();
    return (
      <div className="page">
        <p>{reconnectingHere ? 'Reconnecting…' : 'Joining room…'}</p>
      </div>
    );
  }

  const { players, hostId } = gameState;
  const isHost = hostId === playerId;

  // The invite link only works for other people if the app is being served from a
  // routable address. On localhost the link points at the recipient's own machine.
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

  const modeLabel = GAME_MODES.find(m => m.id === gameState.mode)?.label ?? '';

  return (
    <div className="page">
      <Lobby
        players={players}
        hostId={hostId}
        playerId={playerId}
        maxPlayers={gameState.maxPlayers}
        displayRoomId={displayRoomId}
        joinUrl={joinUrl}
        countdownMs={countdownMs}
        isHost={isHost}
        onStart={() => sendMsg({ type: 'startGame' })}
        badge={modeLabel ? (
          <div style={{ marginTop: 6 }}>
            <span className="mode-badge">{modeLabel}</span>
          </div>
        ) : null}
        settings={
          <RoomSettings
            maxPlayers={gameState.maxPlayers}
            minPlayers={Math.max(2, players.length)}
            mode={gameState.mode}
            onCommitMaxPlayers={(n) => sendMsg({ type: 'updateRoomSettings', maxPlayers: n })}
            onSelectMode={(m) => sendMsg({ type: 'updateRoomSettings', mode: m })}
          />
        }
        nonHostInfo={
          <p className="text-center muted">
            {modeLabel} · Players: {players.length} / {gameState.maxPlayers}
          </p>
        }
      />
    </div>
  );
}
