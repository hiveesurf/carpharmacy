# Configuration Reference (Local/UAT/Prod)

## Environment contract

| Target | Backend profile | Backend env file | Frontend env mode/file | Compose file |
|---|---|---|---|---|
| Local (JVM+Vite) | `local` | optional `backend/.env.local` | `local` -> `.env.local` | `docker-compose.yml` (db/pgadmin) |
| Local (full Docker) | `local` | optional `backend/.env.local` | Docker build args | `docker-compose.fullstack.yml` |
| UAT | `uat` | `backend/.env.uat` | `uat` -> `.env.uat` | `docker-compose.app-uat.yml` |
| Prod | `prod` | server `.env.prod` | `production` -> `.env.production` | `docker-compose.app-prod.yml` |

## Backend config files

- Base defaults: `backend/src/main/resources/application.yml`
- Local overrides: `backend/src/main/resources/application-local.yml`
- UAT overrides: `backend/src/main/resources/application-uat.yml`
- Prod overrides: `backend/src/main/resources/application-prod.yml`

## Required backend variables for UAT/Prod

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `APP_JWT_SECRET`
- `APP_PAYMENT_WEBHOOK_SECRET`
- `APP_CORS_ALLOWED_ORIGINS`

## Twilio / WhatsApp variables (login OTP + business notifications)

Backend (`backend/.env.local`, `.env.uat`, `.env.prod` as applicable):

- `WHATSAPP_ENABLED` — `true` to send login OTP and business notifications via Twilio
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- `TWILIO_WHATSAPP_TEMPLATE_OTP_SID` — login OTP template (falls back to plain text if unset)
- `TWILIO_WHATSAPP_TEMPLATE_DELIVERY_OTP_SID`, `TWILIO_WHATSAPP_TEMPLATE_LOW_STOCK_SID`
- `TWILIO_WHATSAPP_TEMPLATE_PLACED_SID`, `_CONFIRMED_`, `_PROCESSING_`, `_SHIPPED_`, `_DELIVERED_`, `_CANCELLED_` — order status
- `ADMIN_WHATSAPP_NUMBER` — low-stock WhatsApp recipient

Login uses `POST /auth/send-otp` and `POST /auth/verify-otp` (no third-party client SDK on the frontend).

## Frontend API strategy (canonical)

Use relative API base (`/api/v1`) for UAT/prod builds.

- `.env.uat` -> `VITE_API_BASE=/api/v1`
- `.env.production` -> `VITE_API_BASE=/api/v1`

For Vercel, `/api/*` is forwarded by `vercel.json` to backend.

For local Vite dev, when `VITE_API_BASE` is blank, proxy `/api` uses `VITE_DEV_API_PROXY` (default `http://127.0.0.1:8080`).

## Storage path rules

- Local defaults come from `application-local.yml`.
- UAT/prod use env-driven paths (`CARNALYSYS_STORAGE_*`) with sane defaults in profile files.
- Production compose mounts server folders into `/app/storage/*`.

## Port defaults

- Frontend: `5199`
- Backend: `8080`
- Postgres: `5432`
- pgAdmin: `5050`
