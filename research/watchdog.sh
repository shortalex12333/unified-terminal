#!/usr/bin/env bash
set -euo pipefail
CMD_FILE="$1"
PID_FILE="$2"
LOG_FILE="$3"
END_TS="$4" # epoch seconds to stop monitoring
while true; do
  now=$(date +%s)
  if [ "$now" -ge "$END_TS" ]; then
    exit 0
  fi
  if [ -s "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1; then
    sleep 120
    continue
  fi
  if [ ! -s "$CMD_FILE" ]; then
    sleep 60
    continue
  fi
  CMD=$(cat "$CMD_FILE")
  nohup script -q "$LOG_FILE" bash -lc "$CMD" >/dev/null 2>&1 &
  echo $! > "$PID_FILE"
  sleep 120
done
