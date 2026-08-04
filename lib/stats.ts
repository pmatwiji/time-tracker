import type { AppConfig, WorkSession } from "@/lib/types"
import {
  addDaysToKey,
  countWeekdaysInMonth,
  isWeekendKey,
  localDateKey,
  parseDateParts,
  startOfWeekKey,
  todayKey,
  toHours,
} from "@/lib/format"

export type DayTotal = {
  date: string
  seconds: number
  isWeekend: boolean
  isHoliday: boolean
}

export type Stats = {
  totalSeconds: number
  todaySeconds: number
  monthSeconds: number
  /** Horas del mes solo en días hábiles (para objetivos). */
  monthBusinessSeconds: number
  weekSeconds: number
  sessionCount: number
  /** Días hábiles del mes con horas (lun-vie, no feriado). */
  daysWorkedThisMonth: number
  /** Lun-vie del mes menos feriados marcados. */
  expectedWorkingDays: number
  avgPerWorkedDay: number
  bestDay: DayTotal | null
  todayIsWorkingDay: boolean
  todayGoalSeconds: number
  todayProgress: number // 0..1
  monthDaysGoalProgress: number // 0..1
  monthHoursGoalSeconds: number
  monthHoursProgress: number // 0..1
  last7Days: DayTotal[]
  last30Days: DayTotal[]
}

function holidayDates(sessions: WorkSession[]): Set<string> {
  const holidays = new Set<string>()
  for (const s of sessions) {
    if (s.is_holiday) holidays.add(s.worked_on)
  }
  return holidays
}

function isNonWorkingDay(key: string, holidays: Set<string>): boolean {
  return isWeekendKey(key) || holidays.has(key)
}

export function computeStats(sessions: WorkSession[], config: AppConfig): Stats {
  const today = todayKey()
  const { year: currentYear, month: currentMonth } = parseDateParts(today)
  const weekStart = startOfWeekKey(today)
  const holidays = holidayDates(sessions)

  const byDay = new Map<string, number>()
  let totalSeconds = 0
  let todaySeconds = 0
  let monthSeconds = 0
  let weekSeconds = 0
  let monthBusinessSeconds = 0

  for (const s of sessions) {
    totalSeconds += s.duration_seconds
    byDay.set(s.worked_on, (byDay.get(s.worked_on) ?? 0) + s.duration_seconds)

    if (s.worked_on === today) todaySeconds += s.duration_seconds

    const parts = parseDateParts(s.worked_on)
    if (parts.month === currentMonth && parts.year === currentYear) {
      monthSeconds += s.duration_seconds
      if (!isNonWorkingDay(s.worked_on, holidays)) {
        monthBusinessSeconds += s.duration_seconds
      }
    }
    if (s.worked_on >= weekStart) weekSeconds += s.duration_seconds
  }

  const weekdaysInMonth = countWeekdaysInMonth(currentYear, currentMonth)
  let holidayWeekdaysInMonth = 0
  for (const date of holidays) {
    const parts = parseDateParts(date)
    if (
      parts.month === currentMonth &&
      parts.year === currentYear &&
      !isWeekendKey(date)
    ) {
      holidayWeekdaysInMonth++
    }
  }
  const expectedWorkingDays = Math.max(0, weekdaysInMonth - holidayWeekdaysInMonth)

  let daysWorkedThisMonth = 0
  for (const [date, seconds] of byDay.entries()) {
    const parts = parseDateParts(date)
    if (
      seconds > 0 &&
      parts.month === currentMonth &&
      parts.year === currentYear &&
      !isNonWorkingDay(date, holidays)
    ) {
      daysWorkedThisMonth++
    }
  }

  const avgPerWorkedDay =
    daysWorkedThisMonth > 0 ? monthBusinessSeconds / daysWorkedThisMonth : 0

  let bestDay: DayTotal | null = null
  for (const [date, seconds] of byDay.entries()) {
    if (!bestDay || seconds > bestDay.seconds) {
      bestDay = {
        date,
        seconds,
        isWeekend: isWeekendKey(date),
        isHoliday: holidays.has(date),
      }
    }
  }

  const last7Days: DayTotal[] = []
  for (let i = 6; i >= 0; i--) {
    const key = addDaysToKey(today, -i)
    last7Days.push({
      date: key,
      seconds: byDay.get(key) ?? 0,
      isWeekend: isWeekendKey(key),
      isHoliday: holidays.has(key),
    })
  }

  const last30Days: DayTotal[] = []
  for (let i = 29; i >= 0; i--) {
    const key = addDaysToKey(today, -i)
    last30Days.push({
      date: key,
      seconds: byDay.get(key) ?? 0,
      isWeekend: isWeekendKey(key),
      isHoliday: holidays.has(key),
    })
  }

  const todayIsWorkingDay = !isNonWorkingDay(today, holidays)
  const todayGoalSeconds = todayIsWorkingDay
    ? config.daily_hours_goal * 3600
    : 0
  const monthHoursGoalSeconds =
    config.daily_hours_goal * expectedWorkingDays * 3600

  return {
    totalSeconds,
    todaySeconds,
    monthSeconds,
    monthBusinessSeconds,
    weekSeconds,
    sessionCount: sessions.length,
    daysWorkedThisMonth,
    expectedWorkingDays,
    avgPerWorkedDay,
    bestDay,
    todayIsWorkingDay,
    todayGoalSeconds,
    todayProgress: todayIsWorkingDay
      ? todayGoalSeconds > 0
        ? Math.min(todaySeconds / todayGoalSeconds, 1)
        : 0
      : 1,
    monthDaysGoalProgress:
      expectedWorkingDays > 0
        ? Math.min(daysWorkedThisMonth / expectedWorkingDays, 1)
        : 0,
    monthHoursGoalSeconds,
    monthHoursProgress:
      monthHoursGoalSeconds > 0
        ? Math.min(monthBusinessSeconds / monthHoursGoalSeconds, 1)
        : 0,
    last7Days,
    last30Days,
  }
}

export { toHours, localDateKey }
