"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, CalendarPlus, Save } from "lucide-react"
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
  formatDateDisplay,
  formatDuration,
  parseDisplayDate,
  REGULATORY_DAILY_HOURS,
  todayKey,
} from "@/lib/format"
import { toast } from "sonner"

type ManualEntryDialogProps = {
  onSaved: () => void
  holidayDates?: Set<string>
}

function todayDisplay(): string {
  return formatDateDisplay(todayKey())
}

export function ManualEntryDialog({
  onSaved,
  holidayDates,
}: ManualEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [dateInput, setDateInput] = useState(todayDisplay)
  const [hours, setHours] = useState(String(REGULATORY_DAILY_HOURS))
  const [minutes, setMinutes] = useState("0")
  const [note, setNote] = useState("")
  const [isHoliday, setIsHoliday] = useState(false)
  const [saving, setSaving] = useState(false)
  const datePickerRef = useRef<HTMLInputElement>(null)

  const today = todayKey()
  const pickerValue = parseDisplayDate(dateInput) ?? today

  const holidayForDate = (key: string | null) =>
    Boolean(key && holidayDates?.has(key))

  const resetForm = () => {
    const display = todayDisplay()
    setDateInput(display)
    setHours(String(REGULATORY_DAILY_HOURS))
    setMinutes("0")
    setNote("")
    setIsHoliday(holidayForDate(today))
  }

  useEffect(() => {
    if (!open) return
    const key = parseDisplayDate(dateInput)
    setIsHoliday(holidayForDate(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateInput, holidayDates, open])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) resetForm()
  }

  const openCalendar = () => {
    const input = datePickerRef.current
    if (!input) return
    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      input.click()
    }
  }

  const handlePickerChange = (value: string) => {
    if (!value) return
    if (value > today) {
      toast.error("Fecha inválida", {
        description: "No podés cargar horas de un día futuro.",
      })
      return
    }
    setDateInput(formatDateDisplay(value))
  }

  const handleSave = async () => {
    const workedOn = parseDisplayDate(dateInput)
    const h = Number(hours)
    const m = Number(minutes)

    if (!workedOn) {
      toast.error("Fecha inválida", {
        description: "Usá el formato DD/MM/AAAA o el calendario.",
      })
      return
    }
    if (workedOn > today) {
      toast.error("Fecha inválida", {
        description: "No podés cargar horas de un día futuro.",
      })
      return
    }
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      toast.error("Horas inválidas", {
        description: "Ingresá un valor entre 0 y 24.",
      })
      return
    }
    if (!Number.isFinite(m) || m < 0 || m > 59) {
      toast.error("Minutos inválidos", {
        description: "Ingresá un valor entre 0 y 59.",
      })
      return
    }

    const durationSeconds = Math.round(h * 3600 + m * 60)
    if (durationSeconds <= 0) {
      toast.error("Duración en cero", {
        description: "Registrá al menos 1 minuto.",
      })
      return
    }
    if (durationSeconds > 24 * 3600) {
      toast.error("Duración inválida", {
        description: "El máximo por sesión es 24 horas.",
      })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("work_sessions").insert({
      duration_seconds: durationSeconds,
      note: note.trim() || null,
      worked_on: workedOn,
      is_holiday: isHoliday,
    })
    setSaving(false)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Horas cargadas", {
      description: `${formatDuration(durationSeconds)} registrados para ${formatDateDisplay(workedOn)}.`,
    })
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="gap-2">
            <CalendarPlus className="size-5" />
            Cargar horas
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar horas</DialogTitle>
          <DialogDescription>
            Registrá tiempo de días anteriores o de hoy sin usar el cronómetro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="manual-date">Fecha (DD/MM/AAAA)</Label>
            <div className="flex gap-2">
              <Input
                id="manual-date"
                type="text"
                inputMode="numeric"
                placeholder="03/08/2026"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
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
                ref={datePickerRef}
                type="date"
                max={today}
                value={pickerValue}
                onChange={(e) => handlePickerChange(e.target.value)}
                tabIndex={-1}
                aria-hidden
                className="sr-only"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="manual-hours">Horas</Label>
              <Input
                id="manual-hours"
                type="number"
                min={0}
                max={24}
                step={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-minutes">Minutos</Label>
              <Input
                id="manual-minutes"
                type="number"
                min={0}
                max={59}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-note">Nota (opcional)</Label>
            <Input
              id="manual-note"
              placeholder="¿En qué trabajaste?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Label
            htmlFor="manual-holiday"
            className="cursor-pointer font-normal text-muted-foreground"
          >
            <input
              id="manual-holiday"
              type="checkbox"
              checked={isHoliday}
              onChange={(e) => setIsHoliday(e.target.checked)}
              className="size-4 accent-primary"
            />
            ¿Es feriado?
          </Label>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="size-4" />
            {saving ? "Guardando..." : "Guardar horas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
