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

export function parseDateParts(key: string): DateParts {
  const [year, month, day] = key.split("-").map(Number)
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
