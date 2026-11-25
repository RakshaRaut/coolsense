#!/usr/bin/env bash
# Run CoolSense in the foreground. Ctrl+C or closing the terminal stops everything.
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and set JWT_SECRET." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required; 'docker compose' is unavailable." >&2
  exit 1
fi

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required to prevent multiple run.sh instances." >&2
  exit 1
fi

COMPOSE=(
  docker compose
  --project-name coolsense
  --project-directory "$PROJECT_ROOT"
  --env-file "$ENV_FILE"
  --file "$COMPOSE_FILE"
)

# One instance only: a second run.sh would attach to the same containers
# and stop them when it exits. Take the lock before setting the trap.
exec 9>/tmp/coolsense-run.lock
if ! flock -n 9; then
  echo "CoolSense is already running from another run.sh. Stop it there or run $PROJECT_ROOT/stop.sh." >&2
  exit 1
fi

cleanup() {
  local status=$?
  trap - EXIT
  echo "Stopping the CoolSense development stack..."
  if ! "${COMPOSE[@]}" stop; then
    echo "Failed to stop the CoolSense development stack; run $PROJECT_ROOT/stop.sh." >&2
    (( status != 0 )) || status=1
  fi
  exit "$status"
}
trap cleanup EXIT

echo "Starting the CoolSense development stack from $PROJECT_ROOT..."
if grep -Eq '^THINGSBOARD_ENABLED=["]?true["]?([[:space:]]|$)' "$ENV_FILE"; then
  echo "ThingsBoard integration is enabled; its service must be managed separately."
fi
"${COMPOSE[@]}" up --build
