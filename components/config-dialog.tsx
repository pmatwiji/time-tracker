"use client"

import { useEffect, useState } from "react"
import { Settings } from "lucide-react"
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
import type { AppConfig, DailyGoalPeriod } from "@/lib/types"
import {
  formatDateDisplay,
  parseDisplayDate,
  todayKey,
  toDateKey,
} from "@/lib/format"
import { goalHoursOnDate } from "@/lib/goals"
import { toast } from "sonner"

type ConfigDialogProps = {
  config: AppConfig
  goalPeriods: DailyGoalPeriod[]
  onSaved: () => void
}

const BASELINE_DATE = "2000-01-01"

function isMissingGoalTable(error: { code?: string; message?: string }) {
  const code = error.code ?? ""
  const message = error.message ?? ""
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("daily_goal_periods")
  )
}

export function ConfigDialog({
  config,
  goalPeriods,
  onSaved,
}: ConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [dailyHours, setDailyHours] = useState(String(config.daily_hours_goal))
  const [effectiveInput, setEffectiveInput] = useState(
    formatDateDisplay(todayKey()),
  )
  const [saving, setSaving] = useState(false)

  const todayGoal = goalHoursOnDate(
    todayKey(),
    goalPeriods,
    Number(config.daily_hours_goal),
  )

  useEffect(() => {
    if (!open) return
    setDailyHours(String(todayGoal))
    setEffectiveInput(formatDateDisplay(todayKey()))
  }, [open, todayGoal])

  const history = [...goalPeriods].sort((a, b) =>
    toDateKey(a.effective_from) < toDateKey(b.effective_from) ? 1 : -1,
  )

  const handleSave = async () => {
    const daily = Number(dailyHours)
    const effectiveFrom = parseDisplayDate(effectiveInput)

    if (!Number.isFinite(daily) || daily <= 0 || daily > 24) {
      toast.error("Horas por día inválidas", {
        description: "Ingresá un valor entre 1 y 24.",
      })
      return
    }
    if (!effectiveFrom) {
      toast.error("Fecha inválida", {
        description: "Usá el formato DD/MM/AAAA.",
      })
      return
    }

    setSaving(true)
    const supabase = createClient()

    if (
      goalPeriods.length === 0 &&
      effectiveFrom !== BASELINE_DATE
    ) {
      const baseline = await supabase.from("daily_goal_periods").insert({
        effective_from: BASELINE_DATE,
        daily_hours: Number(config.daily_hours_goal),
      })
      if (baseline.error && !isMissingGoalTable(baseline.error)) {
        const duplicate = baseline.error.code === "23505"
        if (!duplicate) {
          setSaving(false)
          toast.error("No se pudo guardar el objetivo anterior", {
            description: baseline.error.message,
          })
          return
        }
      }
      if (baseline.error && isMissingGoalTable(baseline.error)) {
        setSaving(false)
        toast.error("Falta crear la tabla de objetivos", {
          description:
            "Ejecutá en Supabase el SQL de daily_goal_periods (supabase/schema.sql).",
        })
        return
      }
    }

    const saved = await supabase.from("daily_goal_periods").upsert(
      {
        effective_from: effectiveFrom,
        daily_hours: daily,
      },
      { onConflict: "effective_from" },
    )
    if (saved.error) {
      setSaving(false)
      toast.error(
        isMissingGoalTable(saved.error)
          ? "Falta crear la tabla de objetivos"
          : "No se pudo guardar",
        {
          description: isMissingGoalTable(saved.error)
            ? "Ejecutá en Supabase el SQL de daily_goal_periods (supabase/schema.sql)."
            : saved.error.message,
        },
      )
      return
    }

    const nextPeriods: DailyGoalPeriod[] = [
      ...goalPeriods.filter(
        (period) => toDateKey(period.effective_from) !== effectiveFrom,
      ),
      {
        id: "pending",
        effective_from: effectiveFrom,
        daily_hours: daily,
        created_at: new Date().toISOString(),
      },
    ]
    if (
      goalPeriods.length === 0 &&
      effectiveFrom !== BASELINE_DATE
    ) {
      nextPeriods.push({
        id: "baseline",
        effective_from: BASELINE_DATE,
        daily_hours: Number(config.daily_hours_goal),
        created_at: new Date().toISOString(),
      })
    }

    const currentHours = goalHoursOnDate(
      todayKey(),
      nextPeriods,
      daily,
    )
    const configUpdate = await supabase
      .from("app_config")
      .update({
        daily_hours_goal: currentHours,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
    setSaving(false)

    if (configUpdate.error) {
      toast.error("El período se guardó, pero no la config actual", {
        description: configUpdate.error.message,
      })
      onSaved()
      return
    }

    toast.success("Objetivo actualizado", {
      description: `Desde ${formatDateDisplay(effectiveFrom)} el objetivo es ${daily}h. Los días anteriores no cambian.`,
    })
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="gap-2">
            <Settings className="size-5" />
            Objetivos
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuración de objetivos</DialogTitle>
          <DialogDescription>
            El objetivo nuevo rige desde la fecha que elijas. Las horas ya
            cargadas se siguen comparando con el objetivo de ese día.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="daily-hours">Horas objetivo por día laboral</Label>
            <Input
              id="daily-hours"
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-from">Vigente desde (DD/MM/AAAA)</Label>
            <Input
              id="goal-from"
              inputMode="numeric"
              placeholder="01/10/2026"
              value={effectiveInput}
              onChange={(e) => setEffectiveInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Hoy el objetivo es {todayGoal}h. Un día de 4h anterior sigue
              contando como día completo de 4h.
            </p>
          </div>

          {history.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Historial</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {history.map((period) => {
                  const from = toDateKey(period.effective_from)
                  const label =
                    from === BASELINE_DATE
                      ? "Días anteriores"
                      : `Desde ${formatDateDisplay(from)}`
                  return (
                    <li key={period.id}>
                      {label} · {Number(period.daily_hours)}h
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todavía no hay historial: {Number(config.daily_hours_goal)}h
              aplica a todos los días. Al guardar, ese valor queda para las
              fechas anteriores.
            </p>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar objetivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
