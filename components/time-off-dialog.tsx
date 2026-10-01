"use client"

import { useMemo, useRef, useState } from "react"
import { CalendarDays, Palmtree, Save } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import {
  addDaysToKey,
  countWorkingDaysInRange,
  formatDateDisplay,
  formatDuration,
  formatVacationDayUnits,
  isWeekendKey,
  parseDisplayDate,
  todayKey,
} from "@/lib/format"
import { goalHoursOnDate, sumGoalSecondsOnWorkingDays } from "@/lib/goals"
import type { DailyGoalPeriod } from "@/lib/types"
import { toast } from "sonner"

type TimeOffDialogProps = {
  onSaved: () => void
  /** Saldo neto en días libres. */
  availableDayUnits?: number
  goalPeriods?: DailyGoalPeriod[]
  fallbackHours?: number
  holidayDates?: Set<string>
}

function todayDisplay(): string {
  return formatDateDisplay(todayKey())
}

type DateFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

function DateField({ id, label, value, onChange }: DateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const pickerValue = parseDisplayDate(value) ?? todayKey()

  const openCalendar = () => {
    const input = pickerRef.current
    if (!input) return
    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      input.click()
    }
  }

  const handlePickerChange = (next: string) => {
    if (!next) return
    onChange(formatDateDisplay(next))
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="03/08/2026"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Abrir calendario"
          onClick={openCalendar}
        >
          <CalendarDays className="size-5" />
        </Button>
        <input
          ref={pickerRef}
          type="date"
          value={pickerValue}
          onChange={(e) => handlePickerChange(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
      </div>
    </div>
  )
}

export function TimeOffDialog({
  onSaved,
  availableDayUnits = 0,
  goalPeriods = [],
  fallbackHours = 4,
  holidayDates,
}: TimeOffDialogProps) {
  const [open, setOpen] = useState(false)
  const [startInput, setStartInput] = useState(todayDisplay)
  const [endInput, setEndInput] = useState(todayDisplay)
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => {
    const start = parseDisplayDate(startInput)
    const end = parseDisplayDate(endInput)
    if (!start || !end || end < start) return null
    const days = countWorkingDaysInRange(start, end, holidayDates)
    const seconds = sumGoalSecondsOnWorkingDays(
      start,
      end,
      holidayDates ?? new Set(),
      goalPeriods,
      fallbackHours,
    )
    const goals = new Set<number>()
    for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
      if (isWeekendKey(key) || holidayDates?.has(key)) continue
      goals.add(goalHoursOnDate(key, goalPeriods, fallbackHours))
    }
    return {
      start,
      end,
      days,
      seconds,
      uniformHours: goals.size === 1 ? [...goals][0] : null,
    }
  }, [startInput, endInput, holidayDates, goalPeriods, fallbackHours])

  const resetForm = () => {
    const display = todayDisplay()
    setStartInput(display)
    setEndInput(display)
    setDescription("")
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) resetForm()
  }

  const handleSave = async () => {
    const start = parseDisplayDate(startInput)
    const end = parseDisplayDate(endInput)

    if (!start || !end) {
      toast.error("Fecha inválida", {
        description: "Usá el formato DD/MM/AAAA o el calendario.",
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
        description:
          "El rango no incluye días laborables (lun–vie sin feriados).",
      })
      return
    }

    const usedSeconds = sumGoalSecondsOnWorkingDays(
      start,
      end,
      holidayDates ?? new Set(),
      goalPeriods,
      fallbackHours,
    )

    if (daysCount > availableDayUnits && availableDayUnits > 0) {
      toast.warning("Saldo insuficiente", {
        description: `Tenés ${formatVacationDayUnits(availableDayUnits, fallbackHours * 3600)} y querés usar ${daysCount} ${daysCount === 1 ? "día" : "días"}.`,
      })
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("vacation_usage").insert({
      start_date: start,
      end_date: end,
      description: description.trim() || null,
      days_count: daysCount,
    })
    setSaving(false)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Días libres registrados", {
      description: `${daysCount} ${daysCount === 1 ? "día" : "días"} (${formatDuration(usedSeconds)}) descontados del banco.`,
    })
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="gap-2">
            <Palmtree className="size-5" />
            Cargar días libres
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar días libres</DialogTitle>
          <DialogDescription>
            Solo cuentan los días hábiles (lun–vie, sin feriados). Cada uno
            descuenta un día entero, con el objetivo vigente en esa fecha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <DateField
            id="timeoff-start"
            label="Fecha desde (DD/MM/AAAA)"
            value={startInput}
            onChange={setStartInput}
          />
          <DateField
            id="timeoff-end"
            label="Fecha hasta (DD/MM/AAAA)"
            value={endInput}
            onChange={setEndInput}
          />

          <div className="space-y-2">
            <Label htmlFor="timeoff-description">Descripción</Label>
            <Input
              id="timeoff-description"
              placeholder="Ej: Licencia por enfermedad"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {preview ? (
            preview.days > 0 ? (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Se descontarán{" "}
                <span className="font-medium text-foreground">
                  {preview.days} {preview.days === 1 ? "día hábil" : "días hábiles"}
                </span>{" "}
                ({formatDuration(preview.seconds)}
                {preview.uniformHours != null
                  ? ` = ${preview.days} × ${preview.uniformHours}h`
                  : ""}
                ). Fines de semana y feriados no cuentan.
              </p>
            ) : (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                No hay días hábiles en este rango (solo fines de semana o
                feriados).
              </p>
            )
          ) : (
            <p className="text-sm text-destructive">
              Revisá las fechas: el rango debe ser válido.
            </p>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleSave}
            disabled={saving || !preview || preview.days <= 0}
            className="gap-2"
          >
            <Save className="size-4" />
            {saving ? "Guardando..." : "Registrar días libres"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
