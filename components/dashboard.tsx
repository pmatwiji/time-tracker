"use client"

import useSWR from "swr"
import { useMemo } from "react"
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  Hourglass,
  TrendingUp,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { AppConfig, WorkSession } from "@/lib/types"
import { computeStats } from "@/lib/stats"
import { formatDuration } from "@/lib/format"
import { StatCard } from "@/components/stat-card"
import { GoalProgress } from "@/components/goal-progress"
import { WeeklyChart } from "@/components/weekly-chart"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { RecentSessions } from "@/components/recent-sessions"
import { TimerDialog } from "@/components/timer-dialog"
import { ManualEntryDialog } from "@/components/manual-entry-dialog"
import { ConfigDialog } from "@/components/config-dialog"

type DashboardData = {
  config: AppConfig
  sessions: WorkSession[]
}

async function fetchData(): Promise<DashboardData> {
  const supabase = createClient()

  const [configRes, sessionsRes] = await Promise.all([
    supabase.from("app_config").select("*").eq("id", 1).single(),
    supabase
      .from("work_sessions")
      .select("*")
      .order("created_at", { ascending: false }),
  ])

  if (configRes.error) throw configRes.error
  if (sessionsRes.error) throw sessionsRes.error

  return {
    config: configRes.data as AppConfig,
    sessions: (sessionsRes.data ?? []) as WorkSession[],
  }
}

export function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR("dashboard", fetchData, {
    revalidateOnFocus: false,
  })

  const stats = useMemo(() => {
    if (!data) return null
    return computeStats(data.sessions, data.config)
  }, [data])

  const refresh = () => mutate()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Hourglass className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Horas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Registra tu tiempo y seguí tu progreso de trabajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data ? <ConfigDialog config={data.config} onSaved={refresh} /> : null}
          <ManualEntryDialog onSaved={refresh} />
          <TimerDialog onSaved={refresh} />
        </div>
      </header>

      {error ? (
        <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          <p>
            Ocurrió un error cargando los datos. Actualizá la página e intentá
            de nuevo.
          </p>
          {error instanceof Error && error.message ? (
            <p className="mt-3 text-xs text-destructive/80">{error.message}</p>
          ) : null}
        </div>
      ) : isLoading || !stats || !data ? (
        <LoadingState />
      ) : (
        <div className="mt-8 space-y-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Hoy"
              value={formatDuration(stats.todaySeconds)}
              sublabel={
                stats.todayIsWorkingDay
                  ? `Objetivo: ${data.config.daily_hours_goal}h`
                  : "Día no laborable"
              }
              icon={Clock3}
            />
            <StatCard
              label="Esta semana"
              value={formatDuration(stats.weekSeconds)}
              sublabel={`${stats.sessionCount} sesiones en total`}
              icon={TrendingUp}
            />
            <StatCard
              label="Este mes"
              value={formatDuration(stats.monthSeconds)}
              sublabel={`${stats.daysWorkedThisMonth} de ${stats.expectedWorkingDays} días hábiles`}
              icon={CalendarDays}
            />
            <StatCard
              label="Total acumulado"
              value={formatDuration(stats.totalSeconds)}
              sublabel="Desde el inicio"
              icon={CalendarCheck}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklyChart data={stats.last7Days} />
            </div>
            <GoalProgress
              goals={[
                {
                  label: "Horas de hoy",
                  detail: stats.todayIsWorkingDay
                    ? `${formatDuration(stats.todaySeconds)} / ${data.config.daily_hours_goal}h`
                    : `${formatDuration(stats.todaySeconds)} · no laborable`,
                  progress: stats.todayProgress,
                },
                {
                  label: "Días del mes",
                  detail: `${stats.daysWorkedThisMonth} / ${stats.expectedWorkingDays} días hábiles`,
                  progress: stats.monthDaysGoalProgress,
                },
                {
                  label: "Horas del mes",
                  detail: `${formatDuration(stats.monthBusinessSeconds)} / ${Math.round(
                    stats.monthHoursGoalSeconds / 3600,
                  )}h hábiles`,
                  progress: stats.monthHoursProgress,
                },
              ]}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
            <div className="grid h-full min-h-72 grid-rows-2 gap-4 lg:col-span-1 lg:min-h-0">
              <ActivityHeatmap data={stats.last30Days} />
              <StatCard
                fill
                label="Promedio por día trabajado"
                value={
                  stats.avgPerWorkedDay > 0
                    ? formatDuration(stats.avgPerWorkedDay)
                    : "—"
                }
                sublabel="Solo días hábiles del mes"
                icon={Hourglass}
              />
            </div>
            <div className="lg:col-span-2">
              <RecentSessions sessions={data.sessions} onChanged={refresh} />
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function LoadingState() {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-card lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl bg-card" />
      </div>
    </div>
  )
}
