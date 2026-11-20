#!/usr/bin/env bash
# Run CoolSense in the foreground. Ctrl+C or closing the terminal stops everything.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing .env: copy .env.example to .env and set JWT_SECRET" >&2; exit 1; }

# One instance only: a second run.sh would attach to the same containers
# and stop them when it exits. Take the lock before setting the trap.
exec 9>/tmp/coolsense-run.lock
flock -n 9 || { echo "CoolSense is already running from another ./run.sh. Stop it there or run ./stop.sh." >&2; exit 1; }

trap ./stop.sh EXIT

# ThingsBoard needs about 1 GB of RAM, so it starts only when enabled in .env.
if grep -q '^THINGSBOARD_ENABLED=true' .env; then
  docker compose -p pulsegrid -f "$HOME/Desktop/pulseGrid/docker-compose.yml" \
    -f "$PWD/thingsboard.override.yml" up -d thingsboard
fi

docker compose up --build
