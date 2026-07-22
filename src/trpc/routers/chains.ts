import { db } from "@/lib/db"
import { baseProcedure, createTRPCRouter } from "../init"
import {
  Chain,
  chainsTable,
  listingsTable,
  locationsTable,
} from "@/lib/db/schema"
import z from "zod"
import { count, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"

async function getLocationsForChain(chain: Chain) {
  const locationRows = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.chainId, chain.id))

  return await Promise.all(
    locationRows.map(async (location) => {
      const listings = await db
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.locationId, location.id))

      return {
        ...location,
        listings,
      }
    })
  )
}

export const chainsRouter = createTRPCRouter({
  listAll: baseProcedure.query(async () => {
    const chains = await db.select().from(chainsTable)
    return Promise.all(
      chains.map(async (chain) => {
        const [locationCountRow] = await db
          .select({ count: count() })
          .from(locationsTable)
          .where(eq(locationsTable.chainId, chain.id))
        return { ...chain, locationCount: locationCountRow.count ?? 0 }
      })
    )
  }),
  getById: baseProcedure
    .input(z.object({ chainId: z.number() }))
    .query(async ({ input: { chainId } }) => {
      const [chainRow] = await db
        .select()
        .from(chainsTable)
        .where(eq(chainsTable.id, chainId))
      if (!chainRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurant Chain not found!",
        })
      }

      const locations = await getLocationsForChain(chainRow)

      return { ...chainRow, locations }
    }),
  getBySlug: baseProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input: { slug } }) => {
      const [chainRow] = await db
        .select()
        .from(chainsTable)
        .where(eq(chainsTable.slug, slug))
      if (!chainRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurant Chain not found!",
        })
      }

      const locations = await getLocationsForChain(chainRow)

      return { ...chainRow, locations }
    }),
})
