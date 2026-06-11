# Environment Setup and Deployment

This document is a compatibility index. Canonical runbooks are:

- `docs/run-local.md`
- `docs/run-api-testing.md`
- `docs/run-deploy.md`
- `docs/config-reference.md`

## Profiles

- `local`: developer machine defaults, local DB/proxy convenience values.
- `uat`: pre-production validation, strict secret/env requirements.
- `prod`: production runtime, strict secret/env requirements and tighter logging.

Backend profiles are defined in:
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-local.yml`
- `backend/src/main/resources/application-uat.yml`
- `backend/src/main/resources/application-prod.yml`

Frontend environment modes are defined in:
- `.env.local`
- `.env.uat`
- `.env.production`

## Twilio OTP login + WhatsApp notifications

- Login OTP: `POST /auth/send-otp` → Twilio WhatsApp (`TWILIO_WHATSAPP_TEMPLATE_OTP_SID` or plain text).
- Verify: `POST /auth/verify-otp` → JWT + refresh cookie.
- Business alerts: order status, delivery OTP, low stock (same Twilio account; see `backend/.env.*.example`).

Configure Twilio in `backend/.env.local` (see `backend/.env.local.example`). Set `WHATSAPP_ENABLED=false` for local fixed demo OTP (`123456`).

## Local Development

### Start DB

```bash
docker compose up -d
```

### Start backend

```bash
cd backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

### Start frontend

```bash
npm run dev:local
```

### Local OTP test steps

1. Set Twilio vars in `backend/.env.local` (or `WHATSAPP_ENABLED=false` for demo `123456`).
2. Restart backend and frontend.
3. Open app → sign in → send OTP → verify.
4. Verify session endpoint works:

```bash
curl -i http://127.0.0.1:8080/api/v1/auth/me
```

7. Verify admin role mapping still works: login with a phone present in `admin_users.phone_e164`, then access `/admin` UI or `/api/v1/admin/**`.

Local auth/OTP note:
- Backend `local` profile allows common local frontend origins by default (`localhost`/`127.0.0.1` on `5173` and `5199`).
- If you use a different frontend origin/port, set:

```bash
APP_CORS_ALLOWED_ORIGINS=http://localhost:YOUR_PORT,http://127.0.0.1:YOUR_PORT
```

## Frontend Builds

```bash
npm run build:local
npm run build:uat
npm run build:prod
```

## Backend Docker Runtime

Copy template env files and fill values:

```bash
cp backend/.env.local.example backend/.env.local
cp backend/.env.uat.example backend/.env.uat
cp backend/.env.prod.example backend/.env.prod
```

Deploy using compose file per environment:

```bash
# local image tag (example)
CARNALYSYS_API_IMAGE=carnalysys-api:local docker compose -f docker-compose.app-local.yml up -d

# uat image tag from registry
CARNALYSYS_API_IMAGE=registry.example.com/carnalysys-api:<tag> docker compose -f docker-compose.app-uat.yml up -d

# prod image tag from registry
CARNALYSYS_API_IMAGE=registry.example.com/carnalysys-api:<tag> docker compose -f docker-compose.app-prod.yml up -d
```

## Required Environment Variables

Minimum required for `uat` and `prod`:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `APP_JWT_SECRET`
- `APP_PAYMENT_WEBHOOK_SECRET`
- `APP_CORS_ALLOWED_ORIGINS`

Do not commit real values; only commit example templates.

## UAT/Prod Deployment Runbook (No Data Loss)

1. Prepare release artifacts (backend image + frontend bundle) with immutable tag.
2. Freeze schema-changing merges until deployment completes.
3. Verify secrets/config in runtime environment.
4. Take database backup/snapshot (`pg_dump` and/or storage snapshot).
5. Verify restore procedure and rollback owner are ready.
6. Deploy to UAT and run smoke tests.
7. Promote same artifact to production.
8. Deploy backend first, check health, then deploy frontend.
9. Run post-deploy data integrity checks on critical tables.
10. Monitor for 24-48h (errors, auth, payment, DB performance).

Rollback:
- App-only issue: roll back to prior image tag.
- Migration/data issue: stop writes, restore DB from snapshot/backup, redeploy previous stable app.

## Security Baseline by Environment

- TLS termination with HTTPS-only redirection in UAT/prod.
- Strict CORS allowlist per environment domain.
- Secrets managed via CI/secret manager, not git.
- Security headers and cookie hardening enabled at reverse proxy and API.

## Production notes (Twilio)

- Store `TWILIO_AUTH_TOKEN` and related secrets in a secret manager, not git.
- Set `WHATSAPP_ENABLED=true` in UAT/prod; configure all required template SIDs.
- Monitor Twilio message quotas and delivery errors in logs.
