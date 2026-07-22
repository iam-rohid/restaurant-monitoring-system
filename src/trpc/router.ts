import { createTRPCRouter } from "./init"
import { chainsRouter } from "./routers/chains"

export const appRouter = createTRPCRouter({
  chains: chainsRouter,
})

export type AppRouter = typeof appRouter
