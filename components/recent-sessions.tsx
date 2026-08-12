"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WorkSession } from "@/lib/types"
import { formatDuration, fullDateLabel, toDateKey } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type RecentSessionsProps = {
  sessions: WorkSession[]
  onChanged: () => void
}

type EditingField = "note" | "duration" | null

/** Duración siempre en formato fijo para alinear la columna. */
function formatDurationColumn(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

export function RecentSessions({ sessions, onChanged }: RecentSessionsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [hoursDraft, setHoursDraft] = useState("0")
  const [minutesDraft, setMinutesDraft] = useState("0")
  const noteInputRef = useRef<HTMLInputElement>(null)
  const hoursInputRef = useRef<HTMLInputElement>(null)

  const recent = sessions.slice(0, 8)

  useEffect(() => {
    if (editingField === "note") noteInputRef.current?.focus()
    if (editingField === "duration") hoursInputRef.current?.focus()
  }, [editingField, editingId])

  const startEditNote = (s: WorkSession) => {
    setEditingId(s.id)
    setEditingField("note")
    setNoteDraft(s.note ?? "")
  }

  const startEditDuration = (s: WorkSession) => {
    const hours = Math.floor(s.duration_seconds / 3600)
    const minutes = Math.floor((s.duration_seconds % 3600) / 60)
    setEditingId(s.id)
    setEditingField("duration")
    setHoursDraft(String(hours))
    setMinutesDraft(String(minutes))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingField(null)
  }

  const saveNote = async (s: WorkSession) => {
    const nextNote = noteDraft.trim() || null
    const prevNote = s.note?.trim() || null
    if (nextNote === prevNote) {
      cancelEdit()
      return
    }

    setSavingId(s.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("work_sessions")
      .update({ note: nextNote })
      .eq("id", s.id)
    setSavingId(null)

    if (error) {
      toast.error("No se pudo guardar la nota", { description: error.message })
      return
    }

    toast.success("Nota actualizada")
    cancelEdit()
    onChanged()
  }

  const saveDuration = async (s: WorkSession) => {
    const hours = Number(hoursDraft)
    const minutes = Number(minutesDraft)

    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      toast.error("Horas inválidas", { description: "Usá un valor entre 0 y 24." })
      return
    }
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
      toast.error("Minutos inválidos", {
        description: "Usá un valor entre 0 y 59.",
      })
      return
    }

    const durationSeconds = Math.round(hours * 3600 + minutes * 60)
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
    if (durationSeconds === s.duration_seconds) {
      cancelEdit()
      return
    }

    setSavingId(s.id)
    const supabase = createClient()
    const { error } = await supabase
      .from("work_sessions")
      .update({ duration_seconds: durationSeconds })
      .eq("id", s.id)
    setSavingId(null)

    if (error) {
      toast.error("No se pudo guardar el tiempo", {
        description: error.message,
      })
      return
    }

    toast.success("Tiempo actualizado", {
      description: formatDuration(durationSeconds),
    })
    cancelEdit()
    onChanged()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from("work_sessions").delete().eq("id", id)
    setDeletingId(null)
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message })
      return
    }
    toast.success("Sesión eliminada")
    onChanged()
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sesiones recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Clock className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Todavía no registraste ninguna sesión.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((s) => {
              const noteLabel = s.note?.trim() || "Sesión de trabajo"
              const isEditingNote =
                editingId === s.id && editingField === "note"
              const isEditingDuration =
                editingId === s.id && editingField === "duration"
              const busy = savingId === s.id || deletingId === s.id

              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_8.75rem_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 overflow-hidden">
                    {isEditingNote ? (
                      <Input
                        ref={noteInputRef}
                        value={noteDraft}
                        disabled={busy}
                        placeholder="¿En qué trabajaste?"
                        className="h-7 text-sm"
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={() => {
                          if (!busy) void saveNote(s)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void saveNote(s)
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
                        title={noteLabel}
                        disabled={busy}
                        onClick={() => startEditNote(s)}
                        className={cn(
                          "block w-full max-w-full truncate rounded-md text-left text-sm font-medium",
                          "hover:bg-muted/60 hover:underline hover:decoration-dotted hover:underline-offset-2",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        {noteLabel}
                      </button>
                    )}
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {fullDateLabel(toDateKey(s.worked_on))}
                      {s.is_holiday ? " · Feriado" : ""}
                    </p>
                  </div>

                  <div className="flex min-w-0 justify-end overflow-hidden">
                    {isEditingDuration ? (
                      <div
                        className="flex shrink-0 items-center gap-0.5"
                        onBlur={(e) => {
                          const next = e.relatedTarget as Node | null
                          if (next && e.currentTarget.contains(next)) return
                          if (!busy) void saveDuration(s)
                        }}
                      >
                        <Input
                          ref={hoursInputRef}
                          type="number"
                          min={0}
                          max={24}
                          value={hoursDraft}
                          disabled={busy}
                          className="h-7 w-11 shrink-0 appearance-none px-1 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label="Horas"
                          onChange={(e) => setHoursDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void saveDuration(s)
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          h
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={minutesDraft}
                          disabled={busy}
                          className="h-7 w-11 shrink-0 appearance-none px-1 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label="Minutos"
                          onChange={(e) => setMinutesDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void saveDuration(s)
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          m
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Editar duración"
                        disabled={busy}
                        onClick={() => startEditDuration(s)}
                        className={cn(
                          "w-full whitespace-nowrap rounded-md px-1 py-0.5 text-right font-mono text-sm font-medium tabular-nums",
                          "hover:bg-muted/60 hover:underline hover:decoration-dotted hover:underline-offset-2",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        {formatDurationColumn(s.duration_seconds)}
                      </button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar sesión"
                    disabled={busy}
                    onClick={() => handleDelete(s.id)}
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
