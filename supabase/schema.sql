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
  created_at timestamptz not null default now()
);

create index if not exists work_sessions_created_at_idx
  on public.work_sessions (created_at desc);

create index if not exists work_sessions_worked_on_idx
  on public.work_sessions (worked_on desc);

-- Fila inicial de config (la app la lee con .eq("id", 1).single())
insert into public.app_config (id, daily_hours_goal, monthly_days_goal)
values (1, 8, 20)
on conflict (id) do nothing;

-- RLS: la app usa la anon key desde el browser
alter table public.app_config enable row level security;
alter table public.work_sessions enable row level security;

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
