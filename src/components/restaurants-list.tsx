"use client"

import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"

export default function RestaurantsList() {
  const trpc = useTRPC()
  const chains = useQuery(trpc.chains.listAll.queryOptions())

  return <div>{JSON.stringify(chains, null, 2)}</div>
}
