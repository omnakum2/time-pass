import { BOARD, BoardTile } from 'shared';
import { useBusinessStore } from '../store/businessStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { Announcement } from './Announcement';
import '../styles/business.css';

/**
 * BusinessTable — the ROLLING/BUYING game board. Prop-less: reads its own store
 * (mirrors ThosoTable / BidBaazi's GamePage). Rendered by BusinessRoomPage once the
 * phase leaves LOBBY and before GAME_OVER.
 *
 * PHASE 1 = static scaffold: a 36-tile perimeter board (10×10 CSS grid) with tokens
 * and a cash panel. No dice / movement / economy interactions yet.
 */

// Property-group colours (literal — the 4 board groups, kept distinct from player tokens).
const GROUP_COLOUR: Record<string, string> = {
  red: '#d64545',
  blue: '#3b6fd6',
  green: '#2ea44f',
  yellow: '#e0a92e',
};

// Perimeter mapping from tile pos → 10×10 grid cell (per the locked spec).
function cellFor(pos: number): { row: number; col: number } {
  const N = 10;
  if (pos <= 9)  return { row: N - pos, col: 1 };        // left col: START(0) bottom → CLUB(9) top
  if (pos <= 18) return { row: 1, col: 1 + (pos - 9) };  // top row → JAIL(18) top-right
  if (pos <= 27) return { row: 1 + (pos - 18), col: N }; // right col → REST_HOUSE(27) bottom-right
  return { row: N, col: N - (pos - 27) };                // bottom row → back toward START
}

// Price shown inside a tile (only tiles that can be bought carry one).
function priceOf(t: BoardTile): number | null {
  if (t.type === 'property' || t.type === 'station' || t.type === 'utility') return t.price;
  return null;
}

export function BusinessTable() {
  const { state } = useBusinessStore();
  const { playerId } = useSessionStore();

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const { players, positions, cash, colours, ownership, currentTurn, bankrupt, skipNext } = state;
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? id;

  // Whose turn + what the current player may do this step.
  const myTurn = currentTurn === playerId;
  const canRoll = state.phase === 'ROLLING' && myTurn;
  const canEnd = state.phase === 'BUYING' && myTurn;
  const turnName = currentTurn ? nameOf(currentTurn) : '';

  // Tokens grouped by the tile they sit on, so a tile can stack multiple tokens.
  const tokensOn = (pos: number) =>
    players.filter(p => (positions[p.id] ?? 0) === pos);

  return (
    <div className="business-page">
      <Announcement announcement={state.announcement} />
      <div className="business-board" role="group" aria-label="Business board">
        {BOARD.map(tile => {
          const { row, col } = cellFor(tile.pos);
          const isProperty = tile.type === 'property';
          const groupColour = isProperty ? GROUP_COLOUR[(tile as { colour: string }).colour] : undefined;
          const own = ownership[tile.pos];
          const ownerId = own?.land ?? null;
          const price = priceOf(tile);
          const tokens = tokensOn(tile.pos);

          return (
            <div
              key={tile.pos}
              className={`business-tile business-tile--${tile.type}`}
              style={{
                gridRow: row,
                gridColumn: col,
                background: groupColour ?? 'var(--surface-2)',
              }}
            >
              <div className="business-tile__name">{tile.name}</div>
              {price != null && <div className="business-tile__price">₹{price.toLocaleString('en-IN')}</div>}

              <div
                className="business-tile__owner"
                style={ownerId ? { color: colours[ownerId] ?? 'var(--ink)' } : undefined}
              >
                {ownerId ? nameOf(ownerId) : 'Bank'}
              </div>

              {tokens.length > 0 && (
                <div className="business-tile__tokens">
                  {tokens.map(p => (
                    <span
                      key={p.id}
                      className="business-token"
                      style={{ background: colours[p.id] ?? 'var(--game-primary)' }}
                      title={p.name}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Center title / dice area — spans the inner 9×9 (rows/cols 2..10). */}
        <div className="business-center" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
          <div className="business-center__brand">BUSINESS</div>
          <div className="business-center__sub">Buy · Build · Bankrupt</div>
          <div className="business-center__dice">
            {state.dice ? (
              <>
                <span className="business-die">{state.dice[0]}</span>
                <span className="business-die">{state.dice[1]}</span>
              </>
            ) : (
              <span className="tag-faint">—</span>
            )}
          </div>
          <div className="business-center__turn">
            {canRoll ? (
              <button
                type="button"
                className="business-action-btn business-action-btn--roll"
                onClick={() => sendMsg({ type: 'businessRoll' })}
              >
                🎲 Roll dice
              </button>
            ) : canEnd ? (
              <button
                type="button"
                className="business-action-btn business-action-btn--end"
                onClick={() => sendMsg({ type: 'businessEndTurn' })}
              >
                End turn →
              </button>
            ) : (
              <span className="tag-faint">
                {state.phase === 'ROLLING'
                  ? `Waiting for ${turnName} to roll…`
                  : `${turnName} is taking their turn…`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cash panel ─────────────────────────────────────────────────────────*/}
      <div className="business-cash-panel">
        {players.map(p => {
          const isTurn = currentTurn === p.id;
          const isMe = p.id === playerId;
          const isBankrupt = bankrupt.includes(p.id);
          return (
            <div
              key={p.id}
              className={`business-cash-row${isTurn ? ' business-cash-row--turn' : ''}${isBankrupt ? ' business-cash-row--bankrupt' : ''}`}
            >
              <span className="business-cash-row__swatch" style={{ background: colours[p.id] ?? 'var(--game-primary)' }} />
              <span className="business-cash-row__name">
                {p.name}
                {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
                {isBankrupt && <span className="tag-faint" style={{ marginLeft: 4 }}>(bankrupt)</span>}
                {skipNext.includes(p.id) && <span className="tag-faint" style={{ marginLeft: 4 }}>(skips next)</span>}
              </span>
              <span className="business-cash-row__cash">₹{(cash[p.id] ?? 0).toLocaleString('en-IN')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
