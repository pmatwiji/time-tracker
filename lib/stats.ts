import type { AppConfig, VacationUsage, WorkSession } from "@/lib/types"
import {
  addDaysToKey,
  countWeekdaysInMonth,
  countWorkingDaysInRange,
  endOfWeekKey,
  isWeekendKey,
  localDateKey,
  parseDateParts,
  startOfWeekKey,
  toDateKey,
  todayKey,
  toHours,
} from "@/lib/format"

export type DayTotal = {
  date: string
  seconds: number
  isWeekend: boolean
  isHoliday: boolean
  /** Descripción si el día está cargado como día libre (día hábil). */
  timeOffLabel?: string | null
}

export type Stats = {
  totalSeconds: number
  todaySeconds: number
  monthSeconds: number
  /** Horas del mes solo en días hábiles (para objetivos). */
  monthBusinessSeconds: number
  weekSeconds: number
  /** Días hábiles del mes con horas (lun-vie, no feriado). */
  daysWorkedThisMonth: number
  /** Lun-vie del mes menos feriados marcados. */
  expectedWorkingDays: number
  /** Días hábiles de la semana actual (lun–vie − feriados). */
  expectedWorkingDaysThisWeek: number
  weekHoursGoalSeconds: number
  monthHoursGoalSeconds: number
  avgPerWorkedDay: number
  bestDay: DayTotal | null
  todayIsWorkingDay: boolean
  todayGoalSeconds: number
  todayProgress: number // 0..1
  monthDaysGoalProgress: number // 0..1
  monthHoursProgress: number // 0..1
  /** Primera fecha con registro (YYYY-MM-DD). */
  firstWorkedOn: string | null
  /** Días hábiles con horas cargadas (base del esperado). */
  expectedDaysSinceStart: number
  /** Horas esperadas = días hábiles trabajados × objetivo diario. */
  expectedSecondsSinceStart: number
  /** Horas extra: exceso en días hábiles + todo lo de finde/feriado. */
  excessSeconds: number
  /** Horas de vacaciones/días libres consumidos del banco. */
  vacationUsedSeconds: number
  /** Excedente neto después de descontar vacaciones usadas. */
  netExcessSeconds: number
  /** Excedente pasado a días según el objetivo diario (bruto, sin descontar uso). */
  vacationDays: number
  last7Days: DayTotal[]
  last30Days: DayTotal[]
}

function holidayDatesFromSessions(sessions: WorkSession[]): Set<string> {
  const holidays = new Set<string>()
  for (const s of sessions) {
    if (s.is_holiday) holidays.add(toDateKey(s.worked_on))
  }
  return holidays
}

function mergeHolidaySets(...sets: Array<Set<string> | undefined>): Set<string> {
  const merged = new Set<string>()
  for (const set of sets) {
    if (!set) continue
    for (const d of set) merged.add(toDateKey(d))
  }
  return merged
}

function isNonWorkingDay(key: string, holidays: Set<string>): boolean {
  return isWeekendKey(key) || holidays.has(key)
}

function buildTimeOffByDate(
  vacationUsages: VacationUsage[],
  holidays: Set<string>,
): Map<string, string> {
  const byDate = new Map<string, string>()
  for (const usage of vacationUsages) {
    const start = toDateKey(usage.start_date)
    const end = toDateKey(usage.end_date)
    const label = usage.description?.trim() || "Día libre"
    for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
      if (isNonWorkingDay(key, holidays)) continue
      byDate.set(key, label)
    }
  }
  return byDate
}

