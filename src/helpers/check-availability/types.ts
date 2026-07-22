import { OpeningInterval } from "@/lib/db/schema"

export type AvailabilityCheckResult =
  | {
      status: "fetch_error" | "parse_error"
      errorMessage: string
      rawPayload?: unknown
    }
  | {
      status: "ok"
      isAvailable: boolean
      expectedOpen: boolean
      openingHours: OpeningInterval[]
      rawPayload: unknown
    }
