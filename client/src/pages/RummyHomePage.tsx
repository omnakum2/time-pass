import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { NAME_MIN_LEN, NAME_MAX_LEN } from 'shared';
import { sendMsg, reconnectSession } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { useRummyStore } from '../store/rummyStore';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';

export function RummyHomePage() {
  const [name, setName] = useState(storage.getPlayer()?.name ?? '');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [mode, setMode] = useState<'landing' | 'create' | 'join'>('landing');
  const [pendingHost, setPendingHost] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const { connected, roomId, reconnectFailed } = useGameStore();
  const rummyState = useRummyStore(s => s.gameState);
  const rejoinAttempt = useRef(false);
  const navigate = useNavigate();

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

  useEffect(() => {
    if (roomId && rummyState) navigate(`/rummy/room/${roomId}`, { replace: true });
  }, [roomId, rummyState, navigate]);

  const saveName = useCallback(() => {
    const trimmed = name.trim().slice(0, NAME_MAX_LEN);
    if (!trimmed) return null;
    storage.setPlayer({ name: trimmed });
    return trimmed;
  }, [name]);

  const fireCreate = useCallback(() => {
    const n = saveName();
    if (!n) return;
    sendMsg({ type: 'createRoom', name: n, maxPlayers, game: 'rummy' });
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/rummy/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, maxPlayers, navigate]);

  const fireJoin = useCallback(() => {
    const n = saveName();
    const code = roomCode.trim().toUpperCase();
    if (!n || !code) return;
    const session = storage.getSession();
    if (session && session.roomId.toUpperCase() === code) {
      rejoinAttempt.current = true;
      reconnectSession(session.roomId, session.token);
    } else {
      sendMsg({ type: 'joinRoom', roomId: code, name: n });
    }
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/rummy/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, roomCode, navigate]);

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

  useEffect(() => {
    if (!connected || !pending) return;
    if (pending === 'create') fireCreate();
    else fireJoin();
    setPending(null);
  }, [connected, pending, fireCreate, fireJoin]);

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
            <h1 className="brand-title">Rummy</h1>
          </div>
          <div className="home-actions">
            <Button variant="primary" onClick={() => setMode('create')}>Start</Button>
            <Button variant="secondary" onClick={() => setMode('join')}>Join Room</Button>
          </div>
          <section className="home-seo">
            <p>
              A real-time multiplayer 13-card Rummy variant. Create a room, share the
              room link, and invite up to five friends. Form a 4-card pure sequence, a
              3-card pure sequence, a 3-card impure sequence and a 3-card set to declare.
              A drawn Trump card acts as a wildcard for any one missing card in any hand.
              First to validly declare wins; play continues among the rest until everyone
              has declared.{' '}
              New here? Read our <Link className="home-seo__link" to="/guide">Guide</Link> to learn how to play.
            </p>
          </section>
        </div>
      ) : (
        <Surface className="flex-col gap-lg" style={{ maxWidth: 400, width: '100%' }}>
          {mode === 'create' && (
            <>
              <div className="text-center">
                <h1 className="brand-title brand-title--card">Rummy</h1>
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
              <div className="flex-col gap-sm">
                <label className="field-label">
                  Number of players (2-6)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range"
                    min={2} max={6} step={1}
                    value={maxPlayers}
                    onChange={e => setMaxPlayers(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--gold)' }}
                  />
                  <span style={{
                    minWidth: 32, textAlign: 'center',
                    fontWeight: 700, fontSize: '1.2rem', color: 'var(--gold)',
                  }}>
                    {maxPlayers}
                  </span>
                </div>
                <p className="tag-faint">
                  {maxPlayers <= 3 ? 'Single 52-card deck' : 'Double 104-card deck'}
                </p>
              </div>
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
                <h1 className="brand-title brand-title--card">Rummy</h1>
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
