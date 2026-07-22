"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Listing, Location } from "@/lib/db/schema"
import { MapPinIcon, MapPinnedIcon } from "lucide-react"
import Link from "next/link"
import { PlatformListingRow } from "./platform-listing-row"

export function RestaurantLocationCard({
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
            <PlatformListingRow key={String(listing.id)} listing={listing} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
