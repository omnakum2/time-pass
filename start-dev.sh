#!/usr/bin/env bash
# Starts both the WebSocket relay server and the Vite dev client.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Prediction Card Game (dev)..."
echo "  Server → http://localhost:3001"
echo "  Client → http://localhost:5173"
echo ""

npx concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "cyan,green" \
  "npx ts-node-dev --project \"$ROOT/server/tsconfig.json\" --transpile-only \"$ROOT/server/src/index.ts\"" \
  "npx vite --config \"$ROOT/client/vite.config.ts\""
