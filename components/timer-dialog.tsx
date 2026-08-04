"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Save, RotateCcw, Timer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { formatClock, todayKey } from "@/lib/format"
import { toast } from "sonner"

type TimerDialogProps = {
  onSaved: () => void
}

export function TimerDialog({ onSaved }: TimerDialogProps) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [note, setNote] = useState("")
  const [isHoliday, setIsHoliday] = useState(false)
  const [saving, setSaving] = useState(false)

  // Accumulated ms from previous run segments + timestamp of current segment start
  const accumulatedRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const tick = () => {
    if (startRef.current != null) {
      setElapsedMs(accumulatedRef.current + (Date.now() - startRef.current))
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (running) {
      startRef.current = Date.now()
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const handleStartPause = () => {
    if (running) {
      // Pausing: bank the elapsed time
      if (startRef.current != null) {
        accumulatedRef.current += Date.now() - startRef.current
        startRef.current = null
      }
      setRunning(false)
    } else {
      setRunning(true)
    }
  }

  const resetTimer = () => {
    accumulatedRef.current = 0
    startRef.current = null
    setElapsedMs(0)
    setRunning(false)
    setNote("")
    setIsHoliday(false)
  }

  const totalSeconds = Math.floor(elapsedMs / 1000)

  const handleSave = async () => {
    if (totalSeconds <= 0) {
      toast.error("El cronómetro está en cero", {
        description: "Registrá al menos un segundo antes de guardar.",
      })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("work_sessions").insert({
      duration_seconds: totalSeconds,
      note: note.trim() || null,
      worked_on: todayKey(),
      is_holiday: isHoliday,
    })
    setSaving(false)

    if (error) {
      toast.error("No se pudo guardar", { description: error.message })
      return
    }

    toast.success("Sesión guardada", {
      description: `${formatClock(totalSeconds)} agregado a tu registro.`,
    })
    resetTimer()
    setOpen(false)
    onSaved()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="lg" className="gap-2">
            <Timer className="size-5" />
            Iniciar cronómetro
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cronómetro</DialogTitle>
          <DialogDescription>
            Registra el tiempo trabajado. Podés pausar y reanudar cuando quieras.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div
            className="flex items-baseline gap-1 font-mono text-5xl font-semibold tracking-tight tabular-nums"
            aria-live="off"
          >
            {formatClock(totalSeconds)}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2 rounded-full ${
                running ? "animate-pulse bg-primary" : "bg-muted-foreground/50"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {running
                ? "En marcha"
                : totalSeconds > 0
                  ? "En pausa"
                  : "Listo para empezar"}
            </span>
          </div>

          <div className="flex w-full items-center justify-center gap-3">
            <Button
              onClick={handleStartPause}
              size="lg"
              className="min-w-32 gap-2"
              variant={running ? "secondary" : "default"}
            >
              {running ? (
                <>
                  <Pause className="size-5" /> Pausar
                </>
              ) : (
                <>
                  <Play className="size-5" /> {totalSeconds > 0 ? "Reanudar" : "Iniciar"}
                </>
              )}
            </Button>
            <Button
              onClick={resetTimer}
              size="lg"
              variant="outline"
              className="gap-2"
              disabled={totalSeconds === 0 && !running}
            >
              <RotateCcw className="size-4" />
              Reiniciar
            </Button>
          </div>

          <div className="w-full space-y-2">
            <Label htmlFor="session-note">Nota (opcional)</Label>
            <Input
              id="session-note"
              placeholder="¿En qué trabajaste?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Label
            htmlFor="session-holiday"
            className="w-full cursor-pointer font-normal text-muted-foreground"
          >
            <input
              id="session-holiday"
              type="checkbox"
              checked={isHoliday}
              onChange={(e) => setIsHoliday(e.target.checked)}
              className="size-4 accent-primary"
            />
            ¿Es feriado?
          </Label>

          <Button
            onClick={handleSave}
            size="lg"
            className="w-full gap-2"
            disabled={saving || totalSeconds <= 0}
          >
            <Save className="size-5" />
            {saving ? "Guardando..." : "Guardar sesión"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
