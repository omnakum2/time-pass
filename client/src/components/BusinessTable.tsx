import { useState } from 'react';
import { BOARD, BoardTile, GLOBALS, isProperty, PropertyTile, CHANCE, COMMUNITY_CHEST } from 'shared';
import { useBusinessStore } from '../store/businessStore';
import { useSessionStore } from '../store/sessionStore';
import { sendMsg } from '../net/socket';
import { Announcement } from './Announcement';
import { BusinessDealModal } from './BusinessDealModal';
import { PlayerChip } from './PlayerChip';
import '../styles/business.css';

/**
 * BusinessTable — Responsive 3-Column Layout:
 * Left Column: Your Properties & Deed Management
 * Center Column: Opponent Chips (Top), Board with Single Watermark (Center), My Chip (Bottom)
 * Right Column: Deals & All Players Cash Summary
 */

const GROUP_COLOUR: Record<string, string> = {
  red: '#d64545',
  blue: '#3b6fd6',
  green: '#2ea44f',
  yellow: '#e0a92e',
};

const GROUP_TEXT: Record<string, string> = {
  red: '#fff',
  blue: '#fff',
  green: '#fff',
  yellow: '#2a1e00',
};

function cellFor(pos: number): { row: number; col: number } {
  const N = 10;
  if (pos <= 9)  return { row: N - pos, col: 1 };
  if (pos <= 18) return { row: 1, col: 1 + (pos - 9) };
  if (pos <= 27) return { row: 1 + (pos - 18), col: N };
  return { row: N, col: N - (pos - 27) };
}

function priceOf(t: BoardTile): number | null {
  if (t.type === 'property' || t.type === 'station' || t.type === 'utility') return t.price;
  return null;
}

