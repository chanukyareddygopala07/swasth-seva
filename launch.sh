#!/usr/bin/env bash
# Launch Swasth Seva (frontend + backend + public tunnel) — idempotent, safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

LOG_DIR="${TMPDIR:-/tmp}/swasth-seva"
mkdir -p "$LOG_DIR"

echo "==> 1/5 PostgreSQL"
if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
  brew services start postgresql@18 >/dev/null
  for _ in $(seq 1 20); do pg_isready -q -h localhost -p 5432 && break; sleep 1; done
fi
pg_isready -q -h localhost -p 5432 || { echo "PostgreSQL did not start"; exit 1; }
psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='swasth'" | grep -q 1 || psql -d postgres -c "CREATE ROLE swasth WITH LOGIN PASSWORD 'swasth_secret' CREATEDB;"
psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='swasthseva'" | grep -q 1 || psql -d postgres -c "CREATE DATABASE swasthseva OWNER swasth;"

echo "==> 2/5 Backend deps"
cd backend
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt

echo "==> 3/5 Migrations + seed + AI models"
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed
if [ ! -d ai_models ]; then
  .venv/bin/python -m app.ai.train
fi

echo "==> 4/5 Frontend build"
cd ../frontend
if [ ! -f out/index.html ] || [ -n "$(find src -newer out/index.html 2>/dev/null | head -1)" ]; then
  npm run build
fi

echo "==> 5/5 Servers + tunnel"
cd ../backend
if ! pgrep -f "uvicorn app.main:app" >/dev/null; then
  nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$LOG_DIR/backend.log" 2>&1 &
  for _ in $(seq 1 15); do curl -sf http://localhost:8000/api/v1/health >/dev/null && break; sleep 1; done
fi
if ! pgrep -f "cloudflared tunnel --url" >/dev/null; then
  nohup cloudflared tunnel --url http://localhost:8000 >"$LOG_DIR/tunnel.log" 2>&1 &
  for _ in $(seq 1 15); do grep -qE "trycloudflare\.com" "$LOG_DIR/tunnel.log" && break; sleep 1; done
fi

URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG_DIR/tunnel.log" | head -1)
echo ""
echo "  Local API + site: http://localhost:8000  (docs: /docs)"
echo "  Public tunnel:    ${URL:-starting... (see $LOG_DIR/tunnel.log)}"
echo "  Logs:             $LOG_DIR/{backend,tunnel}.log"
