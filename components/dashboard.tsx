"use client"

import useSWR from "swr"
import { useMemo } from "react"
import {
  Briefcase,
  CalendarDays,
  Clock3,
  Hourglass,
  TrendingUp,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { AppConfig, DailyGoalPeriod, VacationUsage, WorkSession } from "@/lib/types"
import { computeStats } from "@/lib/stats"
import {
  addDaysToKey,
  formatDuration,
  formatVacationDayUnits,
  parseDateParts,
  toDateKey,
  todayKey,
} from "@/lib/format"
import {
  fetchHolidaysForYears,
  holidayDateSet,
} from "@/lib/holidays"
import { StatCard } from "@/components/stat-card"
import { GoalProgress } from "@/components/goal-progress"
import { WeeklyChart } from "@/components/weekly-chart"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { RecentSessions } from "@/components/recent-sessions"
import { TimerDialog } from "@/components/timer-dialog"
import { ManualEntryDialog } from "@/components/manual-entry-dialog"
import { ConfigDialog } from "@/components/config-dialog"
import { HolidaysCalendarDialog } from "@/components/holidays-calendar-dialog"
import { TimeOffDialog } from "@/components/time-off-dialog"
import { TimeOffList } from "@/components/time-off-list"
import { goalHoursOnDate } from "@/lib/goals"

type DashboardData = {
  config: AppConfig
  sessions: WorkSession[]
  vacationUsages: VacationUsage[]
  goalPeriods: DailyGoalPeriod[]
}

function isMissingGoalTable(error: { code?: string; message?: string }) {
  const code = error.code ?? ""
  const message = error.message ?? ""
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("daily_goal_periods")
  )
}

