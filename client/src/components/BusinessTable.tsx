import { useState } from 'react';
import { BOARD, BoardTile, GLOBALS, isProperty } from 'shared';
import { useBusinessStore } from '../store/businessStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { Announcement } from './Announcement';
import { BusinessDealModal } from './BusinessDealModal';
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

// Per-group tile TEXT colour, chosen for contrast against its group background.
// Yellow is a light block, so white washes out → dark ink; the darker red / blue /
// green keep white. Applied at the tile level so name, price and owner chip all read.
const GROUP_TEXT: Record<string, string> = {
  red: '#fff',
  blue: '#fff',
  green: '#fff',
  yellow: '#2a1e00',
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

// Plain-English list of one side of a deal ("Mumbai + New Delhi buildings + ₹1,000").
function bundleSummary(cash: number, land: number[], buildings: number[]): string {
  const parts: string[] = [];
  land.forEach((pos) => parts.push(BOARD[pos].name));
  buildings.forEach((pos) => parts.push(`${BOARD[pos].name} buildings`));
  if (cash > 0) parts.push(`₹${cash.toLocaleString('en-IN')}`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

export function BusinessTable() {
  const { state } = useBusinessStore();
  const { playerId } = useSessionStore();
  const [dealOpen, setDealOpen] = useState(false);

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const { players, positions, cash, colours, ownership, currentTurn, bankrupt, skipNext, pendingDeals } = state;
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? id;

  // ─── Deals (async — available whenever the board is live, not turn-gated) ──────
  const dealsLive = state.phase === 'ROLLING' || state.phase === 'BUYING';
  const incomingDeals = dealsLive ? pendingDeals.filter((d) => d.to === playerId) : [];
  const outgoingDeals = dealsLive ? pendingDeals.filter((d) => d.from === playerId) : [];
  const bankruptMe = bankrupt.includes(playerId);

  // Whose turn + what the current player may do this step.
  const myTurn = currentTurn === playerId;
  const canRoll = state.phase === 'ROLLING' && myTurn;
  const canEnd = state.phase === 'BUYING' && myTurn;
  const turnName = currentTurn ? nameOf(currentTurn) : '';

  // Post-roll buy: the tile I'm standing on, if it's an unowned buyable I can afford.
  const myTile = BOARD[positions[playerId] ?? 0];
  const myTilePrice = 'price' in myTile ? myTile.price : 0;
  const canBuy =
    canEnd && myTilePrice > 0 && !ownership[positions[playerId] ?? 0]?.land &&
    (cash[playerId] ?? 0) >= myTilePrice;
  const isDoubles = Boolean(state.dice && state.dice[0] === state.dice[1]);

  // My deeds (buyable tiles I own the LAND of). Mortgage on any; build/sell only on
  // a buildable property (I own ≥ threshold of its colour). Precompute per row so the
  // JSX stays type-clean.
  const myProps = BOARD.filter(isProperty).filter((t) => ownership[t.pos]?.land === playerId);
  const myColourCount: Record<string, number> = {};
  myProps.forEach((t) => { myColourCount[t.colour] = (myColourCount[t.colour] ?? 0) + 1; });
  const deedRows = canEnd
    ? BOARD.filter((t) => 'price' in t && ownership[t.pos]?.land === playerId).map((t) => ({
        t,
        own: ownership[t.pos]!,
        price: 'price' in t ? t.price : 0,
        buildable: isProperty(t) && (myColourCount[t.colour] ?? 0) >= GLOBALS.buildColourThreshold,
        buildCost: isProperty(t) ? t.buildCost : 0,
      }))
    : [];

  // Tokens grouped by the tile they sit on, so a tile can stack multiple tokens.
  const tokensOn = (pos: number) =>
    players.filter(p => (positions[p.id] ?? 0) === pos);

  return (
    <div className="business-page">
      <Announcement announcement={state.announcement} />
      {/* Scroll wrapper: board fits on desktop but stays large on phones so the
          user can pan (and pinch-zoom natively) instead of reading tiny tiles. */}
      <div className="business-board-scroll">
      <div className="business-board" role="group" aria-label="Business board">
        {BOARD.map(tile => {
          const { row, col } = cellFor(tile.pos);
          const isProperty = tile.type === 'property';
          const tileColour = isProperty ? (tile as { colour: string }).colour : undefined;
          const groupColour = tileColour ? GROUP_COLOUR[tileColour] : undefined;
          const groupText = tileColour ? GROUP_TEXT[tileColour] : undefined;
          const own = ownership[tile.pos];
          const ownerId = own?.land ?? null;
          const price = priceOf(tile);
          const tokens = tokensOn(tile.pos);

          return (
            <div
              key={tile.pos}
              className={`business-tile business-tile--${tile.type}${tileColour ? ` business-tile--g-${tileColour}` : ''}`}
              style={{
                gridRow: row,
                gridColumn: col,
                background: groupColour ?? 'var(--surface-2)',
                ...(groupText ? { color: groupText } : {}),
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

              {own?.mortgaged && <div className="business-tile__mort">MORT</div>}

              {own && (own.houses > 0 || own.hotel) && (
                <div className="business-tile__pips">
                  {Array.from({ length: own.houses }).map((_, i) => (
                    <span
                      key={`h${i}`}
                      className="business-pip"
                      style={{ background: colours[own.buildingOwner ?? ''] ?? '#fff' }}
                    />
                  ))}
                  {own.hotel && (
                    <span
                      className="business-pip business-pip--hotel"
                      style={{ background: colours[own.buildingOwner ?? ''] ?? '#fff' }}
                    >
                      H
                    </span>
                  )}
                </div>
              )}

              {tokens.length > 0 && (
                <div className="business-tile__tokens">
                  {tokens.map(p => (
                    <span
                      key={p.id}
                      className={`business-token${p.id === currentTurn ? ' business-token--turn' : ''}`}
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
                {/* key includes both rolled values so a new roll remounts the die and
                    the CSS pop animation replays (the element is otherwise reused). */}
                <span key={`d0-${state.dice[0]}-${state.dice[1]}`} className="business-die">{state.dice[0]}</span>
                <span key={`d1-${state.dice[0]}-${state.dice[1]}`} className="business-die">{state.dice[1]}</span>
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
              <div className="business-turn-actions">
                {canBuy && (
                  <button
                    type="button"
                    className="business-action-btn business-action-btn--roll"
                    onClick={() => sendMsg({ type: 'businessBuy' })}
                  >
                    Buy {myTile.name} — ₹{myTilePrice.toLocaleString('en-IN')}
                  </button>
                )}
                <button
                  type="button"
                  className="business-action-btn business-action-btn--end"
                  onClick={() => sendMsg({ type: 'businessEndTurn' })}
                >
                  {isDoubles ? 'Roll again →' : 'End turn →'}
                </button>
              </div>
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
      </div>

      {/* ── Deeds panel (your turn): build · mortgage ──────────────────────────*/}
      {deedRows.length > 0 && (
        <div className="business-build-panel">
          <div className="business-build-panel__title">Your deeds — build · mortgage</div>
          <div className="business-build-panel__rows">
            {deedRows.map(({ t, own, price, buildable, buildCost }) => {
              const canAffordBuild = (cash[playerId] ?? 0) >= buildCost;
              const payout = Math.round(price * GLOBALS.mortgageRate);
              const unmortgageCost = Math.round(price * GLOBALS.mortgageRate * (1 + GLOBALS.unmortgageInterest));
              return (
                <div key={t.pos} className="business-build-row">
                  <span
                    className="business-build-row__name"
                    style={isProperty(t) ? { color: GROUP_COLOUR[t.colour] } : undefined}
                  >
                    {t.name}{own.mortgaged ? ' · mortgaged' : ''}
                  </span>
                  {buildable && (
                    <>
                      <span className="business-build-row__state">
                        🏠{own.houses}{own.hotel ? ' 🏨' : ''}
                      </span>
                      <button
                        type="button"
                        className="business-mini-btn"
                        disabled={own.houses >= GLOBALS.maxHouses || !canAffordBuild}
                        onClick={() => sendMsg({ type: 'businessBuild', pos: t.pos, kind: 'house' })}
                      >
                        +House ₹{buildCost.toLocaleString('en-IN')}
                      </button>
                      <button
                        type="button"
                        className="business-mini-btn"
                        disabled={own.hotel || !canAffordBuild}
                        onClick={() => sendMsg({ type: 'businessBuild', pos: t.pos, kind: 'hotel' })}
                      >
                        +Hotel
                      </button>
                      {(own.houses > 0 || own.hotel) && (
                        <button
                          type="button"
                          className="business-mini-btn business-mini-btn--sell"
                          onClick={() => sendMsg({ type: 'businessSell', pos: t.pos, kind: own.hotel ? 'hotel' : 'house' })}
                        >
                          Sell {own.hotel ? 'hotel' : 'house'} ½
                        </button>
                      )}
                    </>
                  )}
                  {!own.mortgaged ? (
                    <button
                      type="button"
                      className="business-mini-btn business-mini-btn--sell"
                      onClick={() => sendMsg({ type: 'businessMortgage', pos: t.pos })}
                    >
                      Mortgage +₹{payout.toLocaleString('en-IN')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="business-mini-btn"
                      disabled={(cash[playerId] ?? 0) < unmortgageCost}
                      onClick={() => sendMsg({ type: 'businessUnmortgage', pos: t.pos })}
                    >
                      Unmortgage −₹{unmortgageCost.toLocaleString('en-IN')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Deals panel (async — any live player, not turn-gated) ───────────────*/}
      {dealsLive && !bankruptMe && (
        <div className="business-deals-panel">
          <div className="business-deals-panel__head">
            <span className="business-deals-panel__title">Deals</span>
            <button
              type="button"
              className="business-mini-btn"
              onClick={() => setDealOpen(true)}
            >
              + Propose deal
            </button>
          </div>

          {incomingDeals.length === 0 && outgoingDeals.length === 0 && (
            <div className="business-deal-empty">No open deals. Propose one to start trading.</div>
          )}

          {incomingDeals.map((d) => (
            <div key={d.id} className="business-deal-card business-deal-card--in">
              <div className="business-deal-card__text">
                <strong>From {nameOf(d.from)}</strong>
                <span className="business-deal-card__leg"> — You get: {bundleSummary(d.offerCash, d.offerLand, d.offerBuildings)}</span>
                <span className="business-deal-card__sep"> · </span>
                <span className="business-deal-card__leg">You give: {bundleSummary(d.requestCash, d.requestLand, d.requestBuildings)}</span>
              </div>
              <div className="business-deal-card__btns">
                <button
                  type="button"
                  className="business-mini-btn"
                  onClick={() => sendMsg({ type: 'businessAcceptDeal', dealId: d.id })}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="business-mini-btn business-mini-btn--sell"
                  onClick={() => sendMsg({ type: 'businessRejectDeal', dealId: d.id })}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}

          {outgoingDeals.map((d) => (
            <div key={d.id} className="business-deal-card business-deal-card--out">
              <div className="business-deal-card__text">
                <strong>To {nameOf(d.to)}</strong>
                <span className="business-deal-card__leg"> — You give: {bundleSummary(d.offerCash, d.offerLand, d.offerBuildings)}</span>
                <span className="business-deal-card__sep"> · </span>
                <span className="business-deal-card__leg">You get: {bundleSummary(d.requestCash, d.requestLand, d.requestBuildings)}</span>
                <span className="business-deal-card__pending"> (pending)</span>
              </div>
              <div className="business-deal-card__btns">
                <button
                  type="button"
                  className="business-mini-btn business-mini-btn--sell"
                  onClick={() => sendMsg({ type: 'businessCancelDeal', dealId: d.id })}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BusinessDealModal
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        state={state}
        playerId={playerId}
      />

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
              <span className={`business-cash-row__cash${(cash[p.id] ?? 0) < 0 ? ' business-cash-row__cash--debt' : ''}`}>₹{(cash[p.id] ?? 0).toLocaleString('en-IN')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