export function computeStats(
  sessions: WorkSession[],
  config: AppConfig,
  apiHolidays?: Set<string>,
  vacationUsages: VacationUsage[] = [],
): Stats {
  const today = todayKey()
  const { year: currentYear, month: currentMonth } = parseDateParts(today)
  const weekStart = startOfWeekKey(today)
  const weekEnd = endOfWeekKey(today)
  const holidays = mergeHolidaySets(
    holidayDatesFromSessions(sessions),
    apiHolidays,
  )
  const dailyGoalSeconds = Number(config.daily_hours_goal) * 3600
  const timeOffByDate = buildTimeOffByDate(vacationUsages, holidays)

  const byDay = new Map<string, number>()
  let totalSeconds = 0
  let todaySeconds = 0
  let monthSeconds = 0
  let weekSeconds = 0
  let monthBusinessSeconds = 0
  let firstWorkedOn: string | null = null

  for (const s of sessions) {
    const workedOn = toDateKey(s.worked_on)
    totalSeconds += s.duration_seconds
    byDay.set(workedOn, (byDay.get(workedOn) ?? 0) + s.duration_seconds)

    if (!firstWorkedOn || workedOn < firstWorkedOn) {
      firstWorkedOn = workedOn
    }

    if (workedOn === today) todaySeconds += s.duration_seconds

    const parts = parseDateParts(workedOn)
    if (parts.month === currentMonth && parts.year === currentYear) {
      monthSeconds += s.duration_seconds
      if (!isNonWorkingDay(workedOn, holidays)) {
        monthBusinessSeconds += s.duration_seconds
      }
    }
    if (workedOn >= weekStart && workedOn <= weekEnd) {
      weekSeconds += s.duration_seconds
    }
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
  const expectedWorkingDaysThisWeek = countWorkingDaysInRange(
    weekStart,
    weekEnd,
    holidays,
  )

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
      timeOffLabel: timeOffByDate.get(key) ?? null,
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
      timeOffLabel: timeOffByDate.get(key) ?? null,
    })
  }

  const todayIsWorkingDay = !isNonWorkingDay(today, holidays)
  const todayGoalSeconds = todayIsWorkingDay ? dailyGoalSeconds : 0
  const weekHoursGoalSeconds =
    Number(config.daily_hours_goal) * expectedWorkingDaysThisWeek * 3600
  const monthHoursGoalSeconds =
    Number(config.daily_hours_goal) * expectedWorkingDays * 3600

  // Banco de vacaciones: solo horas por encima del objetivo diario.
  // Finde/feriado cuenta entero. Los días por debajo del objetivo NO restan.
  let excessSeconds = 0
  let workedBusinessDaysSinceStart = 0
  for (const [date, seconds] of byDay.entries()) {
    if (seconds <= 0) continue
    if (isNonWorkingDay(date, holidays)) {
      excessSeconds += seconds
      continue
    }
    workedBusinessDaysSinceStart++
    excessSeconds += Math.max(0, seconds - dailyGoalSeconds)
  }

  const expectedDaysSinceStart = workedBusinessDaysSinceStart
  const expectedSecondsSinceStart =
    workedBusinessDaysSinceStart * dailyGoalSeconds
  const vacationDays =
    dailyGoalSeconds > 0 ? excessSeconds / dailyGoalSeconds : 0

  let vacationUsedSeconds = 0
  for (const usage of vacationUsages) {
    const days = countWorkingDaysInRange(
      toDateKey(usage.start_date),
      toDateKey(usage.end_date),
      holidays,
    )
    vacationUsedSeconds += days * dailyGoalSeconds
  }
  const netExcessSeconds = excessSeconds - vacationUsedSeconds

  return {
    totalSeconds,
    todaySeconds,
    monthSeconds,
    monthBusinessSeconds,
    weekSeconds,
    daysWorkedThisMonth,
    expectedWorkingDays,
    expectedWorkingDaysThisWeek,
    weekHoursGoalSeconds,
    monthHoursGoalSeconds,
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
    monthHoursProgress:
      monthHoursGoalSeconds > 0
        ? Math.min(monthBusinessSeconds / monthHoursGoalSeconds, 1)
        : 0,
    firstWorkedOn,
    expectedDaysSinceStart,
    expectedSecondsSinceStart,
    excessSeconds,
    vacationUsedSeconds,
    netExcessSeconds,
    vacationDays,
    last7Days,
    last30Days,
  }
}

export { toHours, localDateKey }
