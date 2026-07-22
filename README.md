# Restaurant Monitoring System

Restaurant chains list their locations on delivery platforms like Wolt. Those listings go offline all the time — a tablet dies, someone forgets to reopen after a break, the platform hiccups — and nobody notices until the orders stop coming in.

This app polls each listing every 5 minutes, compares what the platform says against the location's opening hours, and flags the ones that should be taking orders but aren't.

## Tech Stack

- **Next.js 16** (App Router) + React 19
- **tRPC** + React Query for the data layer
- **Drizzle ORM** on **Neon** Postgres
- **Upstash QStash** for the scheduled checks
- **Tailwind CSS** + shadcn/ui
- **Zod** for validating whatever the platform APIs hand back

## Getting Started

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill it in:

```bash
DATABASE_URL=                 # Neon connection string
QSTASH_CURRENT_SIGNING_KEY=   # from the Upstash QStash console
QSTASH_NEXT_SIGNING_KEY=
```

Push the schema and start the dev server:

```bash
pnpm migrate
pnpm dev
```

Then hit `http://localhost:3000/api/seed` once to load the sample chains and locations (Berlin McDonald's listings on Wolt). It's idempotent, so re-running it is fine.

Other scripts: `pnpm generate` (new migration after schema changes), `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## How the availability check works

`POST /api/tasks/check-availability` is the endpoint QStash calls. It's wrapped in `verifySignatureAppRouter`, so requests without a valid QStash signature are rejected — there's no manual secret to pass around.

What it does on each run:

1. Loads every active listing joined with its location (coordinates and timezone).
2. For each one, calls the platform-specific checker in `src/helpers/check-availability/`. Right now that's Wolt only; the switch on `platform` is where a new platform slots in.
3. Writes one row into `availability_checks` per listing — either an `ok` result or a `fetch_error` / `parse_error` with the message.
4. Sleeps 500ms between listings so we're not hammering the platform.

### The Wolt checker

It pulls the venue slug out of the listing URL and calls Wolt's public consumer API with the location's lat/lng — delivery availability depends on where you're ordering from.

Two different things come out of the response:

- **Actual availability** — `venue.online && delivery_open_status.is_open`. Is it accepting delivery orders right now?
- **Expected availability** — Wolt also returns the weekly delivery schedule as open/close events in seconds from local midnight. We pair those into intervals across the whole week (handling venues that close after midnight and wrap past Sunday), then check where "now" falls in the venue's own timezone.

The raw payload gets stored alongside the result, which makes it much easier to figure out what happened when a check looks wrong.

### Reading it back

The dashboard asks tRPC for the latest check per listing. The interesting case is when expected and actual disagree — the location should be open but the listing is offline. That's the one worth acting on, and it's what the UI highlights.

A check older than 15 minutes (3 missed runs) is marked stale, so a dead cron shows up as "we don't know" instead of quietly serving old data.

## The cron job

Set up in the Upstash QStash console as a schedule:

- **Destination:** `https://<your-domain>/api/tasks/check-availability`
- **Method:** `POST`
- **Cron:** `*/5 * * * *`

QStash signs every request with the keys above, retries failures on its own, and keeps a log of past deliveries.

## Adding a platform

1. Add it to `deliveryPlatformEnum` in `src/lib/db/schema.ts` and generate a migration.
2. Write a checker in `src/helpers/check-availability/` that returns an `AvailabilityCheckResult`.
3. Add the case to the switch in `check-availability/index.ts`.

Everything downstream — storage, staleness, the dashboard — works off that shared result type, so it doesn't need to change.
