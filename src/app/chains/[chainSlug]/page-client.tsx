"use client"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { formatInterval, localMinutes } from "@/helpers"
import { Listing, Location } from "@/lib/db/schema"
import { DELIVERY_PLATFORMS } from "@/lib/delivery-platforms"
import { cn } from "@/lib/utils"
import { RouterOutput, useTRPC } from "@/trpc/client"
import { Verdict } from "@/trpc/routers/listings"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LucideIcon,
  MapPinIcon,
  MapPinnedIcon,
  UtensilsIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import pluralize from "pluralize"
import { useMemo } from "react"

export default function PageClient() {
  const { chainSlug } = useParams<{ chainSlug: string }>()
  const trpc = useTRPC()
  const chainQuery = useQuery(
    trpc.chains.getBySlug.queryOptions({ slug: chainSlug })
  )

  const totalListings =
    chainQuery.data?.locations.reduce(
      (sum, item) => sum + item.listings.length,
      0
    ) ?? 0

  return (
    <div className="mx-auto my-4 max-w-6xl space-y-6 px-4 md:my-6 md:px-6">
      <Button asChild variant="ghost">
        <Link href="/">
          <ArrowLeftIcon />
          Back
        </Link>
      </Button>

      {chainQuery.isPending ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : chainQuery.isError ? (
        <Alert variant="destructive" className="max-w-md">
          <AlertCircleIcon />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{chainQuery.error.message}</AlertDescription>
          <AlertAction>
            <Button
              onClick={() => chainQuery.refetch()}
              disabled={chainQuery.isRefetching}
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <>
          <div className="flex items-center gap-4 md:gap-6">
            <Avatar className="size-16">
              <AvatarFallback>
                <UtensilsIcon />
              </AvatarFallback>
              {chainQuery.data.image && (
                <AvatarImage
                  src={chainQuery.data.image}
                  alt={`${chainQuery.data.name} logo`}
                  width={64}
                  height={64}
                />
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">
                {chainQuery.data.name}
              </p>
              <p className="text-muted-foreground">
                {totalListings} {pluralize("listing", totalListings)} monitored
                across {chainQuery.data.locations.length}{" "}
                {pluralize("location", chainQuery.data.locations.length)}
              </p>
            </div>
          </div>

          <Listings chain={chainQuery.data} />
        </>
      )}
    </div>
  )
}

function Listings({ chain }: { chain: RouterOutput["chains"]["getBySlug"] }) {
  return (
    <div className="grid gap-4">
      {chain.locations.map((location) => (
        <LocationRow key={String(location.id)} location={location} />
      ))}
    </div>
  )
}

function LocationRow({
  location,
}: {
  location: Location & { listings: Listing[] }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{location.name}</CardTitle>
        <CardDescription className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3.5" /> {location.address}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link
              href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPinnedIcon />
              See map
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid gap-2">
          {location.listings.map((listing) => (
            <ListingRow
              key={String(listing.id)}
              listing={listing}
              timezone={location.timezone}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const VERDICT_DISPLAY: Record<
  Verdict,
  {
    label: string
    icon: LucideIcon
    tone: "success" | "error" | "warning" | "muted"
  }
> = {
  available_expected_closed: {
    label: "Open off-hours",
    icon: AlertCircleIcon,
    tone: "warning",
  },
  unknown: {
    label: "Can't verify",
    icon: HelpCircleIcon,
    tone: "muted",
  },
  unavailable_expected_open: {
    label: "Unavailable",
    icon: AlertCircleIcon,
    tone: "error",
  },
  available: {
    label: "Available",
    icon: CheckCircleIcon,
    tone: "success",
  },
  closed: {
    label: "Closed",
    icon: HelpCircleIcon,
    tone: "muted",
  },
}

function ListingRow({
  listing,
  timezone,
}: {
  listing: Listing
  timezone: string
}) {
  const trpc = useTRPC()
  const availabilityStatusQuery = useQuery(
    trpc.listings.getAvailabilityStatus.queryOptions(
      { listingId: listing.id },
      {
        refetchInterval: 60 * 1000, // refetch status every minute
      }
    )
  )

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const subtitle = useMemo(() => {
    if (!availabilityStatusQuery.isSuccess) {
      return ""
    }

    const nowMin = localMinutes(timezone)

    const currInterval = availabilityStatusQuery.data.openHoursToday?.find(
      (interval) =>
        interval.opensAtMin <= nowMin && interval.closesAtMin > nowMin
    )

    switch (availabilityStatusQuery.data.verdict) {
      case "available":
        return (
          `Open` + (currInterval ? ` ${formatInterval(currInterval!)}` : ``)
        )
      case "available_expected_closed":
        return `Accepting  orders`
      case "unavailable_expected_open":
        return `Not accepting orders`
      case "unknown":
        return availabilityStatusQuery.data.reason ?? "Unknown"
      case "closed":
        return (
          `Closed` + (currInterval ? ` ${formatInterval(currInterval!)}` : ``)
        )

      default:
        return ``
    }
  }, [
    availabilityStatusQuery.data?.openHoursToday,
    availabilityStatusQuery.data?.verdict,
    availabilityStatusQuery.data?.reason,
    availabilityStatusQuery.isSuccess,
    timezone,
  ])

  const display =
    VERDICT_DISPLAY[availabilityStatusQuery.data?.verdict ?? "unknown"]

  return (
    <div key={String(listing.id)} className="flex items-center gap-4">
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
          <p>Checking availability...</p>
        ) : availabilityStatusQuery.isError ? (
          <p>Error: {availabilityStatusQuery.error.message}</p>
        ) : (
          <div>
            <p className="text-muted-foreground">{subtitle}</p>
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

      {availabilityStatusQuery.isPending ? (
        <Skeleton className="h-5 w-20 rounded-full" />
      ) : availabilityStatusQuery.isError ? (
        <Badge variant="destructive">Error</Badge>
      ) : (
        <Badge
          className={cn(
            display.tone === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-500"
              : display.tone === "warning"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                : display.tone === "error"
                  ? "bg-red-500/10 text-red-600 dark:text-red-500"
                  : "bg-muted text-muted-foreground",
            availabilityStatusQuery.isRefetching && "opacity-50"
          )}
        >
          {availabilityStatusQuery.isRefetching ? (
            <Spinner />
          ) : (
            <display.icon />
          )}
          {display.label}
        </Badge>
      )}

      <Button asChild variant="outline">
        <Link href={listing.url} target="_blank" rel="noopener noreferrer">
          View listing <ExternalLinkIcon />
        </Link>
      </Button>
    </div>
  )
}
