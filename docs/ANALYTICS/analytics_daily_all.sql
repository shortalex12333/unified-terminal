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
order by day desc;

