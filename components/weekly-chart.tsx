"use client"

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayTotal } from "@/lib/stats"
import {
  dayLabel,
  formatDateDisplay,
  formatDuration,
  toHours,
} from "@/lib/format"

type WeeklyChartProps = {
  data: DayTotal[]
}

type ChartDatum = {
  key: string
  label: string
  seconds: number
  emptyHours: number
  regularHours: number
  extraHours: number
  isNonWorking: boolean
  isEmpty: boolean
  timeOffLabel: string | null
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const chartData: ChartDatum[] = data.map((d) => {
    const hours = toHours(d.seconds)
    const isNonWorking = d.isWeekend || d.isHoliday
    const timeOffLabel = d.timeOffLabel ?? null

    if (d.seconds <= 0) {
      const showEmptyBar = !isNonWorking
      return {
        key: d.date,
        label: dayLabel(d.date),
        seconds: 0,
        emptyHours: showEmptyBar ? d.goalHours : 0,
        regularHours: 0,
        extraHours: 0,
        isNonWorking,
        isEmpty: showEmptyBar,
        timeOffLabel,
      }
    }

    if (isNonWorking) {
      return {
        key: d.date,
        label: dayLabel(d.date),
        seconds: d.seconds,
        emptyHours: 0,
        regularHours: 0,
        extraHours: hours,
        isNonWorking: true,
        isEmpty: false,
        timeOffLabel,
      }
    }

    return {
      key: d.date,
      label: dayLabel(d.date),
      seconds: d.seconds,
      emptyHours: 0,
      regularHours: Math.min(hours, d.goalHours),
      extraHours: Math.max(0, hours - d.goalHours),
      isNonWorking: false,
      isEmpty: false,
      timeOffLabel,
    }
  })

  const maxHours = Math.max(
    ...chartData.map((d) => d.emptyHours + d.regularHours + d.extraHours),
    1,
  )

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Últimos 7 días</CardTitle>
        <p className="text-xs text-muted-foreground">
          Gris: sin registro o día libre. Blanco: hasta el objetivo de ese día.
          Rojo: exceso, feriado o fin de semana.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                domain={[0, Math.ceil(maxHours)]}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as ChartDatum
                  let breakdown: string
                  if (!d.isEmpty && d.seconds <= 0 && d.isNonWorking) {
                    breakdown = "No laborable"
                  } else if (d.isEmpty) {
                    if (d.timeOffLabel) {
                      breakdown = d.timeOffLabel
                    } else {
                      breakdown = d.isNonWorking
                        ? "Sin registro · no laborable"
                        : "Sin registro"
                    }
                  } else if (d.isNonWorking) {
                    breakdown = `${formatDuration(d.seconds)} · no laborable`
                  } else if (d.extraHours > 0) {
                    breakdown = `${d.regularHours}h regulares + ${formatDuration(Math.round(d.extraHours * 3600))} extra`
                  } else {
                    breakdown = `${formatDuration(d.seconds)} reglamentarias`
                  }
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                      <p className="font-medium">
                        {d.label} {formatDateDisplay(d.key)}
                      </p>
                      {d.isEmpty && d.timeOffLabel ? (
                        <p className="text-foreground">{d.timeOffLabel}</p>
                      ) : d.seconds > 0 ? (
                        <p className="text-muted-foreground">
                          {formatDuration(d.seconds)}
                        </p>
                      ) : null}
                      {!(d.isEmpty && d.timeOffLabel) ? (
                        <p className="text-xs text-muted-foreground">
                          {breakdown}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="emptyHours"
                stackId="day"
                fill="#a3a3a3"
                maxBarSize={48}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="regularHours"
                stackId="day"
                fill="#f5f5f5"
                maxBarSize={48}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="extraHours"
                stackId="day"
                fill="var(--destructive)"
                maxBarSize={48}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
