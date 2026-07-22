export const DELIVERY_PLATFORMS = ["wolt"] as const

export type DeliveryPlatform = (typeof DELIVERY_PLATFORMS)[number]
