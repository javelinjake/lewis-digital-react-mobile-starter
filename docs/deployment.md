# Deployment

Two Vercel projects per app, in the same repository, with **Skip unaffected projects** on and squash merges (so a change to one app does not rebuild the others).

## api project

Root directory `apps/<slug>/api`. It has a `vercel.json`: Next.js, region `lhr1`, build `pnpm run build:vercel`, and a daily cron for cleanup.

1. Add the **Neon** integration. It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (used for migrations). Create Neon in `eu-west-2` to match `lhr1`.
2. Set `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `APP_ORIGINS` (the app's web origin, comma separated), `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `REVENUECAT_WEBHOOK_SECRET`, and `PAYLOAD_ADMIN_EMAIL` / `PAYLOAD_ADMIN_PASSWORD` for the first deploy. Add the Apple and Google values for methods you enable.
3. The build runs the migrations, creates the first admin (if the variables are set), then builds.
4. Point RevenueCat's webhook at `https://<api>/api/purchases/revenuecat` with the Authorization header set to the secret.

## app project

Root directory `apps/<slug>/app`. Its `vercel.ts` (read at build time) sends `/api` to the backend and sets cache and security headers. Set **`API_ORIGIN`** to the api's address, for Production and for Preview (Preview can point at the production API or a preview API). `build:vercel` builds a live web PWA and refuses mock data.

Only the production deployment may be indexed (`robots.txt`). A game's web build is a playtest: turn on Deployment Protection.

## Checks before you promote

Open the preview and check: sign in works (cookie), `/api/health` is OK through the app's own origin, and a hard refresh on a deep link loads. CI already ran mobile Lighthouse and the bundle budget.
