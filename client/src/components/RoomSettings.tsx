import { useEffect, useState } from 'react';
import { GAME_MODES, GameMode } from 'shared';

interface Props {
  maxPlayers: number;
  minPlayers: number;            // Home: 2, Lobby: max(2, seated)
  mode: GameMode;
  onCommitMaxPlayers: (n: number) => void; // Home: setMaxPlayers, Lobby: send updateRoomSettings
  onSelectMode: (m: GameMode) => void;
  showModes?: boolean;           // whether to render the mode picker (Thoso has none)
  maxAllowed?: number;           // upper bound of the player-count slider (per game)
}

/** Shared create/lobby room-settings: player slider (commit-on-release) + optional mode picker. */
export function RoomSettings({ maxPlayers, minPlayers, mode, onCommitMaxPlayers, onSelectMode, showModes = true, maxAllowed = 7 }: Props) {
  const [drag, setDrag] = useState(maxPlayers);
  useEffect(() => { setDrag(maxPlayers); }, [maxPlayers]);
  const commit = (n: number) => {
    const v = Math.max(minPlayers, Math.min(maxAllowed, n));
    setDrag(v);
    onCommitMaxPlayers(v);
  };
  return (
    <div className="flex-col gap-lg">
      <div className="flex-col gap-sm">
        <label className="field-label">Number of players ({minPlayers}-{maxAllowed})</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={minPlayers} max={maxAllowed} step={1}
            value={drag}
            onChange={e => setDrag(Number(e.target.value))}
            onMouseUp={e => commit(Number((e.target as HTMLInputElement).value))}
            onKeyUp={e => commit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={e => commit(Number((e.target as HTMLInputElement).value))}
            style={{ flex: 1, accentColor: 'var(--gold)' }}
          />
          <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', color: 'var(--gold)' }}>{drag}</span>
        </div>
      </div>
      {showModes && (
        <div className="flex-col gap-sm">
          <label className="field-label">Game mode</label>
          <div className="mode-picker">
            {GAME_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                className={`mode-option${mode === m.id ? ' mode-option--active' : ''}`}
                onClick={() => onSelectMode(m.id)}
              >
                <span className="mode-option__label">{m.label}</span>
                <span className="mode-option__desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
