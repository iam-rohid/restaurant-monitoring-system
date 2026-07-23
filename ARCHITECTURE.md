# Architecture

This document describes how the Restaurant Monitoring System is built today, where it starts to hurt as you add more restaurants, and how I would grow it into a production system that comfortably tracks 10,000+ listings while staying close to real time.

## 1. What exists today

The whole thing runs as a single Next.js 16 app deployed on Vercel, backed by Neon Postgres. There is no separate backend service. The moving parts are:

- **Data model** (`src/lib/db/schema.ts`): `chains` → `locations` → `listings` → `availability_checks`. A chain has many locations, a location has one listing per platform, and every poll appends a row to `availability_checks`. That last table is append-only and holds the raw platform payload alongside the parsed result, which is what makes debugging a weird check possible after the fact.
- **The poller** (`src/app/api/tasks/check-availability/route.ts`): a single API route that Upstash QStash calls on a `*/5 * * * *` schedule. It loads every active listing, loops through them one at a time, calls the platform checker, writes a result row, and sleeps 500ms between each to be polite to the platform.
- **The checker** (`src/helpers/check-availability/`): platform-specific logic behind a shared `AvailabilityCheckResult` type. Right now Wolt is the only implementation. It compares two things: what the platform actually reports right now (`actual` availability) versus what the venue's own published hours say it should be (`expected`). The gap between those two is the whole point of the product.
- **The dashboard** (tRPC + React Query): reads the latest check per listing. Anything older than 15 minutes (three missed runs) is treated as stale, so a dead cron shows up as "we don't know" rather than silently serving old data.

This design is clean and correct for a few hundred listings. The rest of this document is about what changes when there are tens of thousands.

## 2. Where the current design breaks at scale

There is one bottleneck that matters more than everything else: **the poller is a single sequential loop.**

At 10,000 listings, the 500ms politeness gap alone is 5,000 seconds, roughly 83 minutes, before you count the network time of the actual HTTP calls. That does not fit in a 5-minute window, and it does not fit inside a serverless function's execution limit either. One slow platform response also stalls every listing queued behind it, and if the function crashes at listing 6,000 you lose the run and have no idea which listings were checked.

So the scaling story is really about turning that one loop into many small, independent, retryable units of work. Everything else (the database, the dashboard, notifications) is a smaller adjustment on top of that.

## 3. Target architecture for 10,000+ listings

The core idea is **fan-out**. Instead of one job that checks everything, a scheduler enqueues one message per listing (or per small batch), and a pool of workers drains that queue in parallel. QStash is already in the stack and already does this well, so the shape below builds on what is there rather than replacing it.

### The flow

```
                        every 1-5 min
                             │
                    ┌────────▼─────────┐
                    │  Scheduler job   │  loads due listings,
                    │  (cron / QStash) │  enqueues one msg each
                    └────────┬─────────┘
                             │  fan-out
                    ┌────────▼─────────┐
                    │   QStash queue   │  retries, backoff,
                    │  (or SQS/Redis)  │  rate-limit per platform
                    └────────┬─────────┘
              ┌──────────────┼──────────────┐
        ┌─────▼────┐   ┌─────▼────┐    ┌─────▼────┐
        │ worker   │   │ worker   │ …  │ worker   │  check one listing,
        └─────┬────┘   └─────┬────┘    └─────┬────┘  write one result row
              └──────────────┼──────────────┘
                    ┌────────▼─────────┐
                    │  Postgres (Neon) │  append availability_checks
                    │  + latest-state  │  update per-listing state row
                    └────────┬─────────┘
                             │ state changed to mismatch?
                    ┌────────▼─────────┐
                    │  Notifier        │  Slack / email / PagerDuty
                    └──────────────────┘
```

### Scheduler

A small job that runs on a cron. Its only responsibility is to find listings that are due for a check and drop one queue message per listing. It does not do any HTTP work itself, so it stays fast and cheap no matter how many listings there are.

