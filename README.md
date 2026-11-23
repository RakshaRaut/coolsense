# CoolSense

**Smart AC Monitoring, Control, and Software Simulation Platform**

CoolSense is a full-stack HVAC application for managing virtual AC devices,
running room simulations, monitoring telemetry, and viewing energy analytics.
It is **100% software-only**; no physical hardware is required.

## Table of Contents

- [Overview](#overview)
- [Features and Status](#features-and-status)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Simulation Logic](#simulation-logic)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

## Overview

The project provides:

- JWT-based user accounts
- Virtual AC device configuration and control
- Software simulation of room temperature and humidity
- Live state updates with Socket.IO
- Telemetry storage and historical analytics
- Optional ThingsBoard synchronization
- PostgreSQL persistence with automatic retention

## Features and Status

| Status | Features |
| --- | --- |
| Implemented | Registration/login, devices, AC controls, thermostat simulation, telemetry, analytics, activity history, REST APIs, Socket.IO, and Docker startup |
| Partial | ThingsBoard synchronization; requires an external ThingsBoard installation and tenant-administrator credentials |
| Partial | In-browser mock mode using `VITE_USE_MOCK=true`; separate from the normal backend transport |
| Partial | NestJS Observe instrumentation; requires Observe app credentials |
| Proposed | CI/CD, refresh-token rotation, real production hardware protocols, and Swagger publication |

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router,
  TanStack Query, Axios, Recharts, Socket.IO Client
- **Backend:** NestJS 12, TypeScript, Passport/JWT, Socket.IO
- **Database:** PostgreSQL 16 and Prisma 7
- **Testing:** Vitest, Supertest, Oxlint
- **Infrastructure:** Docker, Docker Compose, Node.js 22
- **Optional integration:** ThingsBoard REST API

## Architecture

```mermaid
flowchart LR
    Browser["React frontend"]
    API["NestJS REST API\n/api/v1"]
    WS["JWT-authenticated Socket.IO"]
    Engine["Simulation engine"]
    DB[("PostgreSQL")]
    TB["Optional ThingsBoard"]

    Browser --> API
    Browser <-->|Live updates| WS
    API --> Engine
    Engine --> DB
    API --> DB
    API -.-> TB
```

## Directory Structure

```text
coolsense/
├── backend/
│   ├── prisma/              # Schema and migrations
│   ├── src/
│   │   ├── ac-control/      # AC commands
│   │   ├── activity/        # Activity feed
│   │   ├── analytics/       # Energy and temperature analytics
│   │   ├── auth/            # Registration, login, JWT
│   │   ├── devices/         # Device CRUD
│   │   ├── simulation/      # Engine, scheduler, lifecycle
│   │   ├── telemetry/       # Telemetry and retention
│   │   ├── thingsboard/     # Optional external integration
│   │   └── users/
│   └── test/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── contexts/
│       ├── pages/
│       ├── services/
│       └── types/
├── docker-compose.yml
├── .env.example
├── run.sh
├── stop.sh
└── thingsboard.override.yml
```

## Setup

### Prerequisites

- Ubuntu/Linux with Bash
- Docker Engine and Docker Compose
- Node.js 22 and npm for local development

### Docker quick start

```bash
cp .env.example .env
# Set a private JWT_SECRET in .env
./run.sh
```

Open:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- PostgreSQL: `localhost:5434`

Stop without deleting database data:

```bash
./stop.sh
```

### Local development

```bash
cp .env.example .env
docker compose up -d database

cd backend
npm ci
npm run db:deploy
npm run start:dev
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The backend runs on port `3000`; the Vite frontend runs on port `5173`.

### Prisma migrations

```bash
cd backend
npm run db:deploy                 # Apply migrations
npm run db:migrate                # Create a development migration
npm run db:generate               # Regenerate Prisma client
```


## Testing

Backend:

```bash
cd backend
npm test
npm run test:e2e
npm run test:cov
npm run lint
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run preview
```

The frontend package does not define a `test` script or contain a frontend test
suite.

## Docker Deployment

Compose starts PostgreSQL, the NestJS backend, and the production-built
frontend:

```bash
cp .env.example .env
./run.sh
```

Database migrations run automatically on backend startup. PostgreSQL data is
kept in the `coolsense_postgres_data` volume.

Useful commands:

```bash
docker compose ps
docker compose logs backend
docker compose exec database pg_isready
docker compose exec backend npm run db:deploy
```

Do not run `docker compose down -v` unless intentionally deleting PostgreSQL
data.

For ThingsBoard, set `THINGSBOARD_ENABLED=true` and provide tenant credentials.
`run.sh` expects an existing `~/Desktop/pulseGrid` Compose deployment.

## Troubleshooting

- **Missing `.env`:** copy `.env.example` and set `JWT_SECRET`.
- **Port conflict:** change `BACKEND_PORT` or `FRONTEND_PORT`, and update
  `FRONTEND_URL` for a new frontend origin.
- **Socket.IO rejected:** confirm the JWT is supplied and the frontend origin
  is allowed.
- **PostgreSQL unavailable:** run `docker compose ps`, inspect
  `docker compose logs database`, and check `pg_isready`.
- **Migration failure:** run `docker compose exec backend npm run db:deploy`
  and inspect backend logs.
- **ThingsBoard failure:** verify the enabled flag, credentials, URL
  reachability, and tenant permissions.

## Future Improvements

Proposed, not implemented:

- Frontend unit and end-to-end testing
- CI/CD workflows
- Swagger/OpenAPI documentation
- Refresh-token rotation
- Role-based authorization
- Real COP-based HVAC efficiency
- Configurable currency and units
- Production alerting and observability dashboards
- Production secret management and TLS
- Expanded ThingsBoard MQTT and bidirectional commands
