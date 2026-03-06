-- Unified query (hard-coded date range: today → +99 years)
select
  to_char(d.day, 'YYYY-MM-DD') as day,
  d.dau,
  d.projects_started,
  d.projects_completed,
  d.completion_rate,
  ad.opens,
  d.downloads,
  d.views,
  d.deployments,
  d.user_interrupts
from public.v_daily_dashboard d
left join public.analytics_daily ad on ad.day = d.day
where d.day between current_date and (current_date + interval '99 years')::date
order by d.day desc;
