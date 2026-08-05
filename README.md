# Jhatpat — browser multiplayer card game

A cross-device, real-time **trick-taking prediction game** (the *Judgment / Oh Hell / Kachuful* family).
Players join a room by code, predict how many tricks they'll win each round, and score only on an exact match.

## Monorepo layout (npm workspaces)

| Workspace | What it is |
|---|---|
| `shared/` | Pure game engine + shared TypeScript types (no DOM/Node deps). |
| `server/` | Authoritative WebSocket relay (Node + `ws`). Holds room/game state in memory. |
| `client/` | React + Vite single-page app. |

## Requirements
- **Node 20+** and npm.

## Development
```bash
npm install
npm run dev
```
- Client (Vite): http://localhost:5173
- Server (WS relay): ws://localhost:3000

The in-app rules are at `/guide` (English / Roman Hindi).

## Production build
```bash
npm run build
```
Produces:
- **Server:** `server/dist/index.js` — a single self-contained bundle (esbuild; `shared` is inlined).
- **Client:** `client/dist/` — static assets.

`npm run build` also type-checks all three workspaces (`tsc --noEmit`).

## Running in production (manual deploy)

**Server (Node host):**
```bash
npm ci
npm run build
PORT=3000 node server/dist/index.js
```
Run it under a process manager (pm2 / systemd) behind a **TLS reverse proxy** (e.g. nginx) that terminates HTTPS and upgrades the WebSocket to `wss://`. Open/allow the chosen port through the host firewall.

**Client (static host):**
```bash
# point the client at your public relay BEFORE building:
VITE_WS_URL=wss://your-domain.example npm run build --workspace=client
# then serve client/dist on any static host (nginx, Netlify, S3, GitHub Pages, ...)
```

## Environment variables

| Variable | Scope | Default | Purpose |
|---|---|---|---|
| `PORT` | server (runtime) | `3000` | WebSocket relay port. |
| `VITE_WS_URL` | client (**build time**) | `ws(s)://<page-host>:3000` | Relay URL the client connects to. **Set this in production.** If unset, the protocol follows the page (`wss://` on HTTPS). |

See `client/.env.example`.

## Notes
- State is **in-memory** and single-instance: a server restart drops active games, and it does not scale horizontally as-is.
- For LAN play, open the app via the host's IP (e.g. `http://192.168.x.x:5173`) so the derived relay URL points at the host; ensure the relay port is reachable.
