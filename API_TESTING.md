# CoolSense API testing (Ubuntu)

The API is served at `http://localhost:3000/api/v1`. The commands below use
`curl` and `jq`; install them on Ubuntu with `sudo apt install curl jq` if needed.

## Start PostgreSQL and the backend

From the repository root, copy `.env.example` to `.env`, set a private random
`JWT_SECRET`, and ensure `DATABASE_URL` points to the Compose PostgreSQL service
(port `5434` by default). Then run:

```bash
openssl rand -base64 48
# Put the generated value in the repository-root .env:
# JWT_SECRET=<generated-value>
# JWT_EXPIRES_IN=1d
docker compose up -d database
cd backend
npm install
npm run db:deploy
npm run start:dev
```

In a second terminal:

```bash
export BASE_URL="http://localhost:3000/api/v1"
curl -fsS "$BASE_URL/health" | jq
curl -i "$BASE_URL/"
```

Health returns `200` and confirms the PostgreSQL query succeeded. Registration
and login are public; all user, device, control, telemetry, and simulation
routes require `Authorization: Bearer <JWT>`.

## Register, log in, and get an authenticated user

The unique email lets this block be rerun. Registration returns a JWT and the
new user record. The password must be at least eight characters.

```bash
export TEST_EMAIL="coolsense-$(date +%s)@example.com"
export TEST_PASSWORD="CoolSense-test-2026!"

export REGISTER_RESPONSE="$(
  curl -fsS -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Terminal Tester\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
)"
export JWT="$(printf '%s' "$REGISTER_RESPONSE" | jq -r '.accessToken')"
printf '%s\n' "$REGISTER_RESPONSE" | jq '{user, tokenReceived: (.accessToken | length > 0)}'

curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | jq

curl -fsS "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $JWT" | jq

# Existing alias retained for clients using /users/me.
curl -fsS "$BASE_URL/users/me" \
  -H "Authorization: Bearer $JWT" | jq
```

## Create and retrieve a device

The device ID returned by `POST /devices` is a UUID. Save it before using the
device-specific routes.

```bash
export DEVICE_RESPONSE="$(
  curl -fsS -X POST "$BASE_URL/devices" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"name":"Living room AC","acType":"NON_INVERTER"}'
)"
export DEVICE_ID="$(printf '%s' "$DEVICE_RESPONSE" | jq -r '.id')"
printf 'DEVICE_ID=%s\n' "$DEVICE_ID"
printf '%s\n' "$DEVICE_RESPONSE" | jq

curl -fsS "$BASE_URL/devices" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS "$BASE_URL/devices/$DEVICE_ID" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS -X PATCH "$BASE_URL/devices/$DEVICE_ID" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated living room AC"}' | jq

# Existing device-state route retained for compatibility.
curl -fsS "$BASE_URL/devices/$DEVICE_ID/state" \
  -H "Authorization: Bearer $JWT" | jq
```

## Control the AC

These PATCH routes persist the requested setting, advance the simulation engine,
and record a telemetry sample in PostgreSQL.

```bash
curl -fsS -X PATCH "$BASE_URL/ac-control/$DEVICE_ID/power" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"power":true}' | jq

curl -fsS -X PATCH "$BASE_URL/ac-control/$DEVICE_ID/temperature" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"targetTemperature":22}' | jq

curl -fsS -X PATCH "$BASE_URL/ac-control/$DEVICE_ID/mode" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"mode":"COOL"}' | jq

curl -fsS -X PATCH "$BASE_URL/ac-control/$DEVICE_ID/fan-speed" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"fanSpeed":"HIGH"}' | jq
```

The former combined control endpoint is also retained for the existing frontend:

```bash
curl -fsS -X POST "$BASE_URL/devices/$DEVICE_ID/control" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"power":true,"mode":"cool","fanSpeed":"auto","targetTempC":23}' | jq
```

The former individual POST control paths and the combined PATCH alias are also
available:

```bash
curl -fsS -X PATCH "$BASE_URL/ac-control/$DEVICE_ID" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"power":true,"mode":"cool","fanSpeed":"auto","targetTempC":23}' | jq

curl -fsS -X POST "$BASE_URL/devices/$DEVICE_ID/control/power" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d '{"power":true}' | jq
curl -fsS -X POST "$BASE_URL/devices/$DEVICE_ID/control/temperature" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d '{"targetTemperature":22}' | jq
curl -fsS -X POST "$BASE_URL/devices/$DEVICE_ID/control/mode" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d '{"mode":"COOL"}' | jq
curl -fsS -X POST "$BASE_URL/devices/$DEVICE_ID/control/fan" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d '{"fanSpeed":"HIGH"}' | jq
```

