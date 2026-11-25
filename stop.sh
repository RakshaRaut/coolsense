#!/usr/bin/env bash
# Stop the CoolSense development stack. Containers and data are kept.
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env before stopping the stack." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found in PATH." >&2
  exit 1
fi

COMPOSE=(
  docker compose
  --project-name coolsense
  --project-directory "$PROJECT_ROOT"
  --env-file "$ENV_FILE"
  --file "$COMPOSE_FILE"
)

echo "Stopping the CoolSense development stack..."
"${COMPOSE[@]}" stop

# Best effort: remove CoolSense images left untagged by rebuilds.
docker image prune -f --filter label=com.docker.compose.project=coolsense >/dev/null 2>&1 || {
  echo "Warning: unable to prune unused CoolSense images." >&2
}
