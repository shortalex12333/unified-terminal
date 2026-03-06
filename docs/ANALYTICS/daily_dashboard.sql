select
  day,
  dau,
  projects_started,
  projects_completed,
  completion_rate,
  downloads,
  views,
  deployments,
  user_interrupts
from public.v_daily_dashboard
order by day desc;

