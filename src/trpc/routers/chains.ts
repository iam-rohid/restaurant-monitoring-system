import { db } from "@/lib/db"
import { baseProcedure, createTRPCRouter } from "../init"
import { chainsTable } from "@/lib/db/schema"

export const chainsRouter = createTRPCRouter({
  listAll: baseProcedure.query(async () => {
    const chains = await db.select().from(chainsTable)
    return chains
  }),
})
