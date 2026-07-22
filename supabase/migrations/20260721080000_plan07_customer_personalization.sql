create table public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  consent_ledger_id bigint references public.customer_consent_ledger(id) on delete set null,
  feature_type text not null,
  feature_key text not null,
  feature_value text not null,
  source text not null,
  confidence numeric(4, 3),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  deleted_at timestamp with time zone,
  check (feature_type in ('room_id', 'category_id', 'brand_id', 'designer_id', 'collection_id', 'style_tag', 'material_tag', 'palette_tag', 'price_band', 'contact_price_acceptable', 'service_channel', 'exclusion')),
  check (feature_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (feature_value ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (source in ('customer_explicit', 'staff_approved', 'import', 'system_default')),
  check (confidence is null or confidence between 0 and 1),
  check (updated_at >= created_at),
  check (expires_at is null or expires_at >= created_at),
  check (deleted_at is null or deleted_at >= created_at)
);

create unique index customer_preferences_active_unique
  on public.customer_preferences(visitor_id, feature_type, feature_key, feature_value)
  where deleted_at is null;

create index customer_preferences_active_visitor_idx
  on public.customer_preferences(visitor_id, updated_at desc)
  where deleted_at is null;

create table public.customer_recent_entities (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  interaction_count integer not null default 1,
  first_interacted_at timestamp with time zone not null default now(),
  last_interacted_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  check (entity_type in ('product', 'variant', 'category', 'brand')),
  check (interaction_count between 1 and 100),
  check (last_interacted_at >= first_interacted_at),
  check (expires_at >= last_interacted_at),
  check (deleted_at is null or deleted_at >= first_interacted_at),
  unique (visitor_id, entity_type, entity_id)
);

create index customer_recent_entities_active_visitor_idx
  on public.customer_recent_entities(visitor_id, last_interacted_at desc)
  where deleted_at is null;

create table public.customer_affinities (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  consent_ledger_id bigint references public.customer_consent_ledger(id) on delete set null,
  feature_type text not null,
  feature_key text not null,
  score numeric(7, 6) not null,
  support_count integer not null,
  distinct_session_count integer not null,
  algorithm_version text not null,
  window_started_at timestamp with time zone not null,
  last_evidence_at timestamp with time zone not null,
  decayed_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  suppressed_at timestamp with time zone,
  deleted_at timestamp with time zone,
  check (feature_type in ('category_id', 'room_id', 'brand_id', 'designer_id', 'style_tag', 'material_tag', 'palette_tag', 'price_band')),
  check (feature_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (score between 0 and 1),
  check (support_count between 1 and 1000000),
  check (distinct_session_count between 1 and support_count),
  check (algorithm_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  check (last_evidence_at >= window_started_at),
  check (decayed_at >= last_evidence_at),
  check (updated_at >= window_started_at),
  check (expires_at is null or expires_at >= last_evidence_at),
  check (suppressed_at is null or suppressed_at >= window_started_at),
  check (deleted_at is null or deleted_at >= window_started_at)
);

create unique index customer_affinities_active_unique
  on public.customer_affinities(visitor_id, feature_type, feature_key, algorithm_version)
  where deleted_at is null;

create index customer_affinities_active_visitor_idx
  on public.customer_affinities(visitor_id, score desc, updated_at desc)
  where deleted_at is null and suppressed_at is null;

create table public.personalization_decisions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  consent_ledger_id bigint references public.customer_consent_ledger(id) on delete set null,
  placement text not null,
  context_version text not null,
  algorithm_version text not null,
  strategy_key text not null,
  selected_module_key text,
  explanation_key text,
  fallback_tier text not null,
  decided_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  check (placement in ('homepage', 'pdp', 'catalog', 'search', 'chat', 'cart', 'checkout')),
  check (context_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  check (algorithm_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  check (strategy_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (selected_module_key is null or selected_module_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (explanation_key is null or explanation_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  check (fallback_tier in ('curated', 'session', 'explicit', 'customer_memory', 'hybrid')),
  check (expires_at is null or expires_at >= decided_at),
  check (deleted_at is null or deleted_at >= decided_at)
);

create index personalization_decisions_active_visitor_idx
  on public.personalization_decisions(visitor_id, decided_at desc)
  where deleted_at is null;

create unique index personalization_decisions_active_unique
  on public.personalization_decisions(visitor_id, placement, context_version, algorithm_version, strategy_key)
  where deleted_at is null;

create or replace function public.plan07_reclaim_expired_preference()
returns trigger
language plpgsql
as $$
begin
  update public.customer_preferences
  set deleted_at = now(), updated_at = now()
  where visitor_id = new.visitor_id
    and feature_type = new.feature_type
    and feature_key = new.feature_key
    and feature_value = new.feature_value
    and deleted_at is null
    and expires_at is not null
    and expires_at <= now();
  return new;
end;
$$;

create trigger customer_preferences_reclaim_expired
before insert on public.customer_preferences
for each row execute function public.plan07_reclaim_expired_preference();

create or replace function public.plan07_reclaim_expired_recent_entity()
returns trigger
language plpgsql
as $$
begin
  update public.customer_recent_entities
  set deleted_at = now()
  where visitor_id = new.visitor_id
    and entity_type = new.entity_type
    and entity_id = new.entity_id
    and deleted_at is null
    and expires_at <= now();
  return new;
end;
$$;

create trigger customer_recent_entities_reclaim_expired
before insert on public.customer_recent_entities
for each row execute function public.plan07_reclaim_expired_recent_entity();

create or replace function public.plan07_reclaim_expired_affinity()
returns trigger
language plpgsql
as $$
begin
  update public.customer_affinities
  set deleted_at = now()
  where visitor_id = new.visitor_id
    and feature_type = new.feature_type
    and feature_key = new.feature_key
    and algorithm_version = new.algorithm_version
    and deleted_at is null
    and expires_at <= now();
  return new;
end;
$$;

create trigger customer_affinities_reclaim_expired
before insert on public.customer_affinities
for each row execute function public.plan07_reclaim_expired_affinity();

create or replace function public.plan07_reclaim_expired_decision()
returns trigger
language plpgsql
as $$
begin
  update public.personalization_decisions
  set deleted_at = now()
  where visitor_id = new.visitor_id
    and placement = new.placement
    and context_version = new.context_version
    and algorithm_version = new.algorithm_version
    and strategy_key = new.strategy_key
    and deleted_at is null
    and expires_at <= now();
  return new;
end;
$$;

create trigger personalization_decisions_reclaim_expired
before insert on public.personalization_decisions
for each row execute function public.plan07_reclaim_expired_decision();

create view public.customer_preferences_active
  with (security_invoker = true)
as
  select preference.*
  from public.customer_preferences as preference
  join public.customer_consent_current as consent using (visitor_id)
  where preference.deleted_at is null
    and (preference.expires_at is null or preference.expires_at > now())
    and consent.personalization
    and consent.withdrawn_at is null;

create view public.customer_recent_entities_active
  with (security_invoker = true)
as
  select recent.*
  from public.customer_recent_entities as recent
  join public.customer_consent_current as consent using (visitor_id)
  where recent.deleted_at is null
    and recent.expires_at > now()
    and consent.personalization
    and consent.withdrawn_at is null;

create view public.customer_affinities_active
  with (security_invoker = true)
as
  select affinity.*
  from public.customer_affinities as affinity
  join public.customer_consent_current as consent using (visitor_id)
  where affinity.deleted_at is null
    and affinity.suppressed_at is null
    and affinity.expires_at > now()
    and consent.personalization
    and consent.withdrawn_at is null;

create view public.personalization_decisions_active
  with (security_invoker = true)
as
  select decision.*
  from public.personalization_decisions as decision
  join public.customer_consent_current as consent using (visitor_id)
  where decision.deleted_at is null
    and decision.expires_at > now()
    and consent.personalization
    and consent.withdrawn_at is null;

alter table public.customer_preferences enable row level security;
alter table public.customer_recent_entities enable row level security;
alter table public.customer_affinities enable row level security;
alter table public.personalization_decisions enable row level security;

revoke all on public.customer_preferences from anon, authenticated, public;
revoke all on public.customer_recent_entities from anon, authenticated, public;
revoke all on public.customer_affinities from anon, authenticated, public;
revoke all on public.personalization_decisions from anon, authenticated, public;

grant all on public.customer_preferences, public.customer_recent_entities,
  public.customer_affinities, public.personalization_decisions to service_role;

revoke all on public.customer_preferences_active, public.customer_recent_entities_active,
  public.customer_affinities_active, public.personalization_decisions_active
  from anon, authenticated, public;

revoke all on function public.plan07_reclaim_expired_preference() from public, anon, authenticated;
revoke all on function public.plan07_reclaim_expired_recent_entity() from public, anon, authenticated;
revoke all on function public.plan07_reclaim_expired_affinity() from public, anon, authenticated;
revoke all on function public.plan07_reclaim_expired_decision() from public, anon, authenticated;

grant select on public.customer_preferences_active, public.customer_recent_entities_active,
  public.customer_affinities_active, public.personalization_decisions_active to service_role;

comment on table public.customer_preferences is 'Plan 07 allowlisted explicit personalization features only.';
comment on table public.customer_recent_entities is 'Plan 07 short-retention entity IDs only, without event history or snapshots.';
comment on table public.customer_affinities is 'Plan 07 derived allowlisted features only, without raw event lists.';
comment on table public.personalization_decisions is 'Plan 07 minimal attribution metadata, without customer context or CRM data.';
comment on function public.plan07_reclaim_expired_preference() is 'Plan 07 local write-path reclamation permits replacement of expired preference rows.';
comment on function public.plan07_reclaim_expired_recent_entity() is 'Plan 07 local write-path reclamation permits replacement of expired recent rows.';
comment on function public.plan07_reclaim_expired_affinity() is 'Plan 07 local write-path reclamation permits replacement of expired affinity rows.';
comment on function public.plan07_reclaim_expired_decision() is 'Plan 07 local write-path reclamation permits replacement of expired decision rows.';
