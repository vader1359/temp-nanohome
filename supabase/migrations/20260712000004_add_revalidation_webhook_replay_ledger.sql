create table public.revalidation_webhook_events (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);

alter table public.revalidation_webhook_events enable row level security;

revoke all on public.revalidation_webhook_events from public, anon, authenticated;
grant insert on public.revalidation_webhook_events to service_role;
