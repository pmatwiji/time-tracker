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
