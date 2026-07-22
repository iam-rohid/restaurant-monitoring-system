import { relations } from "drizzle-orm/_relations"
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  serial,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const deliveryPlatformEnum = pgEnum("delivery_platform", ["wolt"])

export type DeliveryPlatform = (typeof deliveryPlatformEnum.enumValues)[number]

export const availabilityCheckStatusEnum = pgEnum("availability_check_status", [
  "ok",
  "fetch_error",
  "parse_error",
])

export type AvailabilityCheckStatus =
  (typeof availabilityCheckStatusEnum.enumValues)[number]

export const chainsTable = snakeCase.table("chains", {
  id: serial().primaryKey(),
  name: text().notNull(),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type Chain = typeof chainsTable.$inferSelect

export const locationsTable = snakeCase.table(
  "locations",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    address: text().notNull(),
    timezone: text().notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    chainId: integer()
      .notNull()
      .references(() => chainsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.chainId)]
)

export type Location = typeof locationsTable.$inferSelect

export const listingsTable = snakeCase.table(
  "listings",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    platform: deliveryPlatformEnum().notNull(),
    url: text().notNull(),
    isActive: boolean().notNull().default(true),
    locationId: integer()
      .notNull()
      .references(() => locationsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex().on(table.locationId, table.platform)]
)

export type Listing = typeof listingsTable.$inferSelect

export type OpeningInterval = {
  opensAtMin: number
  closesAtMin: number
}

export const availabilityChecksTable = snakeCase.table(
  "availability_checks",
  {
    id: serial().primaryKey(),
    listingId: integer()
      .notNull()
      .references(() => listingsTable.id, { onDelete: "cascade" }),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: availabilityCheckStatusEnum().notNull(),
    isAvailable: boolean(),
    openingHours: jsonb().notNull().$type<OpeningInterval[]>().default([]),
    errorMessage: text(),
    rawPayload: jsonb(),
  },
  (table) => [index().on(table.listingId, table.checkedAt.desc())]
)

export const chainsRelation = relations(chainsTable, ({ many }) => ({
  locations: many(locationsTable),
}))

export const locationsRelation = relations(locationsTable, ({ one, many }) => ({
  listings: many(listingsTable),
  chain: one(chainsTable, {
    fields: [locationsTable.chainId],
    references: [chainsTable.id],
  }),
}))

export const listingsRelation = relations(listingsTable, ({ one, many }) => ({
  checks: many(availabilityChecksTable),
  location: one(locationsTable, {
    fields: [listingsTable.locationId],
    references: [locationsTable.id],
  }),
}))

export const availabilityChecksRelation = relations(
  availabilityChecksTable,
  ({ one }) => ({
    listing: one(listingsTable, {
      fields: [availabilityChecksTable.listingId],
      references: [listingsTable.id],
    }),
  })
)
