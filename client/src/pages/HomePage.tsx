import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendMsg } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';

export function HomePage() {
  const [name, setName] = useState(storage.getPlayer()?.name ?? '');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(7);
  const [mode, setMode] = useState<'landing' | 'create' | 'join'>('landing');
  const [pendingHost, setPendingHost] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const { connected, roomId, gameState } = useGameStore();
  const navigate = useNavigate();

  // If we arrived here via an invite link (redirected from the lobby), pick up
  // the pending room id + host name and drop straight into the join view.
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem('pendingRoomId');
    const host = sessionStorage.getItem('pendingHost');
    if (pendingRoomId) {
      setMode('join');
      setRoomCode(pendingRoomId.toUpperCase());
      setPendingHost(host ?? '');
      sessionStorage.removeItem('pendingRoomId');
      sessionStorage.removeItem('pendingHost');
    }
  }, []);

  // If already in a room, redirect
  if (roomId && gameState) {
    navigate(`/room/${roomId}`, { replace: true });
  }

  const saveName = useCallback(() => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return null;
    storage.setPlayer({ name: trimmed });
    return trimmed;
  }, [name]);

  // The actual "send + subscribe-to-navigate" work. Split out from the click
  // handlers so it can be fired immediately (connected) or queued (connecting).
  const fireCreate = useCallback(() => {
    const n = saveName();
    if (!n) return;
    sendMsg({ type: 'createRoom', name: n, maxPlayers });
    // Navigate will happen when we receive 'joined' + 'state'
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, maxPlayers, navigate]);

  const fireJoin = useCallback(() => {
    const n = saveName();
    const code = roomCode.trim().toUpperCase();
    if (!n || !code) return;
    sendMsg({ type: 'joinRoom', roomId: code, name: n });
    const unsub = useGameStore.subscribe((s) => {
      if (s.roomId) {
        navigate(`/room/${s.roomId}`);
        unsub();
      }
    });
  }, [saveName, roomCode, navigate]);

  // Click handlers: fire immediately when connected, otherwise queue a single
  // pending action. Extra clicks are ignored while something is pending.
  const handleCreate = () => {
    if (pending) return;
    if (name.trim().length < 2) return;
    if (connected) fireCreate();
    else setPending('create');
  };

  const handleJoin = () => {
    if (pending) return;
    if (name.trim().length < 2 || !roomCode.trim()) return;
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

  return (
    <div className="page">
      {mode === 'landing' ? (
        <div className="landing">
          <div style={{ textAlign: 'center' }}>
            <h1 className="jhatpat-title">Bid Club</h1>
          </div>
          <div className="home-actions">
            <button className="btn btn--primary" onClick={() => setMode('create')}>Start</button>
            <button className="btn btn--secondary" onClick={() => setMode('join')}>Join Room</button>
          </div>
          <section className="home-seo">
            <p>
              Bid Club is a real-time multiplayer trick-taking card game. Spin up a room,
              share the link, and gather two to seven friends. Each round you predict exactly
              how many tricks you&rsquo;ll take, then play to hit your number. Miss it and you
              lose the points. Seven rounds, a shifting trump, one winner.{' '}
              New here? The <Link className="home-seo__link" to="/guide">Guide</Link> covers
              every rule and how scoring works.
            </p>
          </section>
        </div>
      ) : (
        <div className="panel flex-col gap-lg" style={{ maxWidth: 400, width: '100%' }}>
          {mode === 'create' && (
            <>
              <div style={{ textAlign: 'center' }}>
                <h1 className="jhatpat-title jhatpat-title--card">Bid Club</h1>
              </div>
              <div className="flex-col gap-sm">
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Your name</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name"
                  minLength={2}
                  maxLength={10}
                  autoFocus
                />
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>2-10 characters</span>
              </div>
              <div className="flex-col gap-sm">
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                  Number of players (2-7)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range"
                    min={2} max={7} step={1}
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
              </div>
              <div className="flex-col gap-sm">
                <button
                  className="btn btn--primary"
                  onClick={handleCreate}
                  disabled={pending !== null || name.trim().length < 2}
                >
                  {pending === 'create' ? 'Starting…' : 'Create Room'}
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => setMode('landing')}
                >
                  Back
                </button>
              </div>
            </>
          )}

          {mode === 'join' && (
            <>
              <div style={{ textAlign: 'center' }}>
                <h1 className="jhatpat-title jhatpat-title--card">Bid Club</h1>
              </div>
              <div className="flex-col gap-sm">
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Your name</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name"
                  minLength={2}
                  maxLength={10}
                  onKeyDown={e => e.key === 'Enter' ? handleJoin() : undefined}
                  autoFocus
                />
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>2-10 characters</span>
              </div>
              {!pendingHost && (
                <div className="flex-col gap-sm">
                  <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Room code</label>
                  <input
                    className="input"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB12CD"
                    maxLength={6}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              )}
              <div className="flex-col gap-sm">
                <button
                  className="btn btn--primary"
                  onClick={handleJoin}
                  disabled={pending !== null || name.trim().length < 2 || !roomCode.trim()}
                >
                  {pending === 'join'
                    ? 'Joining…'
                    : pendingHost ? `Join ${pendingHost}'s room` : 'Join'}
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => setMode('landing')}
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
