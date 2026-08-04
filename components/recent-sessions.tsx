"use client"

import { useState } from "react"
import { Clock, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { WorkSession } from "@/lib/types"
import { formatDuration, fullDateLabel } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

type RecentSessionsProps = {
  sessions: WorkSession[]
  onChanged: () => void
}

export function RecentSessions({ sessions, onChanged }: RecentSessionsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const recent = sessions.slice(0, 8)

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
            {recent.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.note || "Sesión de trabajo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fullDateLabel(s.worked_on)}
                    {s.is_holiday ? " · Feriado" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-medium tabular-nums">
                    {formatDuration(s.duration_seconds)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar sesión"
                    disabled={deletingId === s.id}
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
