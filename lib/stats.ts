import type { AppConfig, WorkSession } from "@/lib/types"
import { localDateKey, toHours } from "@/lib/format"

export type DayTotal = { date: string; seconds: number }

export type Stats = {
  totalSeconds: number
  todaySeconds: number
  monthSeconds: number
  weekSeconds: number
  sessionCount: number
  daysWorkedThisMonth: number
  avgPerWorkedDay: number
  bestDay: DayTotal | null
  todayGoalSeconds: number
  todayProgress: number // 0..1
  monthDaysGoalProgress: number // 0..1
  monthHoursGoalSeconds: number
  monthHoursProgress: number // 0..1
  last7Days: DayTotal[]
}

function startOfWeek(now: Date): Date {
  const d = new Date(now)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function computeStats(sessions: WorkSession[], config: AppConfig): Stats {
  const now = new Date()
  const todayKey = localDateKey(now)
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const weekStart = startOfWeek(now)

  const byDay = new Map<string, number>()
  let totalSeconds = 0
  let todaySeconds = 0
  let monthSeconds = 0
  let weekSeconds = 0

  for (const s of sessions) {
    totalSeconds += s.duration_seconds
    byDay.set(s.worked_on, (byDay.get(s.worked_on) ?? 0) + s.duration_seconds)

    if (s.worked_on === todayKey) todaySeconds += s.duration_seconds

    const d = new Date(s.worked_on + "T00:00:00")
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthSeconds += s.duration_seconds
    }
    if (d >= weekStart) weekSeconds += s.duration_seconds
  }

  // Best day across all records
  let bestDay: DayTotal | null = null
  for (const [date, seconds] of byDay.entries()) {
    if (!bestDay || seconds > bestDay.seconds) bestDay = { date, seconds }
  }

  // Days worked this month
  let daysWorkedThisMonth = 0
  for (const [date, seconds] of byDay.entries()) {
    const d = new Date(date + "T00:00:00")
    if (
      seconds > 0 &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    ) {
      daysWorkedThisMonth++
    }
  }

  const avgPerWorkedDay =
    daysWorkedThisMonth > 0 ? monthSeconds / daysWorkedThisMonth : 0

  // Last 7 days series (oldest -> newest)
  const last7Days: DayTotal[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = localDateKey(d)
    last7Days.push({ date: key, seconds: byDay.get(key) ?? 0 })
  }

  const todayGoalSeconds = config.daily_hours_goal * 3600
  const monthHoursGoalSeconds =
    config.daily_hours_goal * config.monthly_days_goal * 3600

  return {
    totalSeconds,
    todaySeconds,
    monthSeconds,
    weekSeconds,
    sessionCount: sessions.length,
    daysWorkedThisMonth,
    avgPerWorkedDay,
    bestDay,
    todayGoalSeconds,
    todayProgress:
      todayGoalSeconds > 0 ? Math.min(todaySeconds / todayGoalSeconds, 1) : 0,
    monthDaysGoalProgress:
      config.monthly_days_goal > 0
        ? Math.min(daysWorkedThisMonth / config.monthly_days_goal, 1)
        : 0,
    monthHoursGoalSeconds,
    monthHoursProgress:
      monthHoursGoalSeconds > 0
        ? Math.min(monthSeconds / monthHoursGoalSeconds, 1)
        : 0,
    last7Days,
  }
}

export { toHours }
