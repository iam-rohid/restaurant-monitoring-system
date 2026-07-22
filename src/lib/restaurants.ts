import { DeliveryPlatform } from "./delivery-platforms"

export type RestaurantListing = {
  slug: string
  name: string
  deliveryPlatforms: Record<DeliveryPlatform, string | null>
}

export type RestaurantChain = {
  slug: string
  name: string
  image: string
  listings: RestaurantListing[]
}

export const RESTAURANT_CHAINS: RestaurantChain[] = [
  {
    slug: "mcdonalds",
    name: "McDonald's",
    image: "/restaurants/mcdonalds.avif",
    listings: [
      {
        slug: "mcdonalds-am-ostbahnhof",
        name: "McDonald's Am Ostbahnhof",
        deliveryPlatforms: {
          wolt: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-am-ostbahnhof",
        },
      },
      {
        slug: "mcdonalds-prenzlauer-promenade",
        name: "McDonald's Prenzlauer Promenade",
        deliveryPlatforms: {
          wolt: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-prenzlauer-promenade",
        },
      },
      {
        slug: "mcdonalds-gesundbrunnen",
        name: "McDonald's - Gesundbrunnen",
        deliveryPlatforms: {
          wolt: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-gesundbrunnen",
        },
      },
      {
        slug: "mcdonalds-hansastrasse",
        name: "McDonald's Hansastrasse",
        deliveryPlatforms: {
          wolt: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-hansastrasse",
        },
      },
      {
        slug: "mcdonalds-checkpoint-charlie",
        name: "McDonald's Checkpoint Charlie",
        deliveryPlatforms: {
          wolt: "https://wolt.com/en/deu/berlin/restaurant/mcdonalds-checkpoint-charlie",
        },
      },
    ],
  },
]
