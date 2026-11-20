# CoolSense

## Run the full stack with Docker Compose

1. Copy `.env.example` to `.env` in the repository root and set a private
   `JWT_SECRET`.
2. Set `THINGSBOARD_ENABLED=true` and provide tenant-admin credentials when
   ThingsBoard synchronization is required. `THINGSBOARD_DOCKER_URL` must be
   reachable from the backend container; use `host.docker.internal` for an
   installation on the Docker host or a Compose service name for a container.
3. Start the stack in the foreground, and press Ctrl+C to stop it:

   ```sh
   ./run.sh
   ```

   If the terminal was closed without a clean stop, run `./stop.sh`. Nothing
   restarts on its own: the services have no restart policy.

When `THINGSBOARD_ENABLED=true`, `run.sh` also starts ThingsBoard and its
database from `~/Desktop/pulseGrid` (HTTP on 18080, MQTT on 11883).
`thingsboard.override.yml` caps the JVM heap at 768 MB. `stop.sh` stops
ThingsBoard too, including when pulseGrid itself is using it.

The backend hot-reloads from the mounted `backend/src` and `backend/prisma`.
The frontend container serves a production build, which `run.sh` rebuilds on
each start. For frontend hot reload, run `npm run dev` in `frontend/` on the
host (Node 22). It proxies `/api` and `/socket.io` to `localhost:3000`.

The backend waits for PostgreSQL, applies pending Prisma migrations with
`prisma migrate deploy` (without resetting the database), and then starts. The
existing `coolsense_postgres_data` volume is retained. The API is available at
`http://localhost:3000/api/v1`, the frontend at `http://localhost:5173`, and
PostgreSQL at `localhost:5434` by default.
If the frontend or backend host port is already in use, set `FRONTEND_PORT` or
`BACKEND_PORT` in `.env` before starting. Also update `FRONTEND_URL` to match a
non-default frontend port so Socket.IO CORS allows the browser origin.

To check PostgreSQL readiness and migration state:

```sh
docker compose exec database pg_isready
docker compose exec backend npm run db:deploy
```

Do not use `docker compose down -v` if you want to keep PostgreSQL data.

## Run locally

1. Copy `.env.example` to `.env` and set `JWT_SECRET`.
2. Start PostgreSQL with `docker compose up -d database`.
3. From `backend/`, install dependencies, apply migrations, and start the API:

   ```sh
   npm ci
   npm run db:deploy
   npm run start:dev
   ```
