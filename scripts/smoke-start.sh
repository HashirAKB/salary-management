#!/usr/bin/env bash
# Boots the built API (apps/api/dist/main.js) and checks it answers /api/health, so a server
# that builds but crashes on its first request fails CI (S2 deploy on Render did exactly that).
# Run after `npm run build`. Uses a throwaway SQLite file and logs at info, like production.
set -euo pipefail

PORT="${SMOKE_PORT:-3100}"
DB="$(mktemp -d)/smoke.db"
LOG="$(mktemp)"

DATABASE_URL="file:${DB}" PORT="$PORT" LOG_LEVEL=info node apps/api/dist/main.js >"$LOG" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" -H 'Cookie: sid=smoke-test' >/dev/null 2>&1; then
    # The server must also survive having logged that request.
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      echo "smoke start ok: /api/health answered and the server is still running"
      exit 0
    fi
    break
  fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done

echo "smoke start FAILED; server output:" >&2
cat "$LOG" >&2
exit 1
