create table public.customer_personalization_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  use_amis_history boolean not null default false,
  use_behavior_history boolean not null default false,
  policy_version text not null default 'plan03-disabled-v1',
  updated_at timestamptz not null default now(),
  check (policy_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$')
);

alter table public.customer_personalization_settings enable row level security;

create policy "personalization settings deny browser" on public.customer_personalization_settings
  for all to anon, authenticated using (false) with check (false);

revoke all on public.customer_personalization_settings from anon, authenticated;
grant all on public.customer_personalization_settings to service_role;

comment on table public.customer_personalization_settings is 'Plan 03 service-only opt-in gates; all behavior and AMIS history remain disabled by default.';
