#!/usr/bin/env bash
# Stop CoolSense and the ThingsBoard it uses. Containers and data are kept.
cd "$(dirname "$0")"

docker compose stop
docker compose -p pulsegrid -f "$HOME/Desktop/pulseGrid/docker-compose.yml" \
  -f "$PWD/thingsboard.override.yml" stop thingsboard thingsboard-db

# Best effort: remove CoolSense images left untagged by rebuilds. It fails
# harmlessly when another prune is already running.
docker image prune -f --filter label=com.docker.compose.project=coolsense >/dev/null 2>&1 || true
