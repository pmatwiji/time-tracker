-- Backfill: 4h reglamentarias en días hábiles sin registro
-- Desde 10/07/2026 hasta ayer (America/Argentina/Buenos_Aires)
-- Saltea sábados, domingos y días que ya tengan horas.
--
-- Ejecutar en: Supabase → SQL Editor → Run

with bounds as (
  select
    date '2026-07-10' as start_date,
    (timezone('America/Argentina/Buenos_Aires', now()))::date - 1 as end_date
),
days as (
  select d::date as worked_on
  from bounds,
       generate_series(start_date, end_date, interval '1 day') as d
  where extract(isodow from d) between 1 and 5 -- lun..vie
),
missing as (
  select days.worked_on
  from days
  left join (
    select worked_on, sum(duration_seconds) as total
    from public.work_sessions
    where worked_on >= date '2026-07-10'
    group by worked_on
  ) s on s.worked_on = days.worked_on
  where coalesce(s.total, 0) = 0
)
insert into public.work_sessions (
  duration_seconds,
  note,
  worked_on,
  is_holiday
)
select
  14400,
  'Carga automática (4h reglamentarias)',
  worked_on,
  false
from missing
order by worked_on;

-- Vista previa (opcional): comentá el INSERT de arriba y descomentá esto
-- select * from missing order by worked_on;
