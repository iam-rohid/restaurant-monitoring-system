import { createTRPCRouter } from "./init"
import { chainsRouter } from "./routers/chains"
import { listingsRouter } from "./routers/listings"

export const appRouter = createTRPCRouter({
  chains: chainsRouter,
  listings: listingsRouter,
})

export type AppRouter = typeof appRouter
