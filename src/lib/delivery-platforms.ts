import { DeliveryPlatform } from "./db/schema"

export const DELIVERY_PLATFORMS: Record<
  DeliveryPlatform,
  {
    name: string
    url: string
    imageUrl: string
  }
> = {
  wolt: {
    name: "Wolt",
    url: "https://wolt.com",
    imageUrl: "/delivery_platforms/wolt.png",
  },
}
