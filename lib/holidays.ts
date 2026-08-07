import { toDateKey } from "@/lib/format"

export type Holiday = {
  fecha: string
  tipo: string
  nombre: string
}

const API_BASE = "https://api.argentinadatos.com/v1/feriados"

export async function fetchHolidays(year: number): Promise<Holiday[]> {
  const res = await fetch(`${API_BASE}/${year}`)
  if (!res.ok) {
    throw new Error(`No se pudieron cargar feriados ${year} (${res.status})`)
  }
  const data = (await res.json()) as Holiday[]
  return data.map((h) => ({
    ...h,
    fecha: toDateKey(h.fecha),
  }))
}

export async function fetchHolidaysForYears(years: number[]): Promise<Holiday[]> {
  const unique = [...new Set(years)].sort((a, b) => a - b)
  const batches = await Promise.all(unique.map(fetchHolidays))
  return batches.flat()
}

export function holidayDateSet(holidays: Holiday[]): Set<string> {
  return new Set(holidays.map((h) => toDateKey(h.fecha)))
}

export function holidayByDate(holidays: Holiday[]): Map<string, Holiday> {
  const map = new Map<string, Holiday>()
  for (const h of holidays) {
    map.set(toDateKey(h.fecha), h)
  }
  return map
}

export function isApiHoliday(dateKey: string, holidays: Set<string>): boolean {
  return holidays.has(toDateKey(dateKey))
}
