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
2. Redeploy the latest commit.
3. Verify the API health endpoint:

```bash
curl https://<your-production-domain>/api/health
```

Expected response includes:
- `status: "ok"`
- `storage: "prisma"` or `"fallback"`

## Notes

If `DATABASE_URL` is unavailable or the generated Prisma client does not match the current SafeConnect API models, the server automatically switches to an in-memory development mode so the frontend and API flows remain usable.