This is also where **smart scheduling** lives, and it is the biggest lever for staying near real time without melting the platform APIs (more on that in section 5). A closed venue at 3am does not need a check every minute. A venue that is open and busy during peak hours does.

### Queue

The buffer between "we decided to check this" and "we actually checked it." Whether it's QStash, AWS SQS, or a Redis-backed queue, the queue gives us the properties the current loop lacks:

- **Parallelism**: many workers drain it at once, so 10,000 checks finish in the time one check takes, times however deep the backlog is.
- **Per-listing retries with backoff**: one failed check retries on its own without blocking or re-running the other 9,999.
- **Rate limiting per platform**: QStash supports throttling, so we can cap how fast we hit Wolt regardless of how many workers are running. The 500ms `sleep` in the current code becomes a queue-level rate limit, which is both more reliable and doesn't waste a worker sitting idle.

### Workers

Each worker handles one listing: call the checker, parse the result, write it. This is almost exactly the body of the current loop, lifted out. The checker code in `src/helpers/check-availability/` moves over essentially unchanged, which is the point of having kept it behind that shared result type.

Workers are stateless and horizontally scalable. On Vercel they can stay as serverless function invocations (one per message). If cost or cold starts become an issue at volume, the same worker code runs just as well on a container platform (Fly.io, ECS, Cloud Run) with a long-lived process pulling from the queue.

## 4. Resilience

A monitoring system that goes down silently is worse than useless, because people trust it and stop checking manually. So resilience gets specific attention.

- **No single point of failure in the poll path.** With the fan-out model, a crash takes out one listing's check, not the whole run. The queue holds the message and redelivers it.
- **Retries with backoff** are handled by the queue, not hand-rolled. Transient platform errors and blips recover on their own.
- **Idempotent writes.** Checks are append-only and each carries its own timestamp, so a redelivered message just writes a second row. Nothing gets corrupted by an at-least-once queue.
- **The staleness check is the watchdog.** The dashboard already flags any listing whose latest check is too old. That same signal is what tells us the pipeline itself is unhealthy: if the count of stale listings starts climbing, the monitoring system is failing, and that should page someone. In other words, we monitor the monitor.
- **Dead-letter queue.** Messages that fail every retry go to a DLQ instead of vanishing, so a listing that consistently fails (a changed URL, a delisted venue) surfaces for a human instead of quietly never being checked again.
- **Database resilience.** Neon handles managed backups and point-in-time recovery. The `availability_checks` table grows fast, so a retention policy (keep raw payloads for, say, 30 days, keep the parsed result longer) keeps it healthy. Neon's read replicas can serve the dashboard so heavy reads never contend with the write path.

## 5. Data currency at scale

The requirement is near real-time accuracy across tens of thousands of restaurants. Two things make that achievable without a brute-force "check everything every minute" approach that would get us rate-limited and cost a fortune.

**Parallelism sets the floor.** Once checks fan out across workers, total wall-clock time stops depending on how many listings there are and starts depending on how many workers run concurrently and how hard the platform lets us push. 10,000 checks at, say, 50 concurrent workers and a few hundred ms each is a couple of minutes, not 83.

**Adaptive scheduling sets the smarts.** Not every listing deserves the same attention:

- A venue that is **closed** by its own published hours barely needs checking. Poll it occasionally just to catch a schedule that's wrong.
- A venue that **should be open** is where mismatches matter, so poll it often, every minute or two.
- A venue that just **flipped into a mismatch state** is the most interesting of all. Check it more aggressively for a short window to confirm it's a real outage and not a one-off blip before alerting.

This means the check budget gets spent where it actually buys accuracy. You get near-real-time detection on the listings that matter while the long tail of closed or quiet venues costs almost nothing.

To make "did the state change" cheap to answer, I'd add a small **latest-state table**: one row per listing holding its current availability, expected state, and mismatch flag. Workers update it after each check. The dashboard reads from it directly (instant, no scanning the history table), and it's what the notifier watches for transitions. The full `availability_checks` history stays as the append-only audit log behind it.

