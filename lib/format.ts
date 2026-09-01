/** App calendar timezone: Argentina (UTC-3, sin DST). */
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires"

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const pad2 = (n: number) => n.toString().padStart(2, "0")

type DateParts = { year: number; month: number; day: number }

function zonedParts(date: Date, timeZone = APP_TIMEZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  }
}

/** Zero-padded HH:MM:SS for the live timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

/** Human readable duration like "2h 15m" or "45m" or "30s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/**
 * Excedente en días del objetivo diario, sin redondear de más.
 * Ej: 13h con objetivo 4h → "3 Dias 1 Hora"
 */
export function formatVacationBalance(
  excessSeconds: number,
  dailyGoalSeconds: number,
): string {
  const excess = Math.max(0, Math.floor(excessSeconds))
  const goal = Number(dailyGoalSeconds)
  if (excess <= 0 || !(goal > 0)) return "0 Dias"

  const days = Math.floor(excess / goal)
  const remainder = excess % goal
  const hours = Math.floor(remainder / 3600)
  const minutes = Math.floor((remainder % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(days === 1 ? "1 Dia" : `${days} Dias`)
  if (hours > 0) parts.push(hours === 1 ? "1 Hora" : `${hours} Horas`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.length > 0 ? parts.join(" ") : "0 Dias"
}

/** Decimal hours, rounded to 1 decimal. */
export function toHours(totalSeconds: number): number {
  return Math.round((totalSeconds / 3600) * 10) / 10
}

/** YYYY-MM-DD key for a Date in the app timezone (UTC-3). */
export function localDateKey(date: Date = new Date()): string {
  const { year, month, day } = zonedParts(date)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Today's YYYY-MM-DD in UTC-3. */
export function todayKey(): string {
  return localDateKey(new Date())
}

/** Shift a YYYY-MM-DD calendar key by N days. */
export function addDaysToKey(key: string, delta: number): string {
  const { year, month, day } = parseDateParts(key)
  const utc = new Date(Date.UTC(year, month - 1, day + delta))
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
}

/** Normaliza cualquier fecha a YYYY-MM-DD (Supabase a veces manda timestamp). */
export function toDateKey(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return value.slice(0, 10)
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function parseDateParts(key: string): DateParts {
  const normalized = toDateKey(key)
  const [year, month, day] = normalized.split("-").map(Number)
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 }
}

/** Parse YYYY-MM-DD as a noon UTC Date (stable weekday / comparisons). */
export function parseDateKey(key: string): Date {
  const { year, month, day } = parseDateParts(key)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

/** Display YYYY-MM-DD as DD/MM/AAAA. */
export function formatDateDisplay(key: string): string {
  const { year, month, day } = parseDateParts(key)
  return `${pad2(day)}/${pad2(month)}/${year}`
}

/**
 * Parse a DD/MM/AAAA (or D/M/AAAA) string into YYYY-MM-DD.
 * Returns null if invalid.
 */
export function parseDisplayDate(input: string): string | null {
  const trimmed = input.trim()
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function dayLabel(key: string): string {
  return DAY_LABELS[parseDateKey(key).getUTCDay()]
}

/** e.g. "Lun 03/08/2026" */
export function fullDateLabel(key: string): string {
  return `${dayLabel(key)} ${formatDateDisplay(key)}`
}

export function monthLabel(monthIndex: number): string {
  return MONTH_LABELS[monthIndex]
}

/** Monday YYYY-MM-DD of the week containing `key` (UTC-3 calendar). */
export function startOfWeekKey(key: string): string {
  const day = parseDateKey(key).getUTCDay()
  const mondayOffset = (day + 6) % 7
  return addDaysToKey(key, -mondayOffset)
}

/** Sábado (6) o domingo (0). */
export function isWeekendKey(key: string): boolean {
  const day = parseDateKey(key).getUTCDay()
  return day === 0 || day === 6
}

/** Horas reglamentarias por día laboral (visualización del gráfico). */
export const REGULATORY_DAILY_HOURS = 4

/**
 * Cantidad de lunes a viernes en un mes (1-12).
 * year/month usan el calendario app (UTC-3).
 */
export function countWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
    if (weekday !== 0 && weekday !== 6) count++
  }
  return count
}

/**
 * Días hábiles (lun–vie) entre start y end inclusive,
 * excluyendo fechas en `holidays`.
 */
export function countWorkingDaysInRange(
  startKey: string,
  endKey: string,
  holidays: Set<string> = new Set(),
): number {
  if (endKey < startKey) return 0
  let count = 0
  for (let key = startKey; key <= endKey; key = addDaysToKey(key, 1)) {
    if (!isWeekendKey(key) && !holidays.has(key)) count++
  }
  return count
}

/** Domingo (fin de semana laboral lun–dom) de la semana de `key`. */
export function endOfWeekKey(key: string): string {
  return addDaysToKey(startOfWeekKey(key), 6)
}

/** Días calendario inclusive entre dos fechas YYYY-MM-DD. */
export function countCalendarDaysInRange(
  startKey: string,
  endKey: string,
): number {
  if (endKey < startKey) return 0
  let count = 0
  for (let key = startKey; key <= endKey; key = addDaysToKey(key, 1)) {
    count++
  }
  return count
}
