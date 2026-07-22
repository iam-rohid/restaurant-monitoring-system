import z from "zod"
import { OpeningInterval } from "@/lib/db/schema"
import { AvailabilityCheckResult } from "./types"

const OpenStatusSchema = z
  .object({
    is_open: z.boolean(),
    value: z.string().nullish(), // "Open until 01:00" — display only
    next_open: z.string().nullish(), // ISO timestamps, venue-local offset
    next_close: z.string().nullish(),
  })
  .loose()

const DeliveryTimeEventSchema = z
  .object({
    type: z.enum(["open", "close"]),
    value: z.number().int().min(0).max(86400), // SECONDS from local midnight
  })
  .loose()

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
type DayKey = (typeof DAY_KEYS)[number]

export const WoltDynamicSchema = z
  .object({
    venue: z
      .object({
        id: z.string(),
        online: z.boolean(), // accepting orders right now
        delivery_open_status: OpenStatusSchema, // delivery-specific
        open_status: OpenStatusSchema, // venue itself (pickup)
      })
      .loose(),
    venue_raw: z
      .object({
        alive: z.boolean(),
        delivery_specs: z
          .object({
            delivery_enabled: z.boolean(),
            delivery_times: z.record(
              z.enum(DAY_KEYS),
              z.array(DeliveryTimeEventSchema)
            ),
          })
          .loose(),
      })
      .loose(),
  })
  .loose()

export type WoltDynamic = z.infer<typeof WoltDynamicSchema>

const DAY_S = 86400
const WEEK_S = 7 * DAY_S

export type WeekInterval = {
  /** seconds from Monday 00:00 local time */
  openS: number
  /** may exceed WEEK_S when the last interval wraps into Monday */
  closeS: number
}

export function buildWeekIntervals(
  deliveryTimes: Record<DayKey, { type: "open" | "close"; value: number }[]>
): WeekInterval[] {
  const events: { type: "open" | "close"; atS: number }[] = []
  DAY_KEYS.forEach((day, i) => {
    for (const e of deliveryTimes[day] ?? []) {
      events.push({ type: e.type, atS: i * DAY_S + e.value })
    }
  })
  events.sort((a, b) => a.atS - b.atS)

  if (events.length === 0) return []

  const intervals: WeekInterval[] = []
  // If the week's first event is a "close", the venue is open across the
  // Sunday->Monday wrap: rotate so we always start pairing at an "open".
  const firstOpenIdx = events.findIndex((e) => e.type === "open")
  if (firstOpenIdx === -1) return [] // only closes — treat as never open

  const rotated = [
    ...events.slice(firstOpenIdx),
    ...events.slice(0, firstOpenIdx),
  ]

  for (let i = 0; i < rotated.length; i += 2) {
    const open = rotated[i]
    const close = rotated[i + 1]
    if (open?.type !== "open" || close?.type !== "close") {
      // Malformed pairing — surface as parse error rather than guessing.
      throw new Error(
        `Unpaired open/close events in delivery_times at index ${i}`
      )
    }
    const closeS = close.atS > open.atS ? close.atS : close.atS + WEEK_S // wraps the week
    intervals.push({ openS: open.atS, closeS })
  }
  return intervals
}

/** Is the venue EXPECTED to be open at a given local moment? */
export function isExpectedOpen(
  intervals: WeekInterval[],
  localWeekSecond: number // seconds since Monday 00:00 in the VENUE's timezone
): boolean {
  return intervals.some(
    (iv) =>
      (localWeekSecond >= iv.openS && localWeekSecond < iv.closeS) ||
      // wrapped interval also covers the start of the week
      (iv.closeS > WEEK_S && localWeekSecond < iv.closeS - WEEK_S)
  )
}

/** Seconds since Monday 00:00 in an IANA timezone, for "now". */
export function localWeekSecond(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0"
  const dayIdx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    get("weekday")
  )
  return (
    dayIdx * DAY_S +
    Number(get("hour")) * 3600 +
    Number(get("minute")) * 60 +
    Number(get("second"))
  )
}

/**
 * Today's intervals in the shape stored on availability_checks
 * (minutes from local midnight; closesAtMin may exceed 1440 for overnight).
 */
export function todayIntervals(
  intervals: WeekInterval[],
  timezone: string,
  now = new Date()
): OpeningInterval[] {
  const nowS = localWeekSecond(timezone, now)
  const dayStartS = Math.floor(nowS / DAY_S) * DAY_S
  return intervals
    .filter((iv) => iv.openS >= dayStartS && iv.openS < dayStartS + DAY_S)
    .map((iv) => ({
      opensAtMin: Math.round((iv.openS - dayStartS) / 60),
      closesAtMin: Math.round((iv.closeS - dayStartS) / 60),
    }))
}

export function extractWoltSlug(input: string): string | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null // not a URL at all
  }

  if (!/(^|\.)wolt\.com$/.test(url.hostname)) return null

  // Path shape: /{lang}/{country}/{city}/restaurant/{slug}
  // (also accept "venue", which Wolt uses for some listings)
  const parts = url.pathname.split("/").filter(Boolean)
  const typeIdx = parts.findIndex((p) => p === "restaurant" || p === "venue")
  if (typeIdx === -1 || typeIdx !== parts.length - 2) return null

  const slug = parts[typeIdx + 1]
  return /^[a-z0-9-]+$/i.test(slug) ? slug : null
}

export const checkAvailabilityOnWolt = async (opts: {
  url: string
  lat: number
  lng: number
  timezone: string
}): Promise<AvailabilityCheckResult> => {
  const slug = extractWoltSlug(opts.url)
  if (!slug) {
    return {
      status: "fetch_error",
      errorMessage: "Invalid wolt url",
    }
  }

  const url = new URL(
    `https://consumer-api.wolt.com/order-xp/web/v1/venue/slug/${encodeURIComponent(slug)}/dynamic/`
  )
  url.searchParams.set("lat", String(opts.lat))
  url.searchParams.set("lon", String(opts.lng))
  url.searchParams.set("selected_delivery_method", "homedelivery")

  let json: unknown

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return {
        status: "fetch_error",
        errorMessage: `HTTP ${res.status} for ${slug}`,
      }
    }
    json = await res.json()
  } catch (error) {
    return {
      status: "fetch_error",
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }

  const parsed = WoltDynamicSchema.safeParse(json)

  if (!parsed.success) {
    return {
      status: "parse_error",
      errorMessage: parsed.error.message,
    }
  }

  const { venue, venue_raw } = parsed.data

  let intervals: WeekInterval[]
  try {
    intervals = buildWeekIntervals(venue_raw.delivery_specs.delivery_times)
  } catch (err) {
    return {
      status: "parse_error",
      errorMessage: err instanceof Error ? err.message : String(err),
      rawPayload: json,
    }
  }

  return {
    status: "ok",
    isAvailable: venue.online && venue.delivery_open_status.is_open,
    expectedOpen: isExpectedOpen(intervals, localWeekSecond(opts.timezone)),
    openingHours: todayIntervals(intervals, opts.timezone),
    rawPayload: json,
  }
}
