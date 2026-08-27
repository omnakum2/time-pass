import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NAME_MIN_LEN, NAME_MAX_LEN, GameMode } from 'shared';
import { sendMsg, reconnectSession } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';
import { RoomSettings } from '../components/RoomSettings';

export function HomePage() {
  const [name, setName] = useState(storage.getPlayer()?.name ?? '');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(7);
  const [mode, setMode] = useState<'landing' | 'create' | 'join'>('landing');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [pendingHost, setPendingHost] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const { connected, roomId, gameState, reconnectFailed } = useGameStore();
  const rejoinAttempt = useRef(false);
  const navigate = useNavigate();
  const { game = 'bid-club' } = useParams();

  // If we arrived here via an invite link (redirected from the lobby), pick up
  // the pending room id + host name and drop straight into the join view.
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem(STORAGE_KEYS.pendingRoomId);
    const host = sessionStorage.getItem(STORAGE_KEYS.pendingHost);
    if (pendingRoomId) {
      setMode('join');
      setRoomCode(pendingRoomId.toUpperCase());
      setPendingHost(host ?? '');
      sessionStorage.removeItem(STORAGE_KEYS.pendingRoomId);
      sessionStorage.removeItem(STORAGE_KEYS.pendingHost);
    }
  }, []);

  // If already in a room, redirect
  if (roomId && gameState) {
    navigate(`/${game}/room/${roomId}`, { replace: true });
  }

  const saveName = useCallback(() => {
    const trimmed = name.trim().slice(0, NAME_MAX_LEN);
    if (!trimmed) return null;
    storage.setPlayer({ name: trimmed });
    return trimmed;
  }, [name]);

  // The actual "send + subscribe-to-navigate" work. Split out from the click
  // handlers so it can be fired immediately (connected) or queued (connecting).
  const fireCreate = useCallback(() => {
    const n = saveName();
    if (!n) return;
    sendMsg({ type: 'createRoom', name: n, game, maxPlayers, mode: gameMode });
    // Navigate will happen when we receive 'joined' + 'state'
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/${game}/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, game, maxPlayers, gameMode, navigate]);

  const fireJoin = useCallback(() => {
    const n = saveName();
    const code = roomCode.trim().toUpperCase();
    if (!n || !code) return;
    const session = storage.getSession();
    if (session && session.roomId.toUpperCase() === code) {
      // We already hold a seat in this room (e.g. the tab was closed) → restore it rather
      // than joining as a newcomer, which a running game would reject with GAME_STARTED.
      rejoinAttempt.current = true;
      reconnectSession(session.roomId, session.token);
    } else {
      sendMsg({ type: 'joinRoom', roomId: code, name: n });
    }
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/${game}/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, game, roomCode, navigate]);

  // Click handlers: fire immediately when connected, otherwise queue a single
  // pending action. Extra clicks are ignored while something is pending.
  const handleCreate = () => {
    if (pending) return;
    if (name.trim().length < NAME_MIN_LEN) return;
    if (connected) fireCreate();
    else setPending('create');
  };

  const handleJoin = () => {
    if (pending) return;
    if (name.trim().length < NAME_MIN_LEN || !roomCode.trim()) return;
    if (connected) fireJoin();
    else setPending('join');
  };

  // Once the socket connects, run the queued action exactly once.
  useEffect(() => {
    if (!connected || !pending) return;
    if (pending === 'create') fireCreate();
    else fireJoin();
    setPending(null);
  }, [connected, pending, fireCreate, fireJoin]);

  // A rejoin that failed (room gone) — surface it instead of leaving the button spinning.
  // Silent for a plain auto-reconnect miss on load (no rejoin was attempted here).
  useEffect(() => {
    if (!reconnectFailed) return;
    if (rejoinAttempt.current) {
      rejoinAttempt.current = false;
      setPending(null);
      useGameStore.getState().setError('ROOM_NOT_FOUND', 'That room is no longer available.');
    }
    useGameStore.getState().setReconnectFailed(false);
  }, [reconnectFailed]);

  return (
    <div className="page">
      {mode === 'landing' ? (
        <div className="landing">
          <div className="text-center">
            <h1 className="brand-title">Bid Club</h1>
          </div>
          <div className="home-actions">
            <Button variant="primary" onClick={() => setMode('create')}>Start</Button>
            <Button variant="secondary" onClick={() => setMode('join')}>Join Room</Button>
          </div>
          <section className="home-seo">
            <p>
              Bid Club is a real-time multiplayer Hand-taking card game. Create a room,
              share the room link, and invite two to seven friends. Each round you predict exactly
              how many hands you&rsquo;ll make, then play to hit your number. Miss it and you
              will lose the points. Seven rounds, a shifting trump, one winner.{' '}
              New here? Read our <Link className="home-seo__link" to="/bid-club/guide">Guide</Link> to learn how to play.
            </p>
          </section>
        </div>
      ) : (
        <Surface className="flex-col gap-lg" style={{ maxWidth: 400, width: '100%' }}>
          {mode === 'create' && (
            <>
              <div className="text-center">
                <h1 className="brand-title brand-title--card">Bid Club</h1>
              </div>
              <Field
                label="Your name"
                hint={`${NAME_MIN_LEN}-${NAME_MAX_LEN} characters`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                minLength={NAME_MIN_LEN}
                maxLength={NAME_MAX_LEN}
                autoFocus
                onKeyDown={e => e.key === 'Enter' ? handleCreate() : undefined}
              />
              <RoomSettings
                maxPlayers={maxPlayers}
                minPlayers={2}
                mode={gameMode}
                onCommitMaxPlayers={setMaxPlayers}
                onSelectMode={setGameMode}
              />
              <div className="flex-col gap-sm">
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  disabled={pending !== null || name.trim().length < NAME_MIN_LEN}
                >
                  {pending === 'create' ? 'Starting…' : 'Create Room'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setMode('landing')}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {mode === 'join' && (
            <>
              <div className="text-center">
                <h1 className="brand-title brand-title--card">Bid Club</h1>
              </div>
              <Field
                label="Your name"
                hint={`${NAME_MIN_LEN}-${NAME_MAX_LEN} characters`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                minLength={NAME_MIN_LEN}
                maxLength={NAME_MAX_LEN}
                onKeyDown={e => e.key === 'Enter' ? handleJoin() : undefined}
                autoFocus
              />
              {!pendingHost && (
                <Field
                  label="Room code"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              )}
              <div className="flex-col gap-sm">
                <Button
                  variant="primary"
                  onClick={handleJoin}
                  disabled={pending !== null || name.trim().length < NAME_MIN_LEN || !roomCode.trim()}
                >
                  {pending === 'join'
                    ? 'Joining…'
                    : pendingHost ? `Join ${pendingHost}'s room` : 'Join'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setMode('landing')}
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </Surface>
      )}
    </div>
  );
}
