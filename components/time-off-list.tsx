"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarOff, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DailyGoalPeriod, VacationUsage } from "@/lib/types"
import {
  countWorkingDaysInRange,
  formatDateDisplay,
  formatDuration,
  fullDateLabel,
  parseDisplayDate,
  toDateKey,
} from "@/lib/format"
import { sumGoalSecondsOnWorkingDays } from "@/lib/goals"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type TimeOffListProps = {
  usages: VacationUsage[]
  holidayDates?: Set<string>
  goalPeriods?: DailyGoalPeriod[]
  fallbackHours?: number
  onChanged: () => void
}

type EditingField = "description" | "dates" | null

function formatRange(start: string, end: string): string {
  const s = toDateKey(start)
  const e = toDateKey(end)
  if (s === e) return fullDateLabel(s)
  return `${formatDateDisplay(s)} – ${formatDateDisplay(e)}`
}

function workingDaysSummary(
  start: string,
  end: string,
  holidayDates: Set<string> | undefined,
  goalPeriods: DailyGoalPeriod[],
  fallbackHours: number,
): { days: number; seconds: number } {
  const holidays = holidayDates ?? new Set<string>()
  const days = countWorkingDaysInRange(start, end, holidays)
  const seconds = sumGoalSecondsOnWorkingDays(
    start,
    end,
    holidays,
    goalPeriods,
    fallbackHours,
  )
  return { days, seconds }
}

