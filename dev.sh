#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend-stdout.log"
FRONTEND_LOG="$LOG_DIR/frontend-stdout.log"
PID_DIR="$LOG_DIR"

mkdir -p "$PID_DIR"

# ── Colors ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'

ts() { date '+%Y-%m-%d %H:%M:%S'; }

# ── Health checks ──
backend_healthy() {
  curl -m 3 -sf http://localhost:5000/health > /dev/null 2>&1
}

frontend_healthy() {
  curl -m 3 -sf http://localhost:3000 > /dev/null 2>&1
}

# ── Start ──
start_backend() {
  local pid
  pid=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -n "$pid" ]]; then
    echo -e "${YELLOW}$(ts) Backend already running (PID $pid)${NC}"
    return
  fi

  echo -e "${CYAN}$(ts) Starting backend...${NC}"
  cd "$BACKEND_DIR"
  setsid nohup node server.js > "$BACKEND_LOG" 2>&1 &
  disown
  echo $! > "$PID_DIR/backend.pid"

  # wait for health
  local i=0
  while (( i < 15 )); do
    sleep 1
    if backend_healthy; then
      echo -e "${GREEN}$(ts) Backend ready on :5000${NC} (PID $(cat "$PID_DIR/backend.pid"))"
      echo -e "${DIM}  logs: $LOG_DIR/combined.log | $LOG_DIR/error.log${NC}"
      return
    fi
    (( i++ ))
  done
  echo -e "${RED}$(ts) Backend started but health check failed after 15s. Check $BACKEND_LOG${NC}"
}

start_frontend() {
  local pid
  pid=$(ps aux | grep -E "next-server|next.*turbopack" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -n "$pid" ]]; then
    echo -e "${YELLOW}$(ts) Frontend already running (PID $pid)${NC}"
    return
  fi

  echo -e "${CYAN}$(ts) Starting frontend...${NC}"
  cd "$FRONTEND_DIR"
  nohup npx next dev --turbopack -p 3000 > "$FRONTEND_LOG" 2>&1 &
  disown
  echo $! > "$PID_DIR/frontend.pid"

  # wait for health
  local i=0
  while (( i < 20 )); do
    sleep 1
    if frontend_healthy; then
      echo -e "${GREEN}$(ts) Frontend ready on :3000${NC} (PID $(cat "$PID_DIR/frontend.pid"))"
      return
    fi
    (( i++ ))
  done
  echo -e "${RED}$(ts) Frontend started but health check failed after 20s. Check $FRONTEND_LOG${NC}"
}

# ── Stop ──
stop_backend() {
  local pid
  pid=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -z "$pid" ]]; then
    echo -e "${YELLOW}$(ts) Backend not running${NC}"
    return
  fi
  echo -e "${CYAN}$(ts) Stopping backend (PID $pid)...${NC}"
  kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  # wait for exit
  local i=0
  while (( i < 10 )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 1
    (( i++ ))
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    echo -e "${RED}$(ts) Backend force-killed${NC}"
  else
    echo -e "${GREEN}$(ts) Backend stopped${NC}"
  fi
  rm -f "$PID_DIR/backend.pid"
}

stop_frontend() {
  local pid
  pid=$(ps aux | grep -E "next-server|next.*turbopack" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -z "$pid" ]]; then
    echo -e "${YELLOW}$(ts) Frontend not running${NC}"
    return
  fi
  echo -e "${CYAN}$(ts) Stopping frontend (PID $pid)...${NC}"
  kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  local i=0
  while (( i < 10 )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 1
    (( i++ ))
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    echo -e "${RED}$(ts) Frontend force-killed${NC}"
  else
    echo -e "${GREEN}$(ts) Frontend stopped${NC}"
  fi
  rm -f "$PID_DIR/frontend.pid"
}

# ── Status ──
status() {
  echo -e "\n${CYAN}── Nabeeh Services ──${NC}\n"

  # Backend
  local bp
  bp=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -n "$bp" ]]; then
    local bmem
    bmem=$(ps -o rss= -p "$bp" 2>/dev/null | awk '{printf "%.0fMB", $1/1024}')
    if backend_healthy; then
      echo -e "  Backend   ${GREEN}● running${NC}  PID=$bp  mem=$bmem  :5000"
    else
      echo -e "  Backend   ${YELLOW}● unhealthy${NC}  PID=$bp  mem=$bmem  :5000 (health check failing)"
    fi
  else
    echo -e "  Backend   ${RED}● stopped${NC}"
  fi

  # Frontend
  local fp
  fp=$(ps aux | grep -E "next-server|next.*turbopack" | grep -v grep | awk '{print $2}' | head -1 || true)
  if [[ -n "$fp" ]]; then
    local fmem
    fmem=$(ps -o rss= -p "$fp" 2>/dev/null | awk '{printf "%.0fMB", $1/1024}')
    if frontend_healthy; then
      echo -e "  Frontend  ${GREEN}● running${NC}  PID=$fp  mem=$fmem  :3000"
    else
      echo -e "  Frontend  ${YELLOW}● unhealthy${NC}  PID=$fp  mem=$fmem  :3000 (health check failing)"
    fi
  else
    echo -e "  Frontend  ${RED}● stopped${NC}"
  fi

  # Log sizes
  echo -e "\n${CYAN}── Logs ──${NC}\n"
  for f in "$LOG_DIR"/*.log; do
    [[ -f "$f" ]] || continue
    local sz
    sz=$(du -h "$f" 2>/dev/null | cut -f1)
    echo -e "  $(basename "$f")  ${DIM}$sz${NC}"
  done
  echo ""
}

# ── Logs ──
logs() {
  local svc="${1:-all}"
  case "$svc" in
    backend)
      tail -f "$LOG_DIR/combined.log" "$LOG_DIR/error.log" 2>/dev/null
      ;;
    frontend)
      tail -f "$FRONTEND_LOG" 2>/dev/null
      ;;
    all)
      tail -f "$LOG_DIR/combined.log" "$LOG_DIR/error.log" "$FRONTEND_LOG" 2>/dev/null
      ;;
    *)
      echo "Usage: $0 logs [backend|frontend|all]"
      exit 1
      ;;
  esac
}

# ── Usage ──
usage() {
  cat <<EOF
$(basename "$0") — Nabeeh dev runner

Usage: $(basename "$0") <command> [args]

Commands:
  start              Start backend + frontend (with health checks)
  stop               Graceful shutdown (SIGTERM, fallback SIGKILL after 10s)
  restart            Stop then start
  status             PIDs, memory, health, log sizes
  backend            Start backend only
  frontend           Start frontend only
  logs [svc]         Tail logs (backend|frontend|all)

Logs:
  backend/logs/combined.log   Winston JSON — all requests
  backend/logs/error.log      Winston JSON — errors only
  logs/backend-stdout.log     stdout/stderr from node process
  logs/frontend-stdout.log    stdout/stderr from next dev
EOF
}

case "${1:-}" in
  start)
    start_backend
    start_frontend
    status
    ;;
  stop)
    stop_backend
    stop_frontend
    ;;
  restart)
    stop_backend
    stop_frontend
    sleep 1
    start_backend
    start_frontend
    status
    ;;
  status)
    status
    ;;
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  logs)
    logs "${2:-all}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
