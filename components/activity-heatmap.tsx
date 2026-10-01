"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayTotal } from "@/lib/stats"
import {
  addDaysToKey,
  formatDateDisplay,
  formatDuration,
  fullDateLabel,
  isWeekendKey,
  REGULATORY_DAILY_HOURS,
  startOfWeekKey,
  toHours,
} from "@/lib/format"

type ActivityHeatmapProps = {
  data: DayTotal[]
}

type Cell = DayTotal | null

const DAY_ROWS = ["L", "M", "X", "J", "V", "S", "D"] // Lun → Dom

function cellClass(day: DayTotal | null): string {
  if (!day) return "bg-transparent"
  if (day.seconds <= 0) {
    if (day.timeOffLabel) return "bg-neutral-500/45"
    return day.isWeekend || day.isHoliday
      ? "bg-muted/50"
      : "bg-neutral-500/45"
  }

  const hours = toHours(day.seconds)
  const nonWorking = day.isWeekend || day.isHoliday
  const goal = day.goalHours || REGULATORY_DAILY_HOURS

  if (nonWorking) {
    if (hours < 2) return "bg-destructive/40"
    if (hours < 4) return "bg-destructive/70"
    return "bg-destructive"
  }

  if (hours < 1) return "bg-neutral-600"
  if (hours < 2) return "bg-neutral-400"
  if (hours + 0.05 < goal) return "bg-neutral-200"
  if (hours > goal) return "bg-destructive"
  return "bg-white"
}

function tooltipText(day: DayTotal): string {
  if (day.seconds <= 0) {
    if (day.timeOffLabel) return day.timeOffLabel
    return day.isWeekend || day.isHoliday
      ? "Sin registro · no laborable"
      : "Sin registro"
  }
  if (day.isWeekend || day.isHoliday) {
    return `${formatDuration(day.seconds)} · no laborable`
  }
  const hours = toHours(day.seconds)
  const goal = day.goalHours || REGULATORY_DAILY_HOURS
  if (hours > goal) {
    const extra = Math.round((hours - goal) * 3600)
    return `${goal}h regulares + ${formatDuration(extra)} extra`
  }
  return `${formatDuration(day.seconds)} reglamentarias`
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<DayTotal | null>(null)

  const { weeks, monthLabels } = useMemo(() => {
    const byDate = new Map(data.map((d) => [d.date, d]))
    const first = data[0]?.date
    const last = data[data.length - 1]?.date
    if (!first || !last) {
      return {
        weeks: [] as Cell[][],
        monthLabels: [] as { label: string; col: number }[],
      }
    }

    const gridStart = startOfWeekKey(first)
    const weeks: Cell[][] = []
    let cursor = gridStart

    while (cursor <= last) {
      const week: Cell[] = []
      for (let i = 0; i < 7; i++) {
        const key = addDaysToKey(cursor, i)
        if (key < first || key > last) {
          week.push(null)
        } else {
          week.push(
            byDate.get(key) ?? {
              date: key,
              seconds: 0,
              isWeekend: isWeekendKey(key),
              isHoliday: false,
              timeOffLabel: null,
              goalHours: REGULATORY_DAILY_HOURS,
            },
          )
        }
      }
      weeks.push(week)
      cursor = addDaysToKey(cursor, 7)
    }

    const monthLabels: { label: string; col: number }[] = []
    let prevMonth = ""
    weeks.forEach((week, col) => {
      const firstReal = week.find((d) => d != null)
      if (!firstReal) return
      const month = firstReal.date.slice(5, 7)
      if (month !== prevMonth) {
        const labels = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ]
        monthLabels.push({
          label: labels[Number(month) - 1] ?? month,
          col,
        })
        prevMonth = month
      }
    })

    return { weeks, monthLabels }
  }, [data])

  const daysActive = data.filter((d) => d.seconds > 0).length
  const gridCols = `1.5rem repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))`

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>Últimos 30 días</CardTitle>
        <p className="text-xs text-muted-foreground">
          {daysActive} día{daysActive === 1 ? "" : "s"} con registro
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div
            className="grid shrink-0 gap-1.5"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div />
            {weeks.map((_, col) => {
              const label = monthLabels.find((m) => m.col === col)
              return (
                <div
                  key={`m-${col}`}
                  className="text-[10px] leading-none text-muted-foreground"
                >
                  {label?.label ?? ""}
                </div>
              )
            })}
          </div>

          <div
            className="grid min-h-0 flex-1 gap-1.5"
            style={{
              gridTemplateColumns: gridCols,
              gridTemplateRows: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {DAY_ROWS.map((label, row) => (
              <div key={`label-${label}`} className="contents">
                <span className="flex items-center text-[10px] leading-none text-muted-foreground">
                  {row % 2 === 0 ? label : ""}
                </span>
                {weeks.map((week, col) => {
                  const day = week[row] ?? null
                  return (
                    <button
                      key={`${col}-${row}`}
                      type="button"
                      disabled={!day}
                      aria-label={
                        day
                          ? `${fullDateLabel(day.date)}: ${tooltipText(day)}`
                          : undefined
                      }
                      className={`h-full min-h-0 w-full rounded-sm transition-transform ${cellClass(day)} ${
                        day ? "hover:scale-105 focus-visible:scale-105" : ""
                      }`}
                      onMouseEnter={() => day && setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => day && setHovered(day)}
                      onBlur={() => setHovered(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate">
            {hovered
              ? `${formatDateDisplay(hovered.date)} · ${tooltipText(hovered)}`
              : "Pasá el mouse sobre un día"}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <span>Menos</span>
            <span className="size-2.5 rounded-[2px] bg-neutral-500/45" title="Sin registro" />
            <span className="size-2.5 rounded-[2px] bg-muted/50" title="No laborable sin registro" />
            <span className="size-2.5 rounded-[2px] bg-neutral-600" />
            <span className="size-2.5 rounded-[2px] bg-neutral-300" />
            <span className="size-2.5 rounded-[2px] bg-white" />
            <span className="size-2.5 rounded-[2px] bg-destructive" />
            <span>Más</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
