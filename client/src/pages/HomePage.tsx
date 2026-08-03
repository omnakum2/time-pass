import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendMsg } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';

export function HomePage() {
  const [name, setName] = useState(storage.getPlayer()?.name ?? '');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(7);
  const [mode, setMode] = useState<'home' | 'join'>('home');
  const { connected, roomId, gameState } = useGameStore();
  const navigate = useNavigate();

  // If already in a room, redirect
  if (roomId && gameState) {
    navigate(`/room/${roomId}`, { replace: true });
  }

  const saveName = () => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return null;
    storage.setPlayer({ name: trimmed });
    return trimmed;
  };

  const handleCreate = () => {
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
  };

  const handleJoin = () => {
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
  };

  return (
    <div className="page">
      <div className="panel flex-col gap-lg" style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🃏</div>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--gold)', marginTop: 8 }}>
            Prediction
          </h1>
          <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: 4 }}>
            The trick-taking prediction game
          </p>
        </div>

        {!connected && (
          <p style={{ textAlign: 'center', color: '#f39c12', fontSize: '0.875rem' }}>
            Connecting to server…
          </p>
        )}

        <div className="flex-col gap-sm">
          <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Your name</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && mode === 'join' ? handleJoin() : undefined}
          />
        </div>

        {mode === 'home' ? (
          <div className="flex-col gap-sm">
            <div className="flex-col gap-sm">
              <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Number of players (2–7)
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
            <button
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={!connected || !name.trim()}
            >
              Create Room
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => setMode('join')}
              disabled={!connected}
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="flex-col gap-sm">
            <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Room code</label>
            <input
              className="input"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <button
              className="btn btn--primary"
              onClick={handleJoin}
              disabled={!connected || !name.trim() || !roomCode.trim()}
            >
              Join
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => setMode('home')}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