## 6. Real-time mismatch notifications

The valuable event is a **transition**: a listing that was fine is now in a mismatch state (should be open, but the platform says offline). We alert on the edge, not on every check, otherwise the same broken venue pages the team every minute until it's fixed.

The flow:

1. A worker writes a check and updates the listing's latest-state row.
2. If the mismatch flag flips from false to true (or the reverse, for recovery notices), that transition is the trigger.
3. A **debounce / confirmation window** guards against flapping. Require the mismatch to hold for two or three consecutive checks before alerting, so a single flaky platform response doesn't wake anyone up.
4. Confirmed transitions go to a notifier that sends to wherever the ops team lives: a Slack channel is the natural default, with email or PagerDuty for anything that needs an ack.

Alerts should be **grouped and actionable**. "5 McDonald's Berlin listings went offline in the last 10 minutes" is a signal worth acting on; five separate messages one minute apart is noise. Batching by chain, area, or time window makes the difference between a tool people trust and one they mute.

Implementation-wise this can start as a direct call from the worker, but the clean version is a separate notifier fed by state transitions (a Postgres `LISTEN/NOTIFY`, a lightweight events queue, or a Cloudflare/Vercel cron that scans recent transitions). Keeping it separate means notification logic can change without touching the check path.

## 7. Expected cost at 10,000 listings

Rough monthly order-of-magnitude, assuming adaptive scheduling averages out to something like one check per active listing every 2 minutes (call it ~5-7 million checks/month after the closed-venue savings):

| Component | Choice | Rough monthly cost |
|---|---|---|
| Compute (workers) | Vercel serverless, or containers on Fly/Cloud Run | $20-150 depending on platform and whether you move workers to always-on containers |
| Queue | Upstash QStash (usage-priced per message) | $50-200 at a few million messages, less if batched |
| Database | Neon Postgres (compute + storage) | $30-100, driven mostly by write volume and how long raw payloads are retained |
| Notifications | Slack (free) / email (SES-class) | Negligible to ~$10 |
| **Total** | | **~$150-450 / month** |

The two dials that move this the most are **check frequency** (adaptive scheduling is what keeps QStash and compute costs down, easily a 2-3x saving over polling everything on a flat cadence) and **payload retention** (storing every raw platform response forever is what makes the database bill grow, so trim it). If message volume becomes the dominant cost, batching several listings per queue message trades a little parallelism for a big drop in per-message charges.

Nothing here needs enterprise-tier anything at 10k. The design stays on managed, usage-priced services, so the bill scales roughly linearly with how many restaurants are tracked rather than stepping up in big fixed chunks.

## 8. How the current code fits in

The good news is that most of the existing code survives the move, because the responsibilities are already split along the right lines.

- **`src/helpers/check-availability/`** (the checkers) moves into the worker essentially untouched. The `AvailabilityCheckResult` type and the platform switch are already the right seam. Adding a platform is still "write a checker, add a case," exactly as it is now.
- **`src/lib/db/schema.ts`** stays as the source of truth. The change is additive: a `latest-state` table for fast reads and transition detection, plus indexes and a retention policy on `availability_checks`. The existing tables don't change shape.
- **The poll route** (`check-availability/route.ts`) splits in two. The "load listings" part becomes the scheduler's enqueue logic. The "check one listing and write a row" part (the body of the loop) becomes the worker. The 500ms `sleep` becomes a queue-level rate limit.
- **The tRPC layer and dashboard** stay as they are, just pointed at the new latest-state table instead of computing the latest check per listing on every request. The staleness logic is already written and becomes part of the health watchdog.
- **QStash** stays, but its role grows from "call one cron endpoint" to "fan out and rate-limit per-listing messages."

So the path from here to the scaled system is evolutionary, not a rewrite. The current codebase is essentially the single-node version of the same architecture, and the production version is what you get by pulling the sequential loop apart into a scheduler and a pool of workers with a queue in between.
