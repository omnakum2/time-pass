# Prediction Card Game

A real-time, browser-based multiplayer trick-taking prediction game (the *Judgment / Oh Hell / Kachuful* family). Players predict how many tricks they'll win each round, and score points only for exact predictions.

---

## Features

- **2–7 players** — host sets the player cap when creating a room
- **7 rounds** counting down (7 cards → 1 card each)
- **Rotating trump suit** — Diamonds → Clubs → Hearts → Spades → repeating
- **Exact-bid scoring** — bid 3 and win 3 → +33; miss → penalty
- **Live multiplayer** over WebSockets — server authoritative, hands never sent to wrong players
- **Auto-timers** — 30 s to bid, 30 s to play a card; server auto-acts on timeout
- **Reconnect support** — refresh the page and rejoin your seat within 60 s
- **Mobile-first UI** — works on phones and desktops
- **Scoreboard** — live-updating table with per-round deltas and running totals
- **Winner screen** — confetti celebration, handles ties and all-negative scores

---

## Tech Stack

| Layer | Tech |
|---|---|
| Client | React 18 + Vite + TypeScript |
| Server | Node.js + `ws` WebSocket relay |
| Shared logic | Pure TypeScript (no framework) |
| Animations | Framer Motion |
| Confetti | canvas-confetti |
| State | Zustand |
| Monorepo | npm workspaces |

---

## Project Structure

```
prediction-card-game/
├── package.json          # root workspace config
├── shared/               # pure game logic + types (shared by client & server)
│   └── src/
│       ├── types.ts      # Card, GameState, all WebSocket message types
│       └── engine.ts     # createDeck, deal, trumpForRound, legalMoves,
│                         #   trickWinner, scoreRound
├── server/               # Node WebSocket relay (authoritative)
│   └── src/
│       ├── index.ts      # WS server, room registry, message routing
│       └── room.ts       # Room class — state machine, timers, redaction
└── client/               # React + Vite SPA
    └── src/
        ├── net/          # WebSocket client, auto-reconnect
        ├── store/        # Zustand global state
        ├── pages/        # Home, Lobby, Game, Winner
        └── components/   # CardView, HandView, TrickArea, BidPanel,
                          #   PlayerChip, Scoreboard, Popup, TurnTimer, …
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
cd "Prediction Card Game"
npm install
```

### Run in development

```bash
npm run dev
```

This starts both the server and client concurrently:

| Service | URL |
|---|---|
| Client (Vite) | http://localhost:5173 |
| Server (WS relay) | ws://localhost:3001 |

Open **http://localhost:5173** in your browser.

### Build for production

```bash
npm run build --workspace=client
```

---

## Playing on the Same Network (LAN)

1. Find your local IP:
   ```bash
   ip addr show | grep "inet " | grep -v 127.0.0.1
   ```
2. Run `npm run dev` on your machine.
3. Other devices on the same Wi-Fi open:
   ```
   http://<your-ip>:5173
   ```
4. If a firewall blocks access:
   ```bash
   sudo ufw allow 5173 && sudo ufw allow 3001
   ```

---

## Game Rules

### Rounds & Cards
- 7 rounds, counting down: Round 7 (7 cards each) → Round 1 (1 card each).
- Every player receives exactly `roundNumber` cards from a freshly shuffled 52-card deck.
- Maximum 7 players (7 × 7 = 49 cards ≤ 52).

### Trump Rotation
| Round | 7 | 6 | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|---|---|
| Trump | ♦ | ♣ | ♥ | ♠ | ♦ | ♣ | ♥ |

### Bidding
- Sequential from the rotating first bidder.
- Legal bids: `0` to `roundNumber`.
- All bids are visible to everyone once placed.
- **30 s** to place a bid — auto-bid **0** on timeout.

### Playing a Trick
- Leader plays any card; that suit becomes the **lead suit**.
- Others **must follow the lead suit** if they hold it; otherwise any card.
- **Highest trump** played wins; if no trump, **highest lead-suit card** wins.
- Trick winner leads the next trick.
- **30 s** to play a card — auto-plays first legal card on timeout.

### Scoring

| Situation | Points |
|---|---|
| Bid `b > 0`, won exactly `b` | `b × 11` (e.g. bid 3 → **+33**) |
| Bid `0`, won `0` | **+10** |
| Bid `0`, won `> 0` | **−10** |
| Bid `b > 0`, won `≠ b` | **−(b × 10)** (e.g. bid 3 → **−30**) |

### Game End
- After Round 1, the **highest total score wins** (even if all scores are negative).
- Ties → co-winners.

---

## Room Lifecycle

| Event | Behaviour |
|---|---|
| Player leaves before game starts | Seat removed from lobby |
| Host leaves during game | Game ends immediately, current standings shown |
| Non-host disconnects | Seat held for **60 s**; turns auto-resolve via timers |
| Browser refresh | Reconnect via token — continues your turn |
| Reconnect window expires | Seat stays and keeps auto-playing |
| Room becomes empty | Destroyed after **2 minutes** |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | WebSocket server port |
| `VITE_WS_URL` | `ws://<hostname>:3001` | Override WS URL for production |

---

## Deployment

**Client** — deploy the `client/dist/` folder to any static host (Netlify, Vercel, GitHub Pages).  
Set `VITE_WS_URL` to your server's public WebSocket URL before building.

**Server** — deploy `server/` to any Node host (Render, Railway, Fly.io).  
Set the `PORT` environment variable as required by your host.
