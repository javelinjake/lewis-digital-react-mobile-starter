# Backend

Each app has its own backend, `apps/<slug>/api`: Next.js hosting Payload (data and admin) and Better Auth (sign-in), on Postgres. No public pages. It is built from `@ld/backend`.

## Why one backend per app

Each app has its own database, accounts, admin and blast radius, and a client's data never shares a table with another's. Privacy comes from owner-scoped access rules, not from tenant plugins.

## Accounts

Better Auth stores its data in Payload collections. Sign-in methods are chosen per app in `app.meta.ts`: email and password (with verification), guest accounts, Apple, Google. Google needs Apple too (App Store rule); the backend refuses to start otherwise.

- **Web**: an httpOnly session cookie. The client calls `/api` on its own origin; Vercel forwards it (see deployment), so the cookie is first party.
- **Native**: the session token is sent as `Authorization: Bearer`, kept in Keychain or Keystore. The backend exposes it to the WebView through `Access-Control-Expose-Headers: set-auth-token`.
- **Guests** can later create an account. They sign in to it from the same device and the backend moves their data across.
- **Admins** are a `role` on the same user. Members cannot reach `/admin`, change their role, or set `role` at sign-up. Create the first admin with `cms:bootstrap-admin` before exposing the API: the first account on an empty database becomes admin.
- Ask "who am I" with `getSession()`, never `/api/users/me` (it fails for bearer tokens). Better Auth ids are strings, Payload ids are numbers.

## Privacy model

`ownedCollection({ slug, fields })` is the only way to declare user data. It adds an `owner` the member cannot choose or change, read/update/delete limited to the owner, and an idempotent create: `POST /api/<slug>/idempotent` with a `clientMutationId` returns the existing document on a retry. The architecture check fails a collection that is neither owned nor marked `// architecture: public-data`.

The integration tests prove isolation over REST: reading by id, filtering by another owner, OR filters, updating, deleting, reassigning, and the users collection itself.

## Actions

Anything that grants, charges or rolls is a `defineAction`: signed in, `Idempotency-Key` required, rate limited, and run in one transaction. A retry with the same key returns the first answer. A failure releases the key. The path must not begin with a collection slug (the backend refuses to start if it does).

## Purchases

RevenueCat posts to `/api/purchases/revenuecat` with a shared secret. Each event id is applied once, in one transaction with the entitlement change and your `onEvent` grants. The RevenueCat app user id must be the backend user id.

## Housekeeping and compliance

`/api/cron/cleanup` (daily, protected by `CRON_SECRET`) prunes idempotency keys and rate-limit rows. `DELETE /api/account` removes a user and everything they own (App Store requirement). `GET /api/account/export` returns their data.

## Environment

See `apps/<slug>/api/.env.example`. Production refuses to start without a real `PAYLOAD_SECRET`, a `BETTER_AUTH_SECRET` of 32+ characters, a database, `APP_ORIGINS`, and Resend. In development email is written to `.data/mail` instead of sent.
