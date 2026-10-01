import type { AppConfig, DailyGoalPeriod, VacationUsage, WorkSession } from "@/lib/types"
import {
  goalHoursOnDate,
  monthRangeKeys,
  sumGoalSecondsOnWorkingDays,
} from "@/lib/goals"
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
  /** Objetivo diario vigente en esa fecha. */
  goalHours: number
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
  /** Objetivo de hoy, también en días no laborables. */
  todayGoalHours: number
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
  /** Excedente neto después de descontar días libres usados. */
  netExcessSeconds: number
  /** Días libres ganados (exceso / objetivo de cada día). */
  vacationDayUnits: number
  /** Días libres netos después de descontar los usados. */
  netVacationDayUnits: number
  /** Excedente pasado a días según el objetivo de cada fecha. */
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
  goalPeriods: DailyGoalPeriod[] = [],
): Stats {
  const today = todayKey()
  const { year: currentYear, month: currentMonth } = parseDateParts(today)
  const weekStart = startOfWeekKey(today)
  const weekEnd = endOfWeekKey(today)
  const holidays = mergeHolidaySets(
    holidayDatesFromSessions(sessions),
    apiHolidays,
  )
  const fallbackHours = Number(config.daily_hours_goal)
  const goalHours = (key: string) =>
    goalHoursOnDate(key, goalPeriods, fallbackHours)
  const goalSeconds = (key: string) => goalHours(key) * 3600
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
        goalHours: goalHours(date),
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
      goalHours: goalHours(key),
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
      goalHours: goalHours(key),
    })
  }

  const todayGoalHours = goalHours(today)
  const todayIsWorkingDay = !isNonWorkingDay(today, holidays)
  const todayGoalSeconds = todayIsWorkingDay ? todayGoalHours * 3600 : 0
  const weekHoursGoalSeconds = sumGoalSecondsOnWorkingDays(
    weekStart,
    weekEnd,
    holidays,
    goalPeriods,
    fallbackHours,
  )
  const monthRange = monthRangeKeys(currentYear, currentMonth)
  const monthHoursGoalSeconds = sumGoalSecondsOnWorkingDays(
    monthRange.start,
    monthRange.end,
    holidays,
    goalPeriods,
    fallbackHours,
  )

  // Banco de días libres: el exceso se mide contra el objetivo de cada fecha.
  // Finde/feriado cuenta entero. Los días por debajo del objetivo NO restan.
  let excessSeconds = 0
  let vacationDayUnits = 0
  let workedBusinessDaysSinceStart = 0
  let expectedSecondsSinceStart = 0
  for (const [date, seconds] of byDay.entries()) {
    if (seconds <= 0) continue
    const dayGoalSeconds = goalSeconds(date)
    if (isNonWorkingDay(date, holidays)) {
      excessSeconds += seconds
      if (dayGoalSeconds > 0) vacationDayUnits += seconds / dayGoalSeconds
      continue
    }
    workedBusinessDaysSinceStart++
    expectedSecondsSinceStart += dayGoalSeconds
    const extra = Math.max(0, seconds - dayGoalSeconds)
    excessSeconds += extra
    if (dayGoalSeconds > 0) vacationDayUnits += extra / dayGoalSeconds
  }

  const expectedDaysSinceStart = workedBusinessDaysSinceStart
  const vacationDays = vacationDayUnits

  let vacationUsedSeconds = 0
  let vacationUsedDayUnits = 0
  for (const usage of vacationUsages) {
    const start = toDateKey(usage.start_date)
    const end = toDateKey(usage.end_date)
    vacationUsedSeconds += sumGoalSecondsOnWorkingDays(
      start,
      end,
      holidays,
      goalPeriods,
      fallbackHours,
    )
    vacationUsedDayUnits += countWorkingDaysInRange(start, end, holidays)
  }
  const netExcessSeconds = excessSeconds - vacationUsedSeconds
  const netVacationDayUnits = vacationDayUnits - vacationUsedDayUnits

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
    todayGoalHours,
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
    vacationDayUnits,
    netVacationDayUnits,
    vacationDays,
    last7Days,
    last30Days,
  }
}

export { toHours, localDateKey }
