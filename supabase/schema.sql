-- Estructura de la DB para Horas (time-tracker-dashboard)
-- Ejecutá esto en: Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Configuración de objetivos (una sola fila con id = 1)
create table if not exists public.app_config (
  id integer primary key,
  daily_hours_goal numeric not null default 8,
  monthly_days_goal integer not null default 20,
  updated_at timestamptz not null default now()
);

-- Sesiones de trabajo registradas
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  duration_seconds integer not null check (duration_seconds > 0),
  note text,
  worked_on date not null,
  is_holiday boolean not null default false,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existía sin esta columna:
alter table public.work_sessions
  add column if not exists is_holiday boolean not null default false;

create index if not exists work_sessions_created_at_idx
  on public.work_sessions (created_at desc);

create index if not exists work_sessions_worked_on_idx
  on public.work_sessions (worked_on desc);

-- Vacaciones / días libres (descuentan del banco de horas extra)
create table if not exists public.vacation_usage (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  description text,
  days_count integer not null check (days_count > 0),
  created_at timestamptz not null default now()
);

create index if not exists vacation_usage_start_date_idx
  on public.vacation_usage (start_date desc);

-- Objetivo diario por fecha. Cada fila rige desde effective_from
-- hasta el día anterior al siguiente período.
create table if not exists public.daily_goal_periods (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  daily_hours numeric not null check (daily_hours > 0 and daily_hours <= 24),
  created_at timestamptz not null default now()
);

create index if not exists daily_goal_periods_effective_from_idx
  on public.daily_goal_periods (effective_from);

-- Conserva el objetivo actual para todo el historial. Un período nuevo
-- (por ejemplo 6h desde hoy) no reescribe los días anteriores.
insert into public.daily_goal_periods (effective_from, daily_hours)
select date '2000-01-01', daily_hours_goal
from public.app_config
where id = 1
on conflict (effective_from) do nothing;

-- Fila inicial de config (la app la lee con .eq("id", 1).single())
insert into public.app_config (id, daily_hours_goal, monthly_days_goal)
values (1, 8, 20)
on conflict (id) do nothing;

-- RLS: la app usa la anon key desde el browser
alter table public.app_config enable row level security;
alter table public.work_sessions enable row level security;
alter table public.vacation_usage enable row level security;
alter table public.daily_goal_periods enable row level security;

drop policy if exists "Allow all on app_config" on public.app_config;
create policy "Allow all on app_config"
  on public.app_config
  for all
  using (true)
  with check (true);

drop policy if exists "Allow all on work_sessions" on public.work_sessions;
create policy "Allow all on work_sessions"
  on public.work_sessions
  for all
  using (true)
  with check (true);

drop policy if exists "Allow all on vacation_usage" on public.vacation_usage;
create policy "Allow all on vacation_usage"
  on public.vacation_usage
  for all
  using (true)
  with check (true);

drop policy if exists "Allow all on daily_goal_periods" on public.daily_goal_periods;
create policy "Allow all on daily_goal_periods"
  on public.daily_goal_periods
  for all
  using (true)
  with check (true);
