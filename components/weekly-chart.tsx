"use client"

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayTotal } from "@/lib/stats"
import { dayLabel, formatDuration, localDateKey, toHours } from "@/lib/format"

type WeeklyChartProps = {
  data: DayTotal[]
  goalHours: number
}

type ChartDatum = {
  key: string
  label: string
  hours: number
  seconds: number
  isToday: boolean
}

export function WeeklyChart({ data, goalHours }: WeeklyChartProps) {
  const todayKey = localDateKey(new Date())
  const chartData: ChartDatum[] = data.map((d) => ({
    key: d.date,
    label: dayLabel(d.date),
    hours: toHours(d.seconds),
    seconds: d.seconds,
    isToday: d.date === todayKey,
  }))

  const maxHours = Math.max(goalHours, ...chartData.map((d) => d.hours), 1)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Últimos 7 días</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
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
                width={40}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as ChartDatum
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                      <p className="font-medium">{d.label}</p>
                      <p className="text-muted-foreground">
                        {d.seconds > 0 ? formatDuration(d.seconds) : "Sin registro"}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((d) => (
                  <Cell
                    key={d.key}
                    fill={d.isToday ? "var(--primary)" : "var(--chart-2)"}
                    fillOpacity={d.isToday ? 1 : 0.55}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
