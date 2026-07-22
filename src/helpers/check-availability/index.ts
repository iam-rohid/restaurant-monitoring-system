import { DeliveryPlatform } from "@/lib/db/schema"
import { AvailabilityCheckResult } from "./types"
import { checkAvailabilityOnWolt } from "./wolt"

export async function checkAvailabilityForListing(opts: {
  platform: DeliveryPlatform
  url: string
  lat: number
  lng: number
  timezone: string
}): Promise<AvailabilityCheckResult> {
  switch (opts.platform) {
    case "wolt":
      return await checkAvailabilityOnWolt(opts)
  }
}
