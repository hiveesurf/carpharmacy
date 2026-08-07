# CARNALYSYS (car_rent)

Monorepo with:
- Frontend: React + Vite (repository root)
- Backend: Spring Boot API (`backend/`)

## Deployment quick links

- Local runbook:
  - `docs/run-local.md`
- API testing runbook:
  - `docs/run-api-testing.md`
- UAT/prod deployment runbook:
  - `docs/run-deploy.md`
- Config reference (local/UAT/prod):
  - `docs/config-reference.md`

## Backend Server Docker Deployment

Use `docker-compose.app-prod.yml` to run the backend with host-mounted folders so config and uploads persist across deploys.

## Full-stack Docker (frontend + backend + Postgres)

Run the entire stack locally in containers:

```bash
docker compose -f docker-compose.fullstack.yml up -d --build
```

Endpoints:
- Frontend: `http://127.0.0.1:5199`
- Backend API: `http://127.0.0.1:8080/api/v1/health`

### Server folder layout

Create this structure on server (default root: `/opt/carnalysys/backend`):

- `config/application-prod.yml`
- `.env.prod`
- `uploads/vehicles/`
- `uploads/receipts/`
- `uploads/avatars/`
- `logs/`

### One-command restart

From repo root:

```bash
./scripts/restart-backend-prod.sh
```

Useful override:

```bash
CARNALYSYS_SERVER_ROOT=/your/path ./scripts/restart-backend-prod.sh
```

### Notes

- Backend reads external config from `config/application-prod.yml` (mounted inside container at `/app/config`).
- After editing properties, run restart script and changes apply on next startup.
- Keep `APP_JWT_SECRET` only in server `.env.prod` and keep JWT access tokens time-bounded.

### Admin access

Operators sign in through the storefront **phone + OTP** flow (`POST /api/v1/auth/send-otp`, `POST /api/v1/auth/verify-otp`). Admin APIs require `Authorization: Bearer <JWT>` when the verified phone matches `admin_users.phone_e164`. See `docs/API.md` for details. There is no email/password admin login.

## API rate limiting

The Spring Boot API applies in-memory token-bucket rate limits (Bucket4j) per client. There is no dedicated API gateway or Redis in the default fullstack compose stack — a single `api` instance is assumed. If you scale to multiple API replicas, switch to a shared backend (e.g. Redis) before relying on these limits in production.

### Default tiers

| Tier | Paths (examples) | Default | Key |
|------|------------------|---------|-----|
| Auth | `/api/v1/auth/send-otp`, `verify-otp`, `refresh-token` | 5 / 60s per IP | IP (+ temporary lockout after repeated hits) |
| Public read | GET/HEAD/OPTIONS under `/api/v1/**` (non-admin) | 120 / 60s | User ID if logged in, else IP |
| Public write | POST/PUT/PATCH/DELETE under `/api/v1/**` (non-admin) | 20 / 60s | User ID if logged in, else IP |
| Admin | `/api/v1/admin/**` | 200 / 60s | Admin principal / user ID |
| Excluded | `/api/v1/payments/webhook`, `/api/v1/health`, `/actuator/health`, `/actuator/info` | none | — |

Exceeded limits return **HTTP 429** with JSON `{ "success": false, "error": { "code": "RATE_LIMITED", ... } }` and a `Retry-After` header. Violations are logged at WARN as `RATE_LIMITED tier=... key=... path=...`.

### Tuning (no code change)

Set in `application.yml` / env (examples):

```bash
APP_RATE_LIMIT_ENABLED=true
APP_RATE_LIMIT_AUTH_CAPACITY=5
APP_RATE_LIMIT_AUTH_WINDOW_SECONDS=60
APP_RATE_LIMIT_AUTH_LOCKOUT_AFTER=3
APP_RATE_LIMIT_AUTH_LOCKOUT_SECONDS=900
APP_RATE_LIMIT_PUBLIC_READ_CAPACITY=120
APP_RATE_LIMIT_PUBLIC_WRITE_CAPACITY=20
APP_RATE_LIMIT_ADMIN_CAPACITY=200
```

Or override YAML under `app.rate-limit` (see `backend/src/main/resources/application.yml`). The `test` profile disables rate limiting by default so unit/WebMvc tests stay deterministic.
