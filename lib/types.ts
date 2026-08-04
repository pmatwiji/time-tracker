export type WorkSession = {
  id: string
  duration_seconds: number
  note: string | null
  worked_on: string // YYYY-MM-DD
  created_at: string
}

export type AppConfig = {
  id: number
  daily_hours_goal: number
  monthly_days_goal: number
  updated_at: string
}
