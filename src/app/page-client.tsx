"use client"

import { RestaurantLocationCard } from "@/components/restaurant-location-card"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { RouterOutput, useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, UtensilsIcon } from "lucide-react"
import pluralize from "pluralize"

export default function PageClient() {
  const trpc = useTRPC()
  const chainQuery = useQuery(
    trpc.chains.getBySlug.queryOptions({ slug: "mcdonalds" })
  )

  const totalListings =
    chainQuery.data?.locations.reduce(
      (sum, item) => sum + item.listings.length,
      0
    ) ?? 0

  return (
    <div className="mx-auto my-4 max-w-6xl space-y-6 px-4 md:my-6 md:px-6">
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
        <RestaurantLocationCard key={String(location.id)} location={location} />
      ))}
    </div>
  )
}
