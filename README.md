# SafeConnect App

SafeConnect is a simple browser-based safety companion with:

- SOS alert capture
- Check-in submission
- Courier onboarding
- A health endpoint that reports whether the app is using Prisma or a safe development fallback

## Run locally

1. Create a local env file from the template:

```bash
cp .env.example .env
```

2. Install dependencies and start the app server:

```bash
npm install
npm start
```

Then visit `http://localhost:3000`.

## Deploy on Vercel

1. In Vercel Project Settings, set environment variables from [.env.example](.env.example):
	- `DATABASE_URL`
	- `DIRECT_URL`
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `ADMIN_API_KEY`
	- `TWILIO_ACCOUNT_SID`
	- `TWILIO_AUTH_TOKEN`
	- `TWILIO_FROM_NUMBER` (E.164 format, for example `+15551234567`)
	- `NOTIFICATIONS_CRON_SECRET`
	- `RATE_LIMIT_WINDOW_MS`
	- `RATE_LIMIT_MAX_WRITES`
2. Redeploy the latest commit.
3. Verify the API health endpoint:

```bash
curl https://<your-production-domain>/api/health
```

Expected response includes:
- `status: "ok"`
- `storage: "prisma"` or `"fallback"`
- `adminAuthEnabled: true` when `ADMIN_API_KEY` is configured
- `env.twilioConfigured: true` when Twilio credentials are configured
- `env.notificationsCronConfigured: true` when notification processing auth is configured

## Twilio SMS Setup

1. Add the following values to local `.env` and your Vercel environment variables:
	- `TWILIO_ACCOUNT_SID`
	- `TWILIO_AUTH_TOKEN`
	- `TWILIO_FROM_NUMBER`
2. If you use the notifications processing endpoint manually or via a cron job, include:
	- `NOTIFICATIONS_CRON_SECRET`
3. Trigger message processing with your auth header:

```bash
curl -X POST \
  -H "Authorization: Bearer <your-notifications-cron-secret>" \
  https://<your-production-domain>/api/notifications/process
```

If Twilio values are missing, message processing will fail with `Twilio credentials are not configured.`

## Rate Limiting

Write endpoints (`POST /api/sos`, `POST /api/checkin`, `POST /api/onboarding`) are rate-limited per IP.

- `RATE_LIMIT_WINDOW_MS` defaults to `60000`
- `RATE_LIMIT_MAX_WRITES` defaults to `30`

When the limit is exceeded the API returns `429` with `Retry-After`.

## Admin Endpoint Access

The read-only admin endpoints require the `x-admin-api-key` header:

```bash
curl -H "x-admin-api-key: <your-admin-api-key>" https://<your-production-domain>/api/sos
curl -H "x-admin-api-key: <your-admin-api-key>" https://<your-production-domain>/api/checkin
```

## Uptime Monitoring

GitHub Actions runs an uptime check workflow every 5 minutes at [.github/workflows/uptime-check.yml](.github/workflows/uptime-check.yml).

- It checks `GET /api/health`
- It fails if health is not `ok`, storage is not `prisma`, or admin auth is disabled
- On failure it creates (or comments on) an alert issue in this repository

## Post-Deploy Smoke Check

Run the production smoke checklist with:

```bash
PROD_URL=https://<your-production-domain> ADMIN_API_KEY=<your-admin-api-key> npm run smoke:prod
```

## Notes

If `DATABASE_URL` is unavailable or the generated Prisma client does not match the current SafeConnect API models, the server automatically switches to an in-memory development mode so the frontend and API flows remain usable.

For Supabase pooler URLs (`*.pooler.supabase.com`), the server normalizes Prisma connection parameters to include `pgbouncer=true` and `connection_limit=1` at runtime to avoid prepared statement conflicts in serverless environments.