## Start, inspect, and stop a simulation

Simulation state is persisted on the device; temperature, humidity, compressor
state, power, energy, and telemetry advance on a background interval. The
optional `environment` values are validated before use.

```bash
curl -fsS -X POST "$BASE_URL/simulation/start" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"speed\":30,\"targetTempC\":22,\"mode\":\"cool\",\"fanSpeed\":\"auto\",\"environment\":{\"outsideTempC\":35,\"humidityPct\":60,\"areaM2\":24,\"heightM\":2.7,\"heatGainW\":500}}" | jq

# The unaffiliated session endpoint and its explicit status alias.
curl -fsS "$BASE_URL/simulation" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS "$BASE_URL/simulation/status?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS "$BASE_URL/simulation/$DEVICE_ID/status" \
  -H "Authorization: Bearer $JWT" | jq

# Optional session controls implemented for existing frontend clients.
curl -fsS -X POST "$BASE_URL/simulation/pause" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\"}" | jq
curl -fsS -X POST "$BASE_URL/simulation/resume" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\"}" | jq
curl -fsS -X PATCH "$BASE_URL/simulation/speed" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"speed\":10}" | jq
curl -fsS -X PATCH "$BASE_URL/simulation/environment" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"outsideTempC\":32,\"humidityPct\":55,\"targetTempC\":21}" | jq

sleep 2
curl -fsS "$BASE_URL/simulation/series?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS -X POST "$BASE_URL/simulation/stop" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\"}" | jq

# Reset returns the device to its initial simulated room state.
curl -fsS -X POST "$BASE_URL/simulation/reset" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\"}" | jq
```

### Persisted simulation management

The management API gives each simulation a UUID and maintains its own status,
configuration, state, and history. `config` can override device simulation
configuration; `{}` uses the device defaults.

```bash
export SIMULATION_RESPONSE="$(
  curl -fsS -X POST "$BASE_URL/simulations" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Living room test\",\"deviceId\":\"$DEVICE_ID\",\"config\":{\"targetTemperature\":22,\"simulationSpeed\":30,\"mode\":\"COOL\",\"fanSpeed\":\"AUTO\"}}"
)"
export SIMULATION_ID="$(printf '%s' "$SIMULATION_RESPONSE" | jq -r '.id')"
printf '%s\n' "$SIMULATION_RESPONSE" | jq

curl -fsS "$BASE_URL/simulations" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS "$BASE_URL/simulations/$SIMULATION_ID" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS -X POST "$BASE_URL/simulations/$SIMULATION_ID/start" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS -X PATCH "$BASE_URL/simulations/$SIMULATION_ID/config" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"targetTemperature":21,"mode":"COOL","fanSpeed":"HIGH","ambientTemperature":34,"simulationSpeed":10}' | jq
curl -fsS "$BASE_URL/simulations/$SIMULATION_ID/state" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS "$BASE_URL/simulations/$SIMULATION_ID/history?limit=100" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS -X POST "$BASE_URL/simulations/$SIMULATION_ID/pause" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS -X POST "$BASE_URL/simulations/$SIMULATION_ID/resume" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS -X POST "$BASE_URL/simulations/$SIMULATION_ID/stop" \
  -H "Authorization: Bearer $JWT" | jq
curl -fsS -X POST "$BASE_URL/simulations/$SIMULATION_ID/reset" \
  -H "Authorization: Bearer $JWT" | jq
```

## Read telemetry and history

`/telemetry` returns persisted database rows (newest first). `/history` returns
the frontend-compatible simulation sample shape in chronological order.

```bash
curl -fsS "$BASE_URL/devices/$DEVICE_ID/telemetry?limit=100" \
  -H "Authorization: Bearer $JWT" | jq

curl -fsS "$BASE_URL/devices/$DEVICE_ID/history?range=86400&limit=120" \
  -H "Authorization: Bearer $JWT" | jq
```

## Validation and error checks

Device path parameters must be UUIDs. Invalid DTOs or UUIDs return `400`,
missing/invalid JWTs return `401`, and devices not owned by the authenticated
user return `404`.

```bash
# Invalid UUID -> 400
curl -i "$BASE_URL/devices/not-a-uuid" \
  -H "Authorization: Bearer $JWT"

# Invalid input -> 400
curl -i -X PATCH "$BASE_URL/ac-control/$DEVICE_ID/temperature" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"targetTemperature":99}'

# Missing JWT -> 401
curl -i "$BASE_URL/devices"
```

## Delete the test device

```bash
curl -i -X DELETE "$BASE_URL/devices/$DEVICE_ID" \
  -H "Authorization: Bearer $JWT"
```
