import type { DailyGoalPeriod } from "@/lib/types"
import { addDaysToKey, isWeekendKey, toDateKey } from "@/lib/format"

/** Horas objetivo vigentes en una fecha. Sin períodos, usa el fallback. */
export function goalHoursOnDate(
  dateKey: string,
  periods: DailyGoalPeriod[],
  fallbackHours: number,
): number {
  const key = toDateKey(dateKey)
  let hours = fallbackHours
  const sorted = [...periods].sort((a, b) =>
    toDateKey(a.effective_from) < toDateKey(b.effective_from) ? -1 : 1,
  )
  for (const period of sorted) {
    if (toDateKey(period.effective_from) <= key) hours = Number(period.daily_hours)
    else break
  }
  return hours
}

/** Suma el objetivo de cada día hábil del rango (lun–vie, sin feriados). */
export function sumGoalSecondsOnWorkingDays(
  startKey: string,
  endKey: string,
  holidays: Set<string>,
  periods: DailyGoalPeriod[],
  fallbackHours: number,
): number {
  const start = toDateKey(startKey)
  const end = toDateKey(endKey)
  if (end < start) return 0
  let total = 0
  for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
    if (isWeekendKey(key) || holidays.has(key)) continue
    total += goalHoursOnDate(key, periods, fallbackHours) * 3600
  }
  return total
}

export function monthRangeKeys(year: number, month: number): {
  start: string
  end: string
} {
  const mm = String(month).padStart(2, "0")
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dd = String(last).padStart(2, "0")
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${dd}` }
}