function bundleSummary(cash: number, land: number[], buildings: number[]): string {
  const parts: string[] = [];
  land.forEach((pos) => parts.push(BOARD[pos].name));
  buildings.forEach((pos) => parts.push(`${BOARD[pos].name} buildings`));
  if (cash > 0) parts.push(`₹${cash.toLocaleString('en-IN')}`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

function renderTooltipContent(tile: BoardTile) {
  if (tile.type === 'property') {
    const p = tile as PropertyTile;
    return (
      <>
        <div className="business-tooltip__row"><span>Site Rent:</span><strong>₹{p.siteRent.toLocaleString('en-IN')}</strong></div>
        <div className="business-tooltip__row"><span>1 House:</span><strong>₹{p.houseRent[0].toLocaleString('en-IN')}</strong></div>
        <div className="business-tooltip__row"><span>2 Houses:</span><strong>₹{p.houseRent[1].toLocaleString('en-IN')}</strong></div>
        <div className="business-tooltip__row"><span>3 Houses:</span><strong>₹{p.houseRent[2].toLocaleString('en-IN')}</strong></div>
        <div className="business-tooltip__row"><span>Hotel Rent:</span><strong>₹{p.hotelRent.toLocaleString('en-IN')}</strong></div>
        <div className="business-tooltip__row" style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', marginTop: 4, paddingTop: 4 }}>
          <span>Build Cost:</span><strong>₹{p.buildCost.toLocaleString('en-IN')}</strong>
        </div>
      </>
    );
  }
  if (tile.type === 'station') {
    return (
      <>
        <div className="business-tooltip__row"><span>1 Station owned:</span><strong>₹1,000</strong></div>
        <div className="business-tooltip__row"><span>2 Stations owned:</span><strong>₹2,000</strong></div>
        <div className="business-tooltip__row"><span>3 Stations owned:</span><strong>₹4,000</strong></div>
        <div className="business-tooltip__row"><span>4 Stations owned:</span><strong>₹8,000</strong></div>
      </>
    );
  }
  if (tile.type === 'utility') {
    return (
      <>
        <div className="business-tooltip__row"><span>1 Utility owned:</span><strong>4 × Dice Total</strong></div>
        <div className="business-tooltip__row"><span>2 Utilities owned:</span><strong>10 × Dice Total</strong></div>
      </>
    );
  }
  if (tile.type === 'tax') {
    return <div className="business-tooltip__desc">{tile.tax === 'income' ? 'Pay ₹200 for each city property you own.' : 'Pay ₹1,000 for each building (house/hotel) you own.'}</div>;
  }
  if (tile.type === 'card') {
    const deck = tile.card === 'chance' ? CHANCE : COMMUNITY_CHEST;
    const title = tile.card === 'chance' ? '🎲 CHANCE EVENTS BY ROLL:' : '🎁 COMMUNITY CHEST EVENTS BY ROLL:';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem' }}>
        <strong style={{ color: 'var(--game-primary)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 2 }}>{title}</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', marginTop: 2 }}>
          <div>
            <div style={{ fontWeight: 800, textDecoration: 'underline', opacity: 0.85, marginBottom: 2 }}>Even Rolls:</div>
            {Object.entries(deck.even).map(([roll, outcome]) => (
              <div key={roll} style={{ margin: '2px 0' }}>🎲 <strong>{roll}</strong>: {outcome.label}</div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 800, textDecoration: 'underline', opacity: 0.85, marginBottom: 2 }}>Odd Rolls:</div>
            {Object.entries(deck.odd).map(([roll, outcome]) => (
              <div key={roll} style={{ margin: '2px 0' }}>🎲 <strong>{roll}</strong>: {outcome.label}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (tile.type === 'corner') {
    if (tile.corner === 'start') return <div className="business-tooltip__desc">Collect ₹1,500 bonus when passing or landing on START.</div>;
    if (tile.corner === 'club' || tile.corner === 'restHouse') return <div className="business-tooltip__desc">Miss your next turn when landing here.</div>;
    if (tile.corner === 'jail') return <div className="business-tooltip__desc">Pay ₹200 fine on landing (does not skip turn).</div>;
  }
  return <div className="business-tooltip__desc">Special board tile.</div>;
}

export function BusinessTable() {
  const { state } = useBusinessStore();
  const { playerId } = useSessionStore();
  const [dealOpen, setDealOpen] = useState(false);

  // Hover Tooltip State
  const [hoveredTile, setHoveredTile] = useState<BoardTile | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!state || !playerId) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const { players, positions, cash, colours, ownership, currentTurn, bankrupt, skipNext, pendingDeals, turnExpiresAt } = state;
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? id;

  const dealsLive = state.phase === 'ROLLING' || state.phase === 'BUYING';
  const incomingDeals = dealsLive ? pendingDeals.filter((d) => d.to === playerId) : [];
  const outgoingDeals = dealsLive ? pendingDeals.filter((d) => d.from === playerId) : [];
  const bankruptMe = bankrupt.includes(playerId);

  const myTurn = currentTurn === playerId;
  const canRoll = state.phase === 'ROLLING' && myTurn;
  const canEnd = state.phase === 'BUYING' && myTurn;
  const turnName = currentTurn ? nameOf(currentTurn) : '';

  const myTile = BOARD[positions[playerId] ?? 0];
  const myTilePrice = 'price' in myTile ? myTile.price : 0;
  const canBuy =
    canEnd && myTilePrice > 0 && !ownership[positions[playerId] ?? 0]?.land &&
    (cash[playerId] ?? 0) >= myTilePrice;

  const myProps = BOARD.filter(isProperty).filter((t) => ownership[t.pos]?.land === playerId);
  const myColourCount: Record<string, number> = {};
  myProps.forEach((t) => { myColourCount[t.colour] = (myColourCount[t.colour] ?? 0) + 1; });
  const deedRows = BOARD.filter((t) => 'price' in t && ownership[t.pos]?.land === playerId).map((t) => ({
    t,
    own: ownership[t.pos]!,
    price: 'price' in t ? t.price : 0,
    buildable: isProperty(t) && (myColourCount[t.colour] ?? 0) >= GLOBALS.buildColourThreshold,
    buildCost: isProperty(t) ? t.buildCost : 0,
  }));

  const tokensOn = (pos: number) =>
    players.filter(p => (positions[p.id] ?? 0) === pos);

  const handleTileMouseEnter = (tile: BoardTile, e: React.MouseEvent) => {
    setHoveredTile(tile);
    setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  const handleTileMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  const handleTileMouseLeave = () => {
    setHoveredTile(null);
  };

  const myPlayerObj = players.find(p => p.id === playerId);
  const opponentPlayers = players.filter(p => p.id !== playerId);

  return (
    <div className="business-page">
      <Announcement announcement={state.announcement} />

      {/* Floating Hover Tooltip Popup */}
      {hoveredTile && (
        <div
          className="business-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            width: hoveredTile.type === 'card' ? '300px' : '230px',
          }}
        >
          <div className="business-tooltip__header">
            <span>{hoveredTile.name}</span>
            {priceOf(hoveredTile) != null && (
              <span>₹{priceOf(hoveredTile)!.toLocaleString('en-IN')}</span>
            )}
          </div>
          {renderTooltipContent(hoveredTile)}
        </div>
      )}

      {/* ═══ LEFT COLUMN: Properties & Deeds ═══ */}
      <div className="business-sidebar">
        <div className="business-build-panel" style={{ width: '100%' }}>
          <div className="business-build-panel__title">🏠 Your Properties ({myProps.length} owned)</div>
          {deedRows.length === 0 ? (
            <div style={{ fontSize: '0.8rem', opacity: 0.6, padding: '8px 0' }}>
              No properties owned yet. Land on unowned cities to buy!
            </div>
          ) : (
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
                        {canEnd && (
                          <>
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
                      </>
                    )}
                    {canEnd && (!own.mortgaged ? (
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
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MIDDLE COLUMN: Opponents Row (Top) + Board (Center) + My Chip (Bottom) ═══ */}
      <div className="business-middle-col">
        {/* Opponents Chips Row */}
        <div className="business-opponents-row">
          {opponentPlayers.map(p => {
            const isTurn = currentTurn === p.id;
            return (
              <PlayerChip
                key={p.id}
                player={p}
                isMe={false}
                isActive={isTurn}
                showTimer={isTurn}
                remainingMs={turnExpiresAt ? Math.max(0, turnExpiresAt - Date.now()) : 30000}
                fullMs={30000}
                startKey={turnExpiresAt ? `${p.id}-${turnExpiresAt}` : p.id}
                running={isTurn}
                info={
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--game-primary)', textAlign: 'center' }}>
                    ₹{(cash[p.id] ?? 0).toLocaleString('en-IN')}
                  </div>
                }
              />
            );
          })}
        </div>

        {/* Board Container */}
        <div className="business-board-scroll">
          <div className="business-board" role="group" aria-label="Business board">
            {BOARD.map(tile => {
              const { row, col } = cellFor(tile.pos);
              const isProp = tile.type === 'property';
              const tileColour = isProp ? (tile as { colour: string }).colour : undefined;
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
                  onMouseEnter={(e) => handleTileMouseEnter(tile, e)}
                  onMouseMove={handleTileMouseMove}
                  onMouseLeave={handleTileMouseLeave}
                >
                  <div className="business-tile__name">{tile.name}</div>
                  {price != null && <div className="business-tile__price">₹{price.toLocaleString('en-IN')}</div>}

                  <div className="business-tile__footer">
                    <span
                      className="business-tile__owner"
                      style={ownerId ? { color: colours[ownerId] ?? 'var(--ink)' } : undefined}
                    >
                      {ownerId ? nameOf(ownerId) : (price ? 'Bank' : '')}
                    </span>
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

            {/* Board Center with Single Watermark Title */}
            <div className="business-center" style={{ gridRow: '2 / 10', gridColumn: '2 / 10' }}>
              <div className="business-center__brand">BUSINESS</div>

              <div className="business-center__dice">
                {state.dice ? (
                  <>
                    <span key={`d0-${state.dice[0]}-${state.dice[1]}`} className="business-die">{state.dice[0]}</span>
                    <span key={`d1-${state.dice[0]}-${state.dice[1]}`} className="business-die">{state.dice[1]}</span>
                  </>
                ) : (
                  <span className="tag-faint">-</span>
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
                        Buy {myTile.name} - ₹{myTilePrice.toLocaleString('en-IN')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="business-action-btn business-action-btn--end"
                      onClick={() => sendMsg({ type: 'businessEndTurn' })}
                    >
                      End turn →
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

        {/* My Chip Row (Below Board) */}
        {myPlayerObj && (
          <div className="business-my-strip">
            <PlayerChip
              player={myPlayerObj}
              isMe={true}
              isActive={myTurn}
              showTimer={myTurn}
              remainingMs={turnExpiresAt ? Math.max(0, turnExpiresAt - Date.now()) : 30000}
              fullMs={30000}
              startKey={turnExpiresAt ? `${playerId}-${turnExpiresAt}` : playerId}
              running={myTurn}
              info={
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--game-primary)', textAlign: 'center' }}>
                  ₹{(cash[playerId] ?? 0).toLocaleString('en-IN')}
                </div>
              }
            />
          </div>
        )}
      </div>


      {/* ═══ RIGHT COLUMN: Deals & Cash Summary ═══ */}
      <div className="business-sidebar">
        {/* Deals Panel */}
        {dealsLive && !bankruptMe && (
          <div className="business-deals-panel">
            <div className="business-deals-panel__head">
              <span className="business-deals-panel__title">
                Deals {incomingDeals.length > 0 && <span className="business-doubles-badge" style={{ marginLeft: 6 }}>📩 {incomingDeals.length} NEW</span>}
              </span>
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
                  <span className="business-deal-card__leg"> - You get: {bundleSummary(d.offerCash, d.offerLand, d.offerBuildings)}</span>
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
                  <span className="business-deal-card__leg"> - You give: {bundleSummary(d.offerCash, d.offerLand, d.offerBuildings)}</span>
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

        {/* All Players Cash Summary */}
        <div className="business-build-panel" style={{ width: '100%' }}>
          <div className="business-build-panel__title">💰 All Players</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {players.map(p => {
              const isTurn = currentTurn === p.id;
              const isMe = p.id === playerId;
              const isBankrupt = bankrupt.includes(p.id);
              const pProps = BOARD.filter((t) => ownership[t.pos]?.land === p.id).length;
              return (
                <div
                  key={p.id}
                  className={`business-cash-row${isTurn ? ' business-cash-row--turn' : ''}${isBankrupt ? ' business-cash-row--bankrupt' : ''}`}
                >
                  <span className="business-cash-row__swatch" style={{ background: '#3B0F73' }} />
                  <span className="business-cash-row__name">
                    {p.name}
                    {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
                    {isBankrupt && <span className="tag-faint" style={{ marginLeft: 4 }}>(bankrupt)</span>}
                    {skipNext.includes(p.id) && <span className="tag-faint" style={{ marginLeft: 4 }}>(skips next)</span>}
                    <span className="tag-faint" style={{ marginLeft: 6 }}>🏠 {pProps} props</span>
                  </span>
                  <span className={`business-cash-row__cash${(cash[p.id] ?? 0) < 0 ? ' business-cash-row__cash--debt' : ''}`}>
                    ₹{(cash[p.id] ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
