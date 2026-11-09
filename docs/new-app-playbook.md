# New app playbook

## 1. Create it

```bash
pnpm create:app -- --name "My App"                       # prints a plan
pnpm create:app -- --name "My App" --write               # makes the files and installs
pnpm create:app -- --name "My Game" --kind game --bundle-id uk.co.lewisdigital.mygame --write
```

A game also gets `core` and `art`, a portrait phone-only identity, and a `playtest` web target. The new app is a working copy of the template (sign-in, notes, offline), so it starts green. Replace the example `notes` collection and screens with yours.

**Decide the bundle id first.** It cannot change once the App Store record exists. The scaffold gives a working id.

## 2. Run it

```bash
pnpm db:dev -- my_app                        # creates the databases
pnpm --filter @ld/api-my-app cms:migrate
pnpm --filter @ld/api-my-app dev
pnpm --filter @ld/app-my-app dev
```

## 3. Make it yours

- `apps/<slug>/app/app.meta.ts`: name, colours, hostname, orientation, tablet, per-environment api addresses, and which sign-in methods to offer. The api reads the sign-in list from here too.
- Collections: `apps/<slug>/api/cms/collections/`. Anything with user data uses `ownedCollection`. After changing one: `pnpm --filter <api> cms:types && cms:importmap && cms:migrate:create <name>`.
- Server-side rules that grant or charge: `defineAction` in `cms/actions/`.
- Theme and fonts: `src/assets/base.css`.

## 4. Definition of done

`pnpm review`, the app's production build, the api's integration tests, and the e2e suite. For a release also: mobile Lighthouse and the bundle budget (CI runs both).

## 5. Ship it

See [deployment](deployment.md) and [native release](native-release.md).
