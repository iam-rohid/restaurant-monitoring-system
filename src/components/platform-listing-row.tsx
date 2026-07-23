"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Listing } from "@/lib/db/schema"
import { DELIVERY_PLATFORMS } from "@/lib/delivery-platforms"
import { cn } from "@/lib/utils"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangleIcon,
  CheckIcon,
  ExternalLinkIcon,
  UtensilsIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"

export function PlatformListingRow({ listing }: { listing: Listing }) {
  const trpc = useTRPC()
  const availabilityStatusQuery = useQuery(
    trpc.listings.getAvailabilityStatus.queryOptions(
      { listingId: listing.id },
      {
        refetchInterval: 60 * 1000, // refetch status every minute
      }
    )
  )

  const unmatchedAvailability =
    availabilityStatusQuery.data?.expectedOpen !== null &&
    availabilityStatusQuery.data?.expectedOpen !==
      availabilityStatusQuery.data?.isAvailable

  return (
    <div
      key={String(listing.id)}
      className={cn(
        "-mx-5 flex items-center gap-4 px-4 py-2 md:px-5",
        unmatchedAvailability && "bg-amber-500/10"
      )}
    >
      <Avatar size="lg">
        <AvatarFallback>
          <UtensilsIcon />
        </AvatarFallback>
        <AvatarImage
          src={DELIVERY_PLATFORMS[listing.platform].imageUrl}
          alt={`${DELIVERY_PLATFORMS[listing.platform].name} logo`}
          width={64}
          height={64}
        />
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={DELIVERY_PLATFORMS[listing.platform].url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {DELIVERY_PLATFORMS[listing.platform].name}
          </Link>
        </div>

        {availabilityStatusQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            Loading availability...
          </p>
        ) : availabilityStatusQuery.isError ? (
          <p className="text-sm text-muted-foreground">
            Error: {availabilityStatusQuery.error.message}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {availabilityStatusQuery.data.isAvailable === null ? (
              <Badge variant="destructive">Can&apos;t Verify</Badge>
            ) : availabilityStatusQuery.data.isAvailable ? (
              <Badge className="bg-green-700 text-white dark:bg-green-500 dark:text-black">
                <CheckIcon />
                Available
              </Badge>
            ) : (
              <Badge className="bg-destructive text-white dark:text-black">
                <XIcon />
                Unavailable
              </Badge>
            )}

            {availabilityStatusQuery.data.isAvailable === null &&
              availabilityStatusQuery.data.reason && (
                <p className="inline-flex items-center gap-1 text-sm text-destructive">
                  <AlertTriangleIcon className="size-3.5" />
                  {availabilityStatusQuery.data.reason}
                </p>
              )}

            {unmatchedAvailability && (
              <p className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-500">
                <AlertTriangleIcon className="size-3.5" />
                {availabilityStatusQuery.data.expectedOpen
                  ? "Expected available!"
                  : "Expected unavailable!"}
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Last checked{" "}
              {availabilityStatusQuery.data.checkedAt
                ? formatDistanceToNow(availabilityStatusQuery.data.checkedAt, {
                    addSuffix: true,
                  })
                : "never"}
            </p>
          </div>
        )}
      </div>

      <Button asChild variant="outline">
        <Link href={listing.url} target="_blank" rel="noopener noreferrer">
          View listing <ExternalLinkIcon />
        </Link>
      </Button>
    </div>
  )
}
