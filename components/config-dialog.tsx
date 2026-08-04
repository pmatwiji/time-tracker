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
import type { AppConfig } from "@/lib/types"
import { toast } from "sonner"

type ConfigDialogProps = {
  config: AppConfig
  onSaved: () => void
}

export function ConfigDialog({ config, onSaved }: ConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [dailyHours, setDailyHours] = useState(String(config.daily_hours_goal))
  const [monthlyDays, setMonthlyDays] = useState(
    String(config.monthly_days_goal),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDailyHours(String(config.daily_hours_goal))
      setMonthlyDays(String(config.monthly_days_goal))
    }
  }, [open, config])

  const handleSave = async () => {
    const daily = Number(dailyHours)
    const monthly = Number(monthlyDays)

    if (!Number.isFinite(daily) || daily <= 0 || daily > 24) {
      toast.error("Horas por día inválidas", {
        description: "Ingresá un valor entre 1 y 24.",
      })
      return
    }
    if (!Number.isFinite(monthly) || monthly <= 0 || monthly > 31) {
      toast.error("Días por mes inválidos", {
        description: "Ingresá un valor entre 1 y 31.",
      })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("app_config")
      .update({
        daily_hours_goal: daily,
        monthly_days_goal: monthly,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
    setSaving(false)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Objetivos actualizados")
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
            Definí cuánto querés trabajar para medir tu progreso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="daily-hours">Horas objetivo por día</Label>
            <Input
              id="daily-hours"
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cuántas horas planeás trabajar cada día laboral.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-days">Días a trabajar por mes</Label>
            <Input
              id="monthly-days"
              type="number"
              min={1}
              max={31}
              step={1}
              value={monthlyDays}
              onChange={(e) => setMonthlyDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cantidad de días laborales esperados en el mes.
            </p>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar objetivos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
