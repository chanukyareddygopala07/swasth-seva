#!/usr/bin/env bash
# Stop Swasth Seva servers + tunnel (Postgres stays running).
pkill -f "cloudflared tunnel --url" 2>/dev/null && echo "tunnel stopped" || echo "tunnel not running"
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "backend stopped" || echo "backend not running"
echo "Postgres left running (stop with: brew services stop postgresql@18)"