export function TimeOffList({
  usages,
  holidayDates,
  goalPeriods = [],
  fallbackHours = 4,
  onChanged,
}: TimeOffListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [startDraft, setStartDraft] = useState("")
  const [endDraft, setEndDraft] = useState("")
  const descriptionInputRef = useRef<HTMLInputElement>(null)
  const startInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingField === "description") descriptionInputRef.current?.focus()
    if (editingField === "dates") startInputRef.current?.focus()
  }, [editingField, editingId])

  const cancelEdit = () => {
    setEditingId(null)
    setEditingField(null)
  }

  const startEditDescription = (usage: VacationUsage) => {
    setEditingId(usage.id)
    setEditingField("description")
    setDescriptionDraft(usage.description?.trim() ?? "")
  }

  const startEditDates = (usage: VacationUsage) => {
    setEditingId(usage.id)
    setEditingField("dates")
    setStartDraft(formatDateDisplay(toDateKey(usage.start_date)))
    setEndDraft(formatDateDisplay(toDateKey(usage.end_date)))
  }

  const saveDescription = async (usage: VacationUsage) => {
    const next = descriptionDraft.trim() || null
    const prev = usage.description?.trim() || null
    if (next === prev) {
      cancelEdit()
      return
    }

    setSavingId(usage.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("vacation_usage")
      .update({ description: next })
      .eq("id", usage.id)
    setSavingId(null)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Descripción actualizada")
    cancelEdit()
    onChanged()
  }

  const saveDates = async (usage: VacationUsage) => {
    const start = parseDisplayDate(startDraft)
    const end = parseDisplayDate(endDraft)

    if (!start || !end) {
      toast.error("Fecha inválida", {
        description: "Usá el formato DD/MM/AAAA.",
      })
      return
    }
    if (end < start) {
      toast.error("Rango inválido", {
        description: "La fecha hasta debe ser igual o posterior a la fecha desde.",
      })
      return
    }

    const daysCount = countWorkingDaysInRange(start, end, holidayDates)
    if (daysCount <= 0) {
      toast.error("Sin días hábiles", {
        description: "El rango no incluye días laborables.",
      })
      return
    }

    const prevStart = toDateKey(usage.start_date)
    const prevEnd = toDateKey(usage.end_date)
    if (start === prevStart && end === prevEnd) {
      cancelEdit()
      return
    }

    setSavingId(usage.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("vacation_usage")
      .update({
        start_date: start,
        end_date: end,
        days_count: daysCount,
      })
      .eq("id", usage.id)
    setSavingId(null)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Fechas actualizadas", {
      description: `${daysCount} ${daysCount === 1 ? "día hábil" : "días hábiles"}.`,
    })
    cancelEdit()
    onChanged()
  }

  const handleDelete = async (usage: VacationUsage) => {
    setDeletingId(usage.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("vacation_usage")
      .delete()
      .eq("id", usage.id)
    setDeletingId(null)

    if (error) {
      toast.error("No se pudo eliminar", { description: error.message })
      return
    }

    toast.success("Día libre eliminado")
    onChanged()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Días libres cargados</CardTitle>
        <p className="text-xs text-muted-foreground">
          Licencias, enfermedad y otros días descontados del banco. Clic en
          descripción o fechas para editar.
        </p>
      </CardHeader>
      <CardContent>
        {usages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CalendarOff className="size-8 opacity-40" />
            <p>No hay días libres registrados.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {usages.map((usage) => {
              const startKey = toDateKey(usage.start_date)
              const endKey = toDateKey(usage.end_date)
              const { days, seconds } = workingDaysSummary(
                startKey,
                endKey,
                holidayDates,
                goalPeriods,
                fallbackHours,
              )
              const descriptionLabel =
                usage.description?.trim() || "Sin descripción"
              const isEditingDescription =
                editingId === usage.id && editingField === "description"
              const isEditingDates =
                editingId === usage.id && editingField === "dates"
              const busy = savingId === usage.id || deletingId === usage.id

              const draftStart = parseDisplayDate(startDraft)
              const draftEnd = parseDisplayDate(endDraft)
              const draftSummary =
                isEditingDates && draftStart && draftEnd && draftEnd >= draftStart
                  ? workingDaysSummary(
                      draftStart,
                      draftEnd,
                      holidayDates,
                      goalPeriods,
                      fallbackHours,
                    )
                  : null
              const shownDays = draftSummary?.days ?? days
              const shownSeconds = draftSummary?.seconds ?? seconds

              return (
                <li
                  key={usage.id}
                  className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 overflow-hidden">
                    {isEditingDescription ? (
                      <Input
                        ref={descriptionInputRef}
                        value={descriptionDraft}
                        disabled={busy}
                        placeholder="Ej: Licencia por enfermedad"
                        className="h-7 text-sm"
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        onBlur={() => {
                          if (!busy) void saveDescription(usage)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void saveDescription(usage)
                          }
                          if (e.key === "Escape") {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        title={descriptionLabel}
                        disabled={busy}
                        onClick={() => startEditDescription(usage)}
                        className={cn(
                          "block w-full max-w-full truncate rounded-md text-left text-sm font-medium",
                          "hover:bg-muted/60 hover:underline hover:decoration-dotted hover:underline-offset-2",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        {descriptionLabel}
                      </button>
                    )}

                    {isEditingDates ? (
                      <div
                        className="mt-1 flex min-w-0 flex-wrap items-center gap-1"
                        onBlur={(e) => {
                          const next = e.relatedTarget as Node | null
                          if (next && e.currentTarget.contains(next)) return
                          if (!busy) void saveDates(usage)
                        }}
                      >
                        <Input
                          ref={startInputRef}
                          value={startDraft}
                          disabled={busy}
                          placeholder="DD/MM/AAAA"
                          inputMode="numeric"
                          className="h-7 w-[6.75rem] shrink-0 px-2 text-xs tabular-nums"
                          aria-label="Fecha desde"
                          onChange={(e) => setStartDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void saveDates(usage)
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          –
                        </span>
                        <Input
                          value={endDraft}
                          disabled={busy}
                          placeholder="DD/MM/AAAA"
                          inputMode="numeric"
                          className="h-7 w-[6.75rem] shrink-0 px-2 text-xs tabular-nums"
                          aria-label="Fecha hasta"
                          onChange={(e) => setEndDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void saveDates(usage)
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Editar fechas"
                        disabled={busy}
                        onClick={() => startEditDates(usage)}
                        className={cn(
                          "mt-0.5 block w-full max-w-full truncate rounded-md text-left text-xs text-muted-foreground",
                          "hover:bg-muted/60 hover:underline hover:decoration-dotted hover:underline-offset-2",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        {formatRange(usage.start_date, usage.end_date)}
                      </button>
                    )}
                  </div>

                  <span className="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground">
                    {shownDays} {shownDays === 1 ? "día" : "días"} ·{" "}
                    {formatDuration(shownSeconds)}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar"
                    disabled={busy}
                    onClick={() => handleDelete(usage)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
