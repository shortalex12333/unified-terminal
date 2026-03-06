-- Parameters:
--   $1 = start_date (YYYY-MM-DD)
--   $2 = end_date   (YYYY-MM-DD)
select
  to_char(day, 'YYYY-MM-DD') as day,
  downloads,
  opens,
  views,
  user_interrupts,
  dau,
  projects_started,
  projects_completed,
  deployments
from public.analytics_daily
where day between $1::date and $2::date
order by day desc;

