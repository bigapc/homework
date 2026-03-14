# SafeConnect App

SafeConnect is a simple browser-based safety companion with:

- SOS alert capture
- Check-in submission
- Courier onboarding
- A health endpoint that reports whether the app is using Prisma or a safe development fallback

## Run locally

Install dependencies and start the app server:

```bash
npm install
npm start
```

Then visit `http://localhost:3000`.

## Notes

If `DATABASE_URL` is unavailable or the generated Prisma client does not match the current SafeConnect API models, the server automatically switches to an in-memory development mode so the frontend and API flows remain usable.
