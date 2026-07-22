import { db } from "@/lib/db"
import {
  availabilityChecksTable,
  chainsTable,
  listingsTable,
  locationsTable,
  OpeningInterval,
} from "@/lib/db/schema"
import { TRPCError } from "@trpc/server"
import { desc, eq } from "drizzle-orm"
import z from "zod"
import { baseProcedure, createTRPCRouter } from "../init"

const STALE_AFTER_MS = 15 * 60 * 1000 // 3x the 5-min poll interval

const VERDICTS = [
  "available",
  "unavailable_expected_open",
  "closed",
  "available_expected_closed",
  "unknown",
] as const

type Verdict = (typeof VERDICTS)[number]

function localMinutes(timezone: string, at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get("hour") * 60 + get("minute")
}

function expectedOpenNow(intervals: OpeningInterval[], nowMin: number) {
  return intervals.some(
    (iv) =>
      (nowMin >= iv.opensAtMin && nowMin < iv.closesAtMin) ||
      // an overnight interval from "yesterday" still covering early "today"
      (iv.closesAtMin > 1440 && nowMin + 1440 < iv.closesAtMin)
  )
}

export const listingsRouter = createTRPCRouter({
  listAll: baseProcedure
    .input(z.object({ chainId: z.number() }))
    .query(async ({ input: { chainId } }) => {
      const [chain] = await db
        .select()
        .from(chainsTable)
        .where(eq(chainsTable.id, chainId))
      if (!chain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurant Chain not found",
        })
      }

      const locations = await db
        .select()
        .from(locationsTable)
        .where(eq(locationsTable.chainId, chain.id))

      return await Promise.all(
        locations.map(async (location) => {
          const listings = await db
            .select()
            .from(listingsTable)
            .where(eq(listingsTable.locationId, location.id))

          return {
            location,
            listings,
          }
        })
      )
    }),
  getAvailabilityStatus: baseProcedure
    .input(z.object({ listingId: z.number() }))
    .output(
      z.object({
        isAvailable: z.boolean().nullable(),
        expectedOpen: z.boolean().nullable(),
        checkedAt: z.date().nullable(),
        stale: z.boolean(),
        verdict: z.enum(VERDICTS),
        openHoursToday: z
          .array(
            z.object({
              opensAtMin: z.number(),
              closesAtMin: z.number(),
            })
          )
          .optional(),
        reason: z.string().nullable().optional(),
      })
    )
    .query(async ({ input: { listingId } }) => {
      const [listing] = await db
        .select({
          id: listingsTable.id,
          timezone: locationsTable.timezone,
        })
        .from(listingsTable)
        .innerJoin(
          locationsTable,
          eq(locationsTable.id, listingsTable.locationId)
        )
        .where(eq(listingsTable.id, listingId))
      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found!",
        })
      }

      const [check] = await db
        .select()
        .from(availabilityChecksTable)
        .where(eq(availabilityChecksTable.listingId, listing.id))
        .orderBy(desc(availabilityChecksTable.checkedAt))
        .limit(1)

      if (!check) {
        return {
          isAvailable: null,
          expectedOpen: null,
          checkedAt: null,
          stale: true,
          reason: "No checks recorded yet",
          verdict: "unknown",
        }
      }

      const stale = Date.now() - check.checkedAt.getTime() > STALE_AFTER_MS

      const hours = check.openingHours
      const expectedOpen = expectedOpenNow(
        hours,
        localMinutes(listing.timezone)
      )

      if (check.status !== "ok" || check.isAvailable === null) {
        return {
          isAvailable: null,
          expectedOpen,
          checkedAt: check.checkedAt,
          stale,
          reason: check.errorMessage || `Last check status ${check.status}`,
          verdict: "unknown",
        }
      }

      const isAvailable = check.isAvailable
      const verdict: Verdict =
        expectedOpen === null
          ? "unknown"
          : isAvailable && expectedOpen
            ? "available"
            : !isAvailable && expectedOpen
              ? "unavailable_expected_open"
              : isAvailable && !expectedOpen
                ? "available_expected_closed"
                : "closed"

      return {
        isAvailable,
        verdict,
        expectedOpen,
        checkedAt: check.checkedAt,
        stale,
        openHoursToday: hours,
      }
    }),
})
