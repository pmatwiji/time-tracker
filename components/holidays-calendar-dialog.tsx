"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  addDaysToKey,
  isWeekendKey,
  monthLabel,
  parseDateParts,
  startOfWeekKey,
  todayKey,
  toDateKey,
} from "@/lib/format"
import { fetchHolidays, holidayByDate, type Holiday } from "@/lib/holidays"
import { cn } from "@/lib/utils"

const WEEK_HEADERS = ["L", "M", "X", "J", "V", "S", "D"]

type CellKind = "empty" | "workday" | "weekend" | "holiday"

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function HolidaysCalendarDialog() {
  const today = todayKey()
  const todayParts = parseDateParts(today)
  const [cursor, setCursor] = useState({
    year: todayParts.year,
    month: todayParts.month,
  })

  const { data: holidays = [], isLoading, error } = useSWR(
    `feriados-${cursor.year}`,
    () => fetchHolidays(cursor.year),
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 },
  )

  const byDate = useMemo(() => holidayByDate(holidays), [holidays])

  const cells = useMemo(() => {
    const firstKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-01`
    const gridStart = startOfWeekKey(firstKey)
    const totalDays = daysInMonth(cursor.year, cursor.month)
    const lastKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`

    const result: Array<{
      key: string | null
      day: number | null
      kind: CellKind
      holiday?: Holiday
      isToday: boolean
    }> = []

    for (let i = 0; i < 42; i++) {
      const key = addDaysToKey(gridStart, i)
      const parts = parseDateParts(key)
      if (parts.month !== cursor.month || parts.year !== cursor.year) {
        result.push({ key: null, day: null, kind: "empty", isToday: false })
        continue
      }

      const holiday = byDate.get(toDateKey(key))
      let kind: CellKind = "workday"
      if (holiday) kind = "holiday"
      else if (isWeekendKey(key)) kind = "weekend"

      result.push({
        key,
        day: parts.day,
        kind,
        holiday,
        isToday: key === today,
      })

      if (key >= lastKey && (i + 1) % 7 === 0) break
    }

    return result
  }, [byDate, cursor.month, cursor.year, today])

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      let month = prev.month + delta
      let year = prev.year
      if (month < 1) {
        month = 12
        year -= 1
      } else if (month > 12) {
        month = 1
        year += 1
      }
      return { year, month }
    })
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="gap-2">
            <CalendarRange className="size-5" />
            Calendario
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calendario laboral</DialogTitle>
          <DialogDescription>
            Días hábiles y feriados (Argentina). Solo consulta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Mes anterior"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-medium">
              {monthLabel(cursor.month - 1)} {cursor.year}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Mes siguiente"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              No se pudieron cargar los feriados. Probá de nuevo más tarde.
            </p>
          ) : null}

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {WEEK_HEADERS.map((h) => (
              <div key={h} className="py-1 font-medium">
                {h}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell.key || cell.day == null) {
                return <div key={`e-${idx}`} className="aspect-square" />
              }

              return (
                <div
                  key={cell.key}
                  title={
                    cell.holiday
                      ? `${cell.holiday.nombre} (${cell.holiday.tipo})`
                      : cell.kind === "weekend"
                        ? "Fin de semana"
                        : "Día hábil"
                  }
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-md text-xs tabular-nums",
                    cell.kind === "workday" && "bg-muted/60 text-foreground",
                    cell.kind === "weekend" &&
                      "bg-muted/30 text-muted-foreground",
                    cell.kind === "holiday" &&
                      "bg-destructive/20 text-destructive",
                    cell.isToday && "ring-2 ring-primary",
                    isLoading && "opacity-60",
                  )}
                >
                  <span className="font-medium">{cell.day}</span>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-muted/60" /> Hábil
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-muted/30" /> Finde
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-destructive/20" /> Feriado
            </span>
          </div>

          {holidays.filter((h) => {
            const p = parseDateParts(h.fecha)
            return p.year === cursor.year && p.month === cursor.month
          }).length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {holidays
                .filter((h) => {
                  const p = parseDateParts(h.fecha)
                  return p.year === cursor.year && p.month === cursor.month
                })
                .map((h) => (
                  <li key={h.fecha}>
                    <span className="font-medium text-foreground">
                      {h.fecha.slice(8, 10)}/{h.fecha.slice(5, 7)}
                    </span>{" "}
                    · {h.nombre}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
