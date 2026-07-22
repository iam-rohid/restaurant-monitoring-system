import { sleep } from "@/helpers"
import { checkAvailabilityForListing } from "@/helpers/check-availability"
import { db } from "@/lib/db"
import {
  availabilityChecksTable,
  listingsTable,
  locationsTable,
} from "@/lib/db/schema"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  const activeListings = await db
    .select({
      id: listingsTable.id,
      platform: listingsTable.platform,
      url: listingsTable.url,
      lat: locationsTable.lat,
      lng: locationsTable.lng,
      timezone: locationsTable.timezone,
    })
    .from(listingsTable)
    .innerJoin(locationsTable, eq(locationsTable.id, listingsTable.locationId))
    .where(eq(listingsTable.isActive, true))

  if (activeListings.length === 0) {
    return new NextResponse("No active listing!", { status: 400 })
  }

  let successCount = 0
  let errorCount = 0

  for (const listing of activeListings) {
    try {
      const result = await checkAvailabilityForListing(listing)

      await db.insert(availabilityChecksTable).values(
        result.status === "ok"
          ? {
              listingId: listing.id,
              status: result.status,
              isAvailable: result.isAvailable,
              openingHours: result.openingHours,
              rawPayload: result.rawPayload,
            }
          : {
              listingId: listing.id,
              status: result.status,
              errorMessage: result.errorMessage,
              rawPayload: result.rawPayload,
            }
      )

      successCount++
    } catch (error) {
      console.error(error)
      errorCount++
    }

    await sleep(500) // politeness gap between requests
  }

  return NextResponse.json({ success: true, successCount, errorCount })
})
