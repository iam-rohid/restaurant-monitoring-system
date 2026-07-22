import { db } from "@/lib/db"
import {
  chainsTable,
  DeliveryPlatform,
  listingsTable,
  locationsTable,
} from "@/lib/db/schema"
import { NextResponse } from "next/server"

type RestaurantListing = {
  url: string
  slug: string
}

type Location = {
  name: string
  address: string
  timezone: string
  lat: number
  lng: number
  listings: Record<DeliveryPlatform, RestaurantListing>
}

type RestaurantChain = {
  slug: string
  name: string
  image: string
  locations: Location[]
}

export const RESTAURANT_CHAINS: RestaurantChain[] = [
  {
    slug: "mcdonalds",
    name: "McDonald's",
    image: "/restaurants/mcdonalds.avif",
    locations: [
      {
        name: "McDonald's Am Ostbahnhof",
        address: "Am Ostbahnhof 9 10243 Berlin",
        lat: 52.509456,
        lng: 13.435118,
        timezone: "Europe/Berlin",
        listings: {
          wolt: {
            slug: "mcdonalds-am-ostbahnhof",
            url: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-am-ostbahnhof",
          },
        },
      },
      {
        name: "McDonald's Prenzlauer Promenade",
        address: "Prenzlauer Promenade 45-46 13089 Berlin",
        lat: 52.561078,
        lng: 13.428849,
        timezone: "Europe/Berlin",
        listings: {
          wolt: {
            slug: "mcdonalds-prenzlauer-promenade",
            url: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-prenzlauer-promenade",
          },
        },
      },
      {
        name: "McDonald's - Gesundbrunnen",
        address: "Hanne-Sobek-Platz 1 13357 Berlin",
        lat: 52.54891047,
        lng: 13.38894917,
        timezone: "Europe/Berlin",
        listings: {
          wolt: {
            slug: "mcdonalds-gesundbrunnen",
            url: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-gesundbrunnen",
          },
        },
      },
      {
        name: "McDonald's Hansastrasse",
        address: "Hansastraße 1 13053 Berlin",
        lat: 52.5470614,
        lng: 13.468399,
        timezone: "Europe/Berlin",
        listings: {
          wolt: {
            slug: "mcdonalds-hansastrasse",
            url: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-hansastrasse",
          },
        },
      },
      {
        name: "McDonald's Checkpoint Charlie",
        address: "Friedrichstraße 207 10969 Berlin",
        lat: 52.5071701,
        lng: 13.3901817,
        timezone: "Europe/Berlin",
        listings: {
          wolt: {
            slug: "mcdonalds-checkpoint-charlie",
            url: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-checkpoint-charlie",
          },
        },
      },
    ],
  },
]

export const GET = async () => {
  // let newChainCount = 0;
  // let newLocationCount = 0
  // let newListingCount = 0;

  for (const chain of RESTAURANT_CHAINS) {
    const [chainRow] = await db
      .insert(chainsTable)
      .values({
        name: chain.name,
        slug: chain.slug,
        image: chain.image,
      })
      .onConflictDoUpdate({
        target: chainsTable.slug,
        set: { name: chain.name, image: chain.image },
      })
      .returning({ id: chainsTable.id })

    for (const location of chain.locations) {
      const [locationRow] = await db
        .insert(locationsTable)
        .values({
          name: location.name,
          address: location.address,
          chainId: chainRow.id,
          lat: location.lat,
          lng: location.lng,
          timezone: location.timezone,
        })
        .onConflictDoUpdate({
          target: [
            locationsTable.chainId,
            locationsTable.lat,
            locationsTable.lng,
          ],
          set: {
            name: location.name,
            address: location.address,
            timezone: location.timezone,
          },
        })
        .returning()

      if (!locationRow) continue

      const listings = Object.entries(location.listings).map(
        (entry) =>
          ({
            platform: entry[0] as DeliveryPlatform,
            locationId: locationRow.id,
            slug: entry[1].slug,
            url: entry[1].url,
          }) satisfies typeof listingsTable.$inferInsert
      )

      if (listings.length > 0) {
        await db.insert(listingsTable).values(listings).onConflictDoNothing()
      }
    }
  }

  return NextResponse.json({ success: true })
}
