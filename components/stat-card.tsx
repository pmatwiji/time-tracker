import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  sublabel?: ReactNode
  icon: LucideIcon
  className?: string
  /** Expande el contenido para llenar la altura de la card. */
  fill?: boolean
  /** Evita que el sublabel haga salto de línea (con truncate si no entra). */
  sublabelSingleLine?: boolean
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  className,
  fill = false,
  sublabelSingleLine = false,
}: StatCardProps) {
  const iconBox = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
        fill ? "size-14" : "size-10",
      )}
    >
      <Icon className={fill ? "size-7" : "size-5"} />
    </div>
  )

  if (fill) {
    return (
      <Card className={cn("flex h-full min-h-0 flex-col", className)}>
        <CardContent className="flex h-full flex-1 items-center justify-between gap-4 p-5">
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
            {sublabel ? (
              <div
                className={cn(
                  "text-xs text-muted-foreground",
                  sublabelSingleLine &&
                    "[&_p]:truncate [&_p]:whitespace-nowrap",
                )}
              >
                {sublabel}
              </div>
            ) : null}
          </div>
          {iconBox}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium leading-none text-muted-foreground">
            {label}
          </p>
          {iconBox}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {sublabel ? (
            <div
              className={cn(
                "mt-1 text-xs text-muted-foreground",
                sublabelSingleLine && "[&_p]:truncate [&_p]:whitespace-nowrap",
              )}
            >
              {sublabel}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
