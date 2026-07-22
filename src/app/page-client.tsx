"use client"

import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, ChevronRightIcon, UtensilsIcon } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import pluralize from "pluralize"
import { Skeleton } from "@/components/ui/skeleton"
import { Fragment } from "react/jsx-runtime"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function PageClient() {
  const trpc = useTRPC()
  const chainsQuery = useQuery(trpc.chains.listAll.queryOptions())

  return (
    <div className="mx-auto my-4 max-w-6xl gap-6 px-4 md:my-6 md:px-6">
      <div className="gap-4">
        <p className="mb-4 font-semibold text-foreground">Restaurant Chains</p>
        {chainsQuery.isPending ? (
          <div className="grid overflow-hidden rounded-xl border">
            {Array.from({ length: 5 }).map((_, i) => (
              <Fragment key={String(i)}>
                <div className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="size-10" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-[30%]" />
                    <Skeleton className="mt-1 h-4 w-[50%]" />
                  </div>
                </div>

                {i < 5 - 1 && <div className="h-px bg-border" />}
              </Fragment>
            ))}
          </div>
        ) : chainsQuery.isError ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertCircleIcon />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{chainsQuery.error.message}</AlertDescription>
            <AlertAction>
              <Button
                onClick={() => chainsQuery.refetch()}
                disabled={chainsQuery.isRefetching}
              >
                Retry
              </Button>
            </AlertAction>
          </Alert>
        ) : chainsQuery.data.length === 0 ? (
          <p>No restaurant chain found.</p>
        ) : (
          <div className="grid overflow-hidden rounded-xl border">
            {chainsQuery.data.map((chain, i) => (
              <Fragment key={String(chain.id)}>
                <div className="relative flex items-center gap-4 px-4 py-3 hover:bg-secondary/50">
                  <Link
                    href={`/chains/${chain.slug}`}
                    className="absolute inset-0"
                  />
                  <Avatar size="lg">
                    <AvatarFallback>
                      <UtensilsIcon />
                    </AvatarFallback>
                    {chain.image && (
                      <AvatarImage
                        src={chain.image}
                        alt={`${chain.name} logo`}
                        width={64}
                        height={64}
                      />
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{chain.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {chain.locationCount}{" "}
                      {pluralize("location", chain.locationCount)}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-5 text-muted-foreground" />
                </div>
                {i < chainsQuery.data.length - 1 && (
                  <div className="h-px bg-border" />
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
