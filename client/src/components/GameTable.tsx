import React from 'react';

// ─── GameTable ──────────────────────────────────────────────────────────────
// Shared, slot-based layout scaffold for the in-game table. Renders EXACTLY the
// wrapper structure both game pages share (game-area → game-panel → table-wrap
// with top/middle rows, my-strip, hand-area). Pure layout — no game logic.

interface GameTableProps {
  opponents: React.ReactNode; // goes in .table-top-row
  center: React.ReactNode;    // goes in .table-middle-row
  myStrip: React.ReactNode;   // goes in .my-strip
  hand: React.ReactNode;      // goes in .hand-area
}

export function GameTable({ opponents, center, myStrip, hand }: GameTableProps) {
  return (
    <div className="game-area">
      <div className="game-panel">
        <div className="table-wrap">
          <div className="table-top-row">{opponents}</div>
          <div className="table-middle-row">{center}</div>
        </div>
        <div className="my-strip">{myStrip}</div>
        <div className="hand-area">{hand}</div>
      </div>
    </div>
  );
}
