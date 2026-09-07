import { useState } from 'react';
import { BOARD } from 'shared';
import type { BusinessState } from 'shared';
import { sendMsg } from '../net/socket';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  state: BusinessState;
  playerId: string;
}

/** Toggle a tile position in/out of a selection set (returns a new set). */
function toggle(set: Set<number>, pos: number): Set<number> {
  const next = new Set(set);
  if (next.has(pos)) next.delete(pos);
  else next.add(pos);
  return next;
}

/**
 * BusinessDealModal — compose an async player-to-player trade. "You give" is the
 * proposer's bundle (offer*), "You get" is pulled from the chosen target (request*).
 * Land deeds and buildings toggle independently (split ownership is allowed).
 */
export function BusinessDealModal({ open, onClose, state, playerId }: Props) {
  const [target, setTarget] = useState('');
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerLand, setOfferLand] = useState<Set<number>>(new Set());
  const [offerBuildings, setOfferBuildings] = useState<Set<number>>(new Set());
  const [requestLand, setRequestLand] = useState<Set<number>>(new Set());
  const [requestBuildings, setRequestBuildings] = useState<Set<number>>(new Set());

  const { players, bankrupt, ownership, cash, colours } = state;

  // Everyone I can trade with: other players who aren't bankrupt.
  const targets = players.filter((p) => p.id !== playerId && !bankrupt.includes(p.id));

  const myCash = cash[playerId] ?? 0;
  const targetCash = target ? (cash[target] ?? 0) : 0;

  // Tiles each side can put on the table (land vs buildings owned separately).
  const myLand = BOARD.filter((t) => ownership[t.pos]?.land === playerId);
  const myBuildings = BOARD.filter((t) => ownership[t.pos]?.buildingOwner === playerId);
  const targetLand = target ? BOARD.filter((t) => ownership[t.pos]?.land === target) : [];
  const targetBuildings = target ? BOARD.filter((t) => ownership[t.pos]?.buildingOwner === target) : [];

  function reset() {
    setTarget('');
    setOfferCash(0);
    setRequestCash(0);
    setOfferLand(new Set());
    setOfferBuildings(new Set());
    setRequestLand(new Set());
    setRequestBuildings(new Set());
  }

  function close() {
    reset();
    onClose();
  }

  // Changing the target invalidates any "You get" tile picks (they belonged to the
  // previous target), so clear that side.
  function changeTarget(id: string) {
    setTarget(id);
    setRequestCash(0);
    setRequestLand(new Set());
    setRequestBuildings(new Set());
  }

  const nothingMoving =
    offerCash <= 0 &&
    requestCash <= 0 &&
    offerLand.size === 0 &&
    offerBuildings.size === 0 &&
    requestLand.size === 0 &&
    requestBuildings.size === 0;
  const canSend = target !== '' && !nothingMoving;

  function send() {
    if (!canSend) return;
    sendMsg({
      type: 'businessProposeDeal',
      to: target,
      offerCash: Math.max(0, offerCash),
      offerLand: [...offerLand],
      offerBuildings: [...offerBuildings],
      requestCash: Math.max(0, requestCash),
      requestLand: [...requestLand],
      requestBuildings: [...requestBuildings],
    });
    close();
  }

  const clampCash = (raw: string, max: number) => {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  };

  const chip = (
    pos: number,
    label: string,
    selected: boolean,
    onToggle: () => void,
  ) => (
    <button
      key={label}
      type="button"
      className={`business-deal-chip${selected ? ' business-deal-chip--on' : ''}`}
      onClick={onToggle}
    >
      {label}
    </button>
  );

  return (
    <Modal open={open} onClose={close} title="Propose a deal">
      <div className="business-deal-form">
        {/* Target ------------------------------------------------------------- */}
        <label className="business-deal-field">
          <span className="business-deal-label">Trade with</span>
          <select
            className="business-deal-select"
            value={target}
            onChange={(e) => changeTarget(e.target.value)}
          >
            <option value="">Select a player…</option>
            {targets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {/* You give ----------------------------------------------------------- */}
        <div className="business-deal-section">
          <div className="business-deal-section__title">You give</div>
          {myLand.length === 0 && myBuildings.length === 0 && (
            <div className="business-deal-empty">You own no deeds or buildings.</div>
          )}
          <div className="business-deal-chips">
            {myLand.map((t) =>
              chip(t.pos, `${t.name} (land)`, offerLand.has(t.pos), () =>
                setOfferLand((s) => toggle(s, t.pos)),
              ),
            )}
            {myBuildings.map((t) =>
              chip(t.pos, `${t.name} (buildings)`, offerBuildings.has(t.pos), () =>
                setOfferBuildings((s) => toggle(s, t.pos)),
              ),
            )}
          </div>
          <label className="business-deal-cash">
            <span>Cash</span>
            <input
              type="number"
              min={0}
              max={myCash}
              value={offerCash || ''}
              placeholder="0"
              onChange={(e) => setOfferCash(clampCash(e.target.value, myCash))}
            />
            <span className="business-deal-cash__hint">of ₹{myCash.toLocaleString('en-IN')}</span>
          </label>
        </div>

        {/* You get ------------------------------------------------------------ */}
        <div className="business-deal-section">
          <div className="business-deal-section__title">
            You get
            {target && (
              <span className="business-deal-section__who" style={{ color: colours[target] ?? 'var(--ink)' }}>
                {' '}from {players.find((p) => p.id === target)?.name}
              </span>
            )}
          </div>
          {!target && <div className="business-deal-empty">Pick a player above first.</div>}
          {target && targetLand.length === 0 && targetBuildings.length === 0 && (
            <div className="business-deal-empty">They own no deeds or buildings.</div>
          )}
          {target && (
            <>
              <div className="business-deal-chips">
                {targetLand.map((t) =>
                  chip(t.pos, `${t.name} (land)`, requestLand.has(t.pos), () =>
                    setRequestLand((s) => toggle(s, t.pos)),
                  ),
                )}
                {targetBuildings.map((t) =>
                  chip(t.pos, `${t.name} (buildings)`, requestBuildings.has(t.pos), () =>
                    setRequestBuildings((s) => toggle(s, t.pos)),
                  ),
                )}
              </div>
              <label className="business-deal-cash">
                <span>Cash</span>
                <input
                  type="number"
                  min={0}
                  max={targetCash}
                  value={requestCash || ''}
                  placeholder="0"
                  onChange={(e) => setRequestCash(clampCash(e.target.value, targetCash))}
                />
                <span className="business-deal-cash__hint">of ₹{targetCash.toLocaleString('en-IN')}</span>
              </label>
            </>
          )}
        </div>

        {/* Actions ------------------------------------------------------------ */}
        <div className="business-deal-actions">
          <button type="button" className="business-mini-btn business-mini-btn--sell" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="business-action-btn business-action-btn--roll"
            disabled={!canSend}
            onClick={send}
          >
            Send offer
          </button>
        </div>
      </div>
    </Modal>
  );
}
