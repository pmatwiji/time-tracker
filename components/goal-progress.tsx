import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type GoalBarProps = {
  label: string
  detail: string
  progress: number // 0..1
}

function GoalBar({ label, detail, progress }: GoalBarProps) {
  const pct = Math.round(progress * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {detail}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type GoalProgressProps = {
  goals: GoalBarProps[]
}

export function GoalProgress({ goals }: GoalProgressProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Objetivos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {goals.map((g) => (
          <GoalBar key={g.label} {...g} />
        ))}
      </CardContent>
    </Card>
  )
}
