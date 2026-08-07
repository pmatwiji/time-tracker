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
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  className,
  fill = false,
}: StatCardProps) {
  return (
    <Card className={cn(fill && "flex h-full min-h-0 flex-col", className)}>
      <CardContent
        className={cn(
          "flex gap-4 p-5",
          fill
            ? "h-full flex-1 items-center justify-between"
            : "items-start justify-between",
        )}
      >
        <div className={cn("min-w-0", fill ? "space-y-3" : "space-y-1")}>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              fill ? "text-4xl" : "text-2xl",
            )}
          >
            {value}
          </p>
          {sublabel ? (
            <div className="text-xs text-muted-foreground">{sublabel}</div>
          ) : null}
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
            fill ? "size-14" : "size-10",
          )}
        >
          <Icon className={fill ? "size-7" : "size-5"} />
        </div>
      </CardContent>
    </Card>
  )
}
