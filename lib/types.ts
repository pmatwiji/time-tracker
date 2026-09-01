export type WorkSession = {
  id: string
  duration_seconds: number
  note: string | null
  worked_on: string // YYYY-MM-DD (día calendario en UTC-3)
  is_holiday: boolean
  created_at: string
}

export type AppConfig = {
  id: number
  daily_hours_goal: number
  monthly_days_goal: number
  updated_at: string
}

/** Vacaciones o días libres consumidos del banco (días enteros de 4h). */
export type VacationUsage = {
  id: string
  start_date: string
  end_date: string
  description: string | null
  /** Días hábiles inclusive (lun–vie sin feriados). */
  days_count: number
  created_at: string
}
