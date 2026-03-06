with calendar as (
  select generate_series((current_date - interval '1 day')::date, current_date, interval '1 day')::date as day
),
ad as (
  select day, downloads, opens, views, user_interrupts, dau, projects_started, projects_completed, deployments
  from public.analytics_daily
),
durations as (
  select
    date(completed_at) as day,
    avg(extract(epoch from (completed_at - created_at)) / 60.0) as avg_build_duration_minutes
  from public.projects
  where completed_at is not null and created_at is not null
  group by 1
)
select
  to_char(c.day, 'YYYY-MM-DD') as day,
  coalesce(ad.downloads, 0) as downloads,
  coalesce(ad.opens, 0) as opens,
  coalesce(ad.views, 0) as views,
  coalesce(ad.dau, 0) as dau,
  coalesce(ad.projects_started, 0) as projects_started,
  coalesce(ad.projects_completed, 0) as projects_completed,
  coalesce(ad.deployments, 0) as deployments,
  coalesce(ad.user_interrupts, 0) as user_interrupts,
  case when coalesce(ad.projects_started, 0) = 0 then null else ad.projects_completed::numeric / ad.projects_started end as completion_rate,
  case when coalesce(ad.projects_completed, 0) = 0 then null else ad.downloads::numeric / ad.projects_completed end as artifact_export_rate,
  case when coalesce(ad.projects_completed, 0) = 0 then null else ad.deployments::numeric / ad.projects_completed end as deployment_rate,
  case when coalesce(ad.projects_started, 0) = 0 then null else ad.user_interrupts::numeric / ad.projects_started end as interrupt_rate,
  d.avg_build_duration_minutes
from calendar c
left join ad on ad.day = c.day
left join durations d on d.day = c.day
order by c.day desc;