async function fetchData(): Promise<DashboardData> {
  const supabase = createClient()

  const [configRes, sessionsRes, vacationRes, goalsRes] = await Promise.all([
    supabase.from("app_config").select("*").eq("id", 1).single(),
    supabase
      .from("work_sessions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("vacation_usage")
      .select("*")
      .order("start_date", { ascending: false }),
    supabase
      .from("daily_goal_periods")
      .select("*")
      .order("effective_from", { ascending: true }),
  ])

  if (configRes.error) throw configRes.error
  if (sessionsRes.error) throw sessionsRes.error
  if (vacationRes.error) throw vacationRes.error
  if (goalsRes.error && !isMissingGoalTable(goalsRes.error)) throw goalsRes.error

  return {
    config: configRes.data as AppConfig,
    sessions: (sessionsRes.data ?? []) as WorkSession[],
    vacationUsages: (vacationRes.data ?? []) as VacationUsage[],
    goalPeriods: (goalsRes.error ? [] : (goalsRes.data ?? [])) as DailyGoalPeriod[],
  }
}

export function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR("dashboard", fetchData, {
    revalidateOnFocus: false,
  })

  const holidayYears = useMemo(() => {
    const years = new Set<number>()
    const today = todayKey()
    years.add(parseDateParts(today).year)
    years.add(parseDateParts(addDaysToKey(today, -29)).year)
    for (const s of data?.sessions ?? []) {
      years.add(parseDateParts(toDateKey(s.worked_on)).year)
    }
    for (const v of data?.vacationUsages ?? []) {
      years.add(parseDateParts(toDateKey(v.start_date)).year)
      years.add(parseDateParts(toDateKey(v.end_date)).year)
    }
    return [...years]
  }, [data?.sessions, data?.vacationUsages])

  const { data: apiHolidays = [] } = useSWR(
    holidayYears.length ? ["feriados", ...holidayYears] : null,
    () => fetchHolidaysForYears(holidayYears),
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 },
  )

  const apiHolidayDates = useMemo(
    () => holidayDateSet(apiHolidays),
    [apiHolidays],
  )

  const mergedHolidayDates = useMemo(() => {
    const merged = new Set(apiHolidayDates)
    for (const s of data?.sessions ?? []) {
      if (s.is_holiday) merged.add(toDateKey(s.worked_on))
    }
    return merged
  }, [apiHolidayDates, data?.sessions])

  const stats = useMemo(() => {
    if (!data) return null
    return computeStats(
      data.sessions,
      data.config,
      apiHolidayDates,
      data.vacationUsages,
      data.goalPeriods,
    )
  }, [data, apiHolidayDates])

  const fallbackHours = Number(data?.config.daily_hours_goal ?? 4)
  const goalPeriods = data?.goalPeriods ?? []
  const dailyGoalSeconds = (stats?.todayGoalHours ?? fallbackHours) * 3600
  const vacationLabel = stats
    ? formatVacationDayUnits(stats.netVacationDayUnits, dailyGoalSeconds)
    : "0 Dias"

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
          {data ? (
            <ConfigDialog
              config={data.config}
              goalPeriods={data.goalPeriods}
              onSaved={refresh}
            />
          ) : null}
          <HolidaysCalendarDialog />
          <ManualEntryDialog
            onSaved={refresh}
            holidayDates={apiHolidayDates}
            goalHoursForDate={(dateKey) =>
              goalHoursOnDate(dateKey, goalPeriods, fallbackHours)
            }
          />
          <TimeOffDialog
            onSaved={refresh}
            availableDayUnits={stats?.netVacationDayUnits ?? 0}
            goalPeriods={goalPeriods}
            fallbackHours={fallbackHours}
            holidayDates={mergedHolidayDates}
          />
          <TimerDialog onSaved={refresh} holidayDates={apiHolidayDates} />
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
                  ? `Objetivo: ${stats.todayGoalHours}h`
                  : "Día no laborable"
              }
              icon={Clock3}
            />
            <StatCard
              label="Esta semana"
              value={formatDuration(stats.weekSeconds)}
              sublabel={`Objetivo: ${formatDuration(stats.weekHoursGoalSeconds)} (${stats.expectedWorkingDaysThisWeek} días)`}
              icon={TrendingUp}
            />
            <StatCard
              label="Este mes"
              value={formatDuration(stats.monthSeconds)}
              sublabel={`Objetivo: ${formatDuration(stats.monthHoursGoalSeconds)} (${stats.expectedWorkingDays} días)`}
              icon={CalendarDays}
            />
            <StatCard
              label="Horas trabajadas"
              value={formatDuration(stats.totalSeconds)}
              sublabelSingleLine
              sublabel={
                stats.firstWorkedOn ? (
                  <div className="space-y-0.5">
                    <p title={`Debía: ${formatDuration(stats.expectedSecondsSinceStart)} (${stats.expectedDaysSinceStart} días hábiles)`}>
                      Debía: {formatDuration(stats.expectedSecondsSinceStart)}{" "}
                      ({stats.expectedDaysSinceStart} días hábiles)
                    </p>
                    <p title={`Días libres: ${vacationLabel}`}>
                      Días libres: {vacationLabel}
                    </p>
                  </div>
                ) : (
                  "Sin registros aún"
                )
              }
              icon={Briefcase}
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
                    ? `${formatDuration(stats.todaySeconds)} / ${stats.todayGoalHours}h`
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
                  detail: `${formatDuration(stats.monthBusinessSeconds)} / ${formatDuration(stats.monthHoursGoalSeconds)} hábiles`,
                  progress: stats.monthHoursProgress,
                },
                {
                  label: "Días libres",
                  detail: vacationLabel,
                  progress:
                    stats.vacationDayUnits > 0
                      ? Math.min(
                          Math.max(stats.netVacationDayUnits, 0) /
                            stats.vacationDayUnits,
                          1,
                        )
                      : 0,
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

          <section>
            <TimeOffList
              usages={data.vacationUsages}
              holidayDates={mergedHolidayDates}
              goalPeriods={data.goalPeriods}
              fallbackHours={Number(data.config.daily_hours_goal)}
              onChanged={refresh}
            />
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
