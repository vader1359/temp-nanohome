-- Foundation Todo 13: complete restricted AMIS, recommendation, and personalization
-- setting contracts.
--
-- This migration adds schema contracts only. It does NOT enable AMIS synchronisation,
-- does NOT remove the historical consent ledger, consent UI, or consent runtime, and
-- does NOT implement recommendation scoring, ranking, or any widget. Restricted source
-- mirrors intentionally exclude raw notes, debt, addresses, margins, contact details,
-- and internal comments.
begin;

-- ---------------------------------------------------------------------------
-- 7.0 Historical legacy-shape repair (run before 7.1+ canonical CREATE).
--
-- Three same-name tables were created by earlier local migrations in a shape
-- that the canonical `CREATE TABLE IF NOT EXISTS` below cannot upgrade. Each
-- block detects the legacy shape (by absence of a canonical column), preserves
-- every safe row, maps legacy keys to canonical accounts via
-- public.customer_amis_links / public.customer_accounts, then rebuilds the
-- table in canonical shape. On a clean database the IF branches evaluate
-- false, so the canonical CREATE TABLE IF NOT EXISTS below remains the source
-- of truth — these blocks are idempotent no-ops on clean reset.
--
-- The row-preserving rebuild below drops legacy policies, RLS, grants and
-- triggers. The canonical policy/RLS/grant/trigger sections later in this
-- migration re-create them; this DO block only handles the structural swap.
-- ---------------------------------------------------------------------------

-- 7.0.1 amis_contact_snapshots: legacy plan03 shape -> canonical
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'amis_contact_snapshots'
      and column_name = 'amis_contact_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'amis_contact_snapshots'
      and column_name = 'amis_contact_code'
  )
  then
    -- Drop legacy pkey/FK constraints on the legacy shape so the rename
    -- carries no orphaned constraint metadata referencing the old shape.
    alter table public.amis_contact_snapshots
      drop constraint if exists amis_contact_snapshots_pkey,
      drop constraint if exists amis_contact_snapshots_amis_customer_id_fkey;

    alter table public.amis_contact_snapshots
      rename to amis_contact_snapshots_legacy_plan03;

    create table public.amis_contact_snapshots (
      amis_contact_id text collate "C" primary key,
      amis_contact_code text collate "C",
      amis_customer_id text collate "C" not null
        references public.amis_customer_snapshots(amis_customer_id) on delete cascade,
      contact_role text not null default 'unspecified',
      source_state text not null,
      source_created_at timestamptz,
      source_updated_at timestamptz not null,
      fetched_at timestamptz not null default now(),
      payload_digest text collate "C" not null,
      mapper_version text collate "C" not null,
      constraint amis_contact_snapshots_id_present_check
        check (octet_length(amis_contact_id) > 0),
      constraint amis_contact_snapshots_code_present_check
        check (amis_contact_code is null or octet_length(amis_contact_code) > 0),
      constraint amis_contact_snapshots_role_check
        check (contact_role in ('unspecified', 'primary', 'billing', 'project', 'other')),
      constraint amis_contact_snapshots_source_state_check
        check (source_state in ('active', 'deleted', 'merged', 'invalid')),
      constraint amis_contact_snapshots_digest_check
        check (payload_digest ~ '^[0-9a-f]{64}$'),
      constraint amis_contact_snapshots_mapper_version_check
        check (mapper_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
      constraint amis_contact_snapshots_source_order_check
        check (source_created_at is null or source_updated_at >= source_created_at)
    );

    insert into public.amis_contact_snapshots (
      amis_contact_id, amis_contact_code, amis_customer_id, contact_role,
      source_state, source_created_at, source_updated_at, fetched_at,
      payload_digest, mapper_version
    )
    select
      legacy.amis_contact_id,
      null,
      legacy.amis_customer_id,
      'unspecified',
      legacy.source_state,
      legacy.source_updated_at,            -- legacy had no source_created_at
      legacy.source_updated_at,
      now(),
      legacy.payload_digest,
      legacy.mapper_version
    from public.amis_contact_snapshots_legacy_plan03 legacy;

    drop table public.amis_contact_snapshots_legacy_plan03;
  end if;
end $$;

-- 7.0.2 customer_memory_briefs: legacy plan03 shape -> canonical
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_memory_briefs'
      and column_name = 'link_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_memory_briefs'
      and column_name = 'brief_version'
  )
  then
    alter table public.customer_memory_briefs
      drop constraint if exists customer_memory_briefs_pkey,
      drop constraint if exists customer_memory_briefs_link_id_fkey,
      drop constraint if exists customer_memory_briefs_user_id_fkey;

    alter table public.customer_memory_briefs
      rename to customer_memory_briefs_legacy_plan03;

    create table public.customer_memory_briefs (
      id uuid primary key default gen_random_uuid(),
      link_id uuid not null,
      account_id uuid not null references public.customer_accounts(id) on delete restrict,
      preferred_room_ids text[] not null default '{}',
      preferred_brand_ids text[] not null default '{}',
      project_stage text,
      customer_visible_summary text,
      discussed_variant_ids uuid[] not null default '{}',
      source text not null,
      approved_by uuid references auth.users(id) on delete set null,
      reviewed_at timestamptz,
      source_watermark timestamptz not null,
      brief_version text collate "C" not null,
      generated_at timestamptz not null default now(),
      expires_at timestamptz,
      updated_at timestamptz not null default now(),
      constraint customer_memory_briefs_link_account_fkey
        foreign key (link_id, account_id)
        references public.customer_amis_links(id, account_id) on delete cascade,
      constraint customer_memory_briefs_source_check
        check (source in ('amis_custom_field', 'staff_brief', 'approved_import')),
      constraint customer_memory_briefs_version_check
        check (brief_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
      constraint customer_memory_briefs_project_stage_check
        check (project_stage is null or project_stage ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
      constraint customer_memory_briefs_summary_length_check
        check (customer_visible_summary is null
               or (octet_length(customer_visible_summary) > 0
                   and length(customer_visible_summary) <= 2000)),
      constraint customer_memory_briefs_review_check
        check ((source = 'staff_brief') = (approved_by is not null)),
      constraint customer_memory_briefs_reviewed_pair_check
        check ((approved_by is null) = (reviewed_at is null)),
      constraint customer_memory_briefs_expiry_check
        check (expires_at is null or expires_at > generated_at),
      constraint customer_memory_briefs_updated_order_check
        check (updated_at >= generated_at)
    );

    -- Preserve every legacy brief row. Map account_id via customer_amis_links
    -- so the composite FK is satisfied even when customer_accounts was
    -- backfilled against auth.users. brief_version falls back to a stable
    -- canonical token when the legacy projection_version does not match the
    -- canonical regex.
    insert into public.customer_memory_briefs (
      id, link_id, account_id,
      preferred_room_ids, preferred_brand_ids, project_stage,
      customer_visible_summary, discussed_variant_ids,
      source, approved_by, reviewed_at, source_watermark,
      brief_version, generated_at, expires_at, updated_at
    )
    select
      gen_random_uuid(),
      legacy.link_id,
      link.account_id,
      '{}',
      '{}',
      null,
      null,
      '{}',
      'approved_import',
      null,
      null,
      legacy.source_updated_at,
      case
        when legacy.projection_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
          then legacy.projection_version
        else 'legacy-plan03'
      end,
      coalesce(legacy.source_updated_at, legacy.updated_at, now()),
      case
        when legacy.expires_at is not null
             and legacy.expires_at > coalesce(legacy.source_updated_at, legacy.updated_at, now())
          then legacy.expires_at
        else null
      end,
      coalesce(legacy.updated_at, legacy.source_updated_at, now())
    from public.customer_memory_briefs_legacy_plan03 legacy
    join public.customer_amis_links link on link.id = legacy.link_id;

    drop table public.customer_memory_briefs_legacy_plan03;
  end if;
end $$;

-- 7.0.3 customer_personalization_settings: legacy plan03 -> canonical
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_personalization_settings'
      and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_personalization_settings'
      and column_name = 'account_id'
  )
  then
    alter table public.customer_personalization_settings
      drop constraint if exists customer_personalization_settings_pkey,
      drop constraint if exists customer_personalization_settings_user_id_fkey;

    alter table public.customer_personalization_settings
      rename to customer_personalization_settings_legacy_plan03;

    create table public.customer_personalization_settings (
      account_id uuid primary key references public.customer_accounts(id) on delete cascade,
      user_id uuid references auth.users(id) on delete set null,
      enabled boolean not null default true,
      use_amis_history boolean not null default false,
      use_behavior_history boolean not null default false,
      recommendation_shadow_mode boolean not null default true,
      policy_version text collate "C" not null,
      updated_by_actor text not null default 'system',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint customer_personalization_settings_policy_version_check
        check (policy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
      constraint customer_personalization_settings_actor_check
        check (updated_by_actor in ('customer', 'staff', 'system')),
      constraint customer_personalization_settings_disabled_check
        check (enabled or (not use_amis_history and not use_behavior_history)),
      constraint customer_personalization_settings_account_overlap_check
        check (user_id is null
               or public.is_legacy_account_ownership_valid(user_id, account_id)),
      constraint customer_personalization_settings_updated_order_check
        check (updated_at >= created_at)
    );

    -- Map legacy user_id to canonical account_id via customer_accounts.
    -- The legacy 'plan03-disabled-v1' policy_version does not match the
    -- canonical date regex, so we synthesize a date from updated_at.
    -- use_amis_history / use_behavior_history are forced false when the
    -- legacy row was disabled, satisfying the canonical disabled_check.
    insert into public.customer_personalization_settings (
      account_id, user_id, enabled,
      use_amis_history, use_behavior_history,
      recommendation_shadow_mode, policy_version, updated_by_actor,
      created_at, updated_at
    )
    select
      account.id,
      legacy.user_id,
      legacy.enabled,
      case when legacy.enabled then legacy.use_amis_history else false end,
      case when legacy.enabled then legacy.use_behavior_history else false end,
      true,
      to_char(coalesce(legacy.updated_at, now())::date, 'YYYY-MM-DD'),
      'system',
      coalesce(legacy.updated_at, now()),
      coalesce(legacy.updated_at, now())
    from public.customer_personalization_settings_legacy_plan03 legacy
    join public.customer_accounts account
      on account.legacy_supabase_user_id = legacy.user_id;

    drop table public.customer_personalization_settings_legacy_plan03;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7.1 Restricted contact snapshots (service-only source mirror)
-- ---------------------------------------------------------------------------
create table if not exists public.amis_contact_snapshots (
  amis_contact_id text collate "C" primary key,
  amis_contact_code text collate "C",
  amis_customer_id text collate "C" not null
    references public.amis_customer_snapshots(amis_customer_id) on delete cascade,
  contact_role text not null default 'unspecified',
  source_state text not null,
  source_created_at timestamptz,
  source_updated_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  payload_digest text collate "C" not null,
  mapper_version text collate "C" not null,
  constraint amis_contact_snapshots_id_present_check
    check (octet_length(amis_contact_id) > 0),
  constraint amis_contact_snapshots_code_present_check
    check (amis_contact_code is null or octet_length(amis_contact_code) > 0),
  constraint amis_contact_snapshots_role_check
    check (contact_role in ('unspecified', 'primary', 'billing', 'project', 'other')),
  constraint amis_contact_snapshots_source_state_check
    check (source_state in ('active', 'deleted', 'merged', 'invalid')),
  constraint amis_contact_snapshots_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint amis_contact_snapshots_mapper_version_check
    check (mapper_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint amis_contact_snapshots_source_order_check
    check (source_created_at is null or source_updated_at >= source_created_at)
);

create index if not exists amis_contact_snapshots_customer_idx
  on public.amis_contact_snapshots (amis_customer_id, source_updated_at desc);

-- ---------------------------------------------------------------------------
-- 7.2 Staff-approved memory briefs (service-only; safe fields exposed by view)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_memory_briefs (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  preferred_room_ids text[] not null default '{}',
  preferred_brand_ids text[] not null default '{}',
  project_stage text,
  customer_visible_summary text,
  discussed_variant_ids uuid[] not null default '{}',
  source text not null,
  approved_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  source_watermark timestamptz not null,
  brief_version text collate "C" not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint customer_memory_briefs_link_account_fkey
    foreign key (link_id, account_id)
    references public.customer_amis_links(id, account_id) on delete cascade,
  constraint customer_memory_briefs_source_check
    check (source in ('amis_custom_field', 'staff_brief', 'approved_import')),
  constraint customer_memory_briefs_version_check
    check (brief_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint customer_memory_briefs_project_stage_check
    check (project_stage is null or project_stage ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint customer_memory_briefs_summary_length_check
    check (customer_visible_summary is null
           or (octet_length(customer_visible_summary) > 0
               and length(customer_visible_summary) <= 2000)),
  constraint customer_memory_briefs_review_check
    check ((source = 'staff_brief') = (approved_by is not null)),
  constraint customer_memory_briefs_reviewed_pair_check
    check ((approved_by is null) = (reviewed_at is null)),
  constraint customer_memory_briefs_expiry_check
    check (expires_at is null or expires_at > generated_at),
  constraint customer_memory_briefs_updated_order_check
    check (updated_at >= generated_at)
);

create unique index if not exists customer_memory_briefs_link_version_unique
  on public.customer_memory_briefs (link_id, brief_version);
create index if not exists customer_memory_briefs_account_idx
  on public.customer_memory_briefs (account_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- 7.3 Recommendation signals (account owned, canonical variant linked)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_recommendation_signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete cascade,
  link_id uuid,
  variant_id uuid not null references public.variants(id) on delete cascade,
  signal_kind text not null,
  signal_source text not null,
  signal_count integer not null default 1,
  shadow_only boolean not null default true,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  projection_version text collate "C" not null,
  constraint customer_recommendation_signals_link_account_fkey
    foreign key (link_id, account_id)
    references public.customer_amis_links(id, account_id) on delete cascade,
  constraint customer_recommendation_signals_kind_check
    check (signal_kind in ('purchased', 'quoted_or_interested', 'explicit_preference',
                           'session_interest', 'excluded')),
  constraint customer_recommendation_signals_source_check
    check (signal_source in ('amis_sale_order', 'amis_custom_field', 'staff_brief',
                             'customer_explicit', 'session_event')),
  constraint customer_recommendation_signals_count_check
    check (signal_count between 1 and 1000000),
  constraint customer_recommendation_signals_amis_link_check
    check (signal_source not in ('amis_sale_order', 'amis_custom_field') or link_id is not null),
  constraint customer_recommendation_signals_version_check
    check (projection_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint customer_recommendation_signals_observed_order_check
    check (last_observed_at >= first_observed_at),
  constraint customer_recommendation_signals_expiry_check
    check (expires_at > first_observed_at)
);

create unique index if not exists customer_recommendation_signals_owner_unique
  on public.customer_recommendation_signals
     (account_id, variant_id, signal_kind, projection_version);
create index if not exists customer_recommendation_signals_account_idx
  on public.customer_recommendation_signals (account_id, last_observed_at desc);

-- ---------------------------------------------------------------------------
-- 7.3 Complete the safe customer memory projection
-- ---------------------------------------------------------------------------
alter table public.customer_memory_projections
  add column if not exists purchased_variant_ids uuid[] not null default '{}',
  add column if not exists discussed_variant_ids uuid[] not null default '{}',
  add column if not exists preferred_room_ids text[] not null default '{}',
  add column if not exists preferred_brand_ids text[] not null default '{}',
  add column if not exists project_stage text,
  add column if not exists customer_visible_summary text,
  add column if not exists source_watermark timestamptz not null default now(),
  add column if not exists generated_at timestamptz not null default now();

update public.customer_memory_projections
set source_watermark = source_updated_at
where source_watermark is null;

alter table public.customer_memory_projections
  alter column source_watermark set not null;

alter table public.customer_memory_projections
  drop constraint if exists customer_memory_projections_expiry_check;
alter table public.customer_memory_projections
  add constraint customer_memory_projections_expiry_check
    check (expires_at is null or expires_at > generated_at);

alter table public.customer_memory_projections
  drop constraint if exists customer_memory_projections_project_stage_check;
alter table public.customer_memory_projections
  add constraint customer_memory_projections_project_stage_check
    check (project_stage is null or project_stage ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

alter table public.customer_memory_projections
  drop constraint if exists customer_memory_projections_summary_length_check;
alter table public.customer_memory_projections
  add constraint customer_memory_projections_summary_length_check
    check (customer_visible_summary is null
           or (octet_length(customer_visible_summary) > 0
               and length(customer_visible_summary) <= 2000));

-- ---------------------------------------------------------------------------
-- 7.4 Canonical variant recommendation features
-- ---------------------------------------------------------------------------
create table if not exists public.variant_recommendation_features (
  variant_id uuid primary key references public.variants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_key text,
  room_key text,
  brand_id uuid references public.brands(id) on delete set null,
  designer_id uuid,
  collection_key text,
  style_key text,
  material_key text,
  palette_key text,
  price_band text not null default 'unknown',
  complementary_group_key text,
  repeatable boolean not null default false,
  durable boolean not null default true,
  eligible boolean not null default false,
  has_primary_image boolean not null default false,
  in_stock boolean not null default false,
  freshness_at timestamptz not null default now(),
  feature_version text collate "C" not null,
  updated_at timestamptz not null default now(),
  constraint variant_recommendation_features_price_band_check
    check (price_band in ('unknown', 'entry', 'mid', 'upper', 'premium', 'luxury')),
  constraint variant_recommendation_features_version_check
    check (feature_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint variant_recommendation_features_keys_check
    check (
      (subcategory_key is null or subcategory_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (room_key is null or room_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (collection_key is null or collection_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (style_key is null or style_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (material_key is null or material_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (palette_key is null or palette_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      and (complementary_group_key is null
           or complementary_group_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
    ),
  constraint variant_recommendation_features_eligibility_check
    check (not eligible or (has_primary_image and price_band <> 'unknown'))
);

create index if not exists variant_recommendation_features_eligible_idx
  on public.variant_recommendation_features (eligible, freshness_at desc);

-- ---------------------------------------------------------------------------
-- 8.1 Account-owned personalization settings (shadow alongside consent ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_personalization_settings (
  account_id uuid primary key references public.customer_accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  enabled boolean not null default true,
  use_amis_history boolean not null default false,
  use_behavior_history boolean not null default false,
  recommendation_shadow_mode boolean not null default true,
  policy_version text collate "C" not null,
  updated_by_actor text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_personalization_settings_policy_version_check
    check (policy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint customer_personalization_settings_actor_check
    check (updated_by_actor in ('customer', 'staff', 'system')),
  constraint customer_personalization_settings_disabled_check
    check (enabled or (not use_amis_history and not use_behavior_history)),
  constraint customer_personalization_settings_account_overlap_check
    check (user_id is null
           or public.is_legacy_account_ownership_valid(user_id, account_id)),
  constraint customer_personalization_settings_updated_order_check
    check (updated_at >= created_at)
);

-- ---------------------------------------------------------------------------
-- Verified AMIS link enforcement for briefs, signals, and AMIS history opt-in
-- ---------------------------------------------------------------------------
create or replace function public.enforce_personalization_link_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  link_state text;
  link_account uuid;
begin
  if new.link_id is null then
    return new;
  end if;

  select state, account_id into link_state, link_account
  from public.customer_amis_links
  where id = new.link_id;

  if link_state is null then
    raise exception 'personalization AMIS link does not exist'
      using errcode = 'P0001';
  end if;

  if link_account is distinct from new.account_id then
    raise exception 'personalization AMIS link must belong to the owning account'
      using errcode = 'P0001';
  end if;

  if link_state not in ('verified', 'active') then
    raise exception 'personalization AMIS link must be verified for the owner'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_personalization_settings_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.use_amis_history and not exists (
    select 1
    from public.customer_amis_links
    where account_id = new.account_id
      and state in ('verified', 'active')
  ) then
    raise exception 'personalization AMIS history requires a verified AMIS link'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists customer_memory_briefs_link_contract
  on public.customer_memory_briefs;
create trigger customer_memory_briefs_link_contract
  before insert or update of link_id, account_id on public.customer_memory_briefs
  for each row execute function public.enforce_personalization_link_contract();

drop trigger if exists customer_recommendation_signals_link_contract
  on public.customer_recommendation_signals;
create trigger customer_recommendation_signals_link_contract
  before insert or update of link_id, account_id on public.customer_recommendation_signals
  for each row execute function public.enforce_personalization_link_contract();

drop trigger if exists customer_personalization_settings_contract
  on public.customer_personalization_settings;
create trigger customer_personalization_settings_contract
  before insert or update of use_amis_history, account_id
  on public.customer_personalization_settings
  for each row execute function public.enforce_personalization_settings_contract();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.amis_contact_snapshots enable row level security;
alter table public.customer_memory_briefs enable row level security;
alter table public.customer_recommendation_signals enable row level security;
alter table public.variant_recommendation_features enable row level security;
alter table public.customer_personalization_settings enable row level security;

drop policy if exists "amis contact snapshots deny browser" on public.amis_contact_snapshots;
create policy "amis contact snapshots deny browser" on public.amis_contact_snapshots
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "customer memory briefs deny browser" on public.customer_memory_briefs;
create policy "customer memory briefs deny browser" on public.customer_memory_briefs
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "variant recommendation features deny browser"
  on public.variant_recommendation_features;
create policy "variant recommendation features deny browser"
  on public.variant_recommendation_features
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "customer recommendation signals own read"
  on public.customer_recommendation_signals;
create policy "customer recommendation signals own read"
  on public.customer_recommendation_signals
  for select to authenticated
  using (account_id = (select public.current_customer_account_id()));

drop policy if exists "customer personalization settings own read"
  on public.customer_personalization_settings;
create policy "customer personalization settings own read"
  on public.customer_personalization_settings
  for select to authenticated
  using (account_id = (select public.current_customer_account_id()));

-- ---------------------------------------------------------------------------
-- Owner readable safe projections and settings
-- ---------------------------------------------------------------------------
create or replace view public.customer_memory_projections_safe
with (security_barrier = true) as
select
  p.account_id,
  p.link_id,
  p.purchased_variant_ids,
  p.discussed_variant_ids,
  p.preferred_room_ids,
  p.preferred_brand_ids,
  p.project_stage,
  p.customer_visible_summary,
  p.source_watermark,
  p.generated_at,
  p.expires_at,
  p.projection_version
from public.customer_memory_projections p
where p.account_id = (select public.current_customer_account_id())
  and (p.expires_at is null or p.expires_at > now());

create or replace view public.customer_memory_briefs_safe
with (security_barrier = true) as
select
  b.account_id,
  b.link_id,
  b.preferred_room_ids,
  b.preferred_brand_ids,
  b.project_stage,
  b.customer_visible_summary,
  b.discussed_variant_ids,
  b.generated_at,
  b.expires_at
from public.customer_memory_briefs b
where b.account_id = (select public.current_customer_account_id())
  and (b.expires_at is null or b.expires_at > now());

create or replace view public.customer_recommendation_signals_safe
with (security_barrier = true) as
select
  s.account_id,
  s.variant_id,
  s.signal_kind,
  s.signal_count,
  s.shadow_only,
  s.last_observed_at,
  s.expires_at
from public.customer_recommendation_signals s
where s.account_id = (select public.current_customer_account_id())
  and s.expires_at > now();

create or replace view public.customer_personalization_settings_safe
with (security_barrier = true) as
select
  s.account_id,
  s.enabled,
  s.use_amis_history,
  s.use_behavior_history,
  s.recommendation_shadow_mode,
  s.policy_version,
  s.updated_at
from public.customer_personalization_settings s
where s.account_id = (select public.current_customer_account_id());

-- ---------------------------------------------------------------------------
-- Grants: raw tables stay service-only, safe surfaces are owner readable
-- ---------------------------------------------------------------------------
revoke all on
  public.amis_contact_snapshots,
  public.customer_memory_briefs,
  public.customer_recommendation_signals,
  public.variant_recommendation_features,
  public.customer_personalization_settings
from public, anon, authenticated;

revoke all on
  public.customer_memory_projections_safe,
  public.customer_memory_briefs_safe,
  public.customer_recommendation_signals_safe,
  public.customer_personalization_settings_safe
from public, anon;

revoke all on function
  public.enforce_personalization_link_contract(),
  public.enforce_personalization_settings_contract()
from public, anon, authenticated;

grant select on
  public.customer_memory_projections_safe,
  public.customer_memory_briefs_safe,
  public.customer_recommendation_signals_safe,
  public.customer_personalization_settings_safe
to authenticated;

grant all on
  public.amis_contact_snapshots,
  public.customer_memory_briefs,
  public.customer_recommendation_signals,
  public.variant_recommendation_features,
  public.customer_personalization_settings
to service_role;

grant select on
  public.customer_memory_projections_safe,
  public.customer_memory_briefs_safe,
  public.customer_recommendation_signals_safe,
  public.customer_personalization_settings_safe
to service_role;

-- ---------------------------------------------------------------------------
-- Documentation
-- ---------------------------------------------------------------------------
comment on table public.amis_contact_snapshots is
  'Plan 03 restricted AMIS contact identity mirror; no contact details, notes, debt, addresses, margins, or internal comments.';
comment on table public.customer_memory_briefs is
  'Plan 03 staff-approved structured brief fallback; never an AMIS note mirror and service-only.';
comment on table public.customer_recommendation_signals is
  'Plan 03 account-owned canonical variant signals; expiry bounded and shadow-only by default.';
comment on table public.variant_recommendation_features is
  'Plan 03 canonical variant recommendation features; no pricing margin or supplier cost data.';
comment on table public.customer_personalization_settings is
  'Plan 08 account-owned personalization settings shadowing the retained consent ledger; behavioral history is off by default.';
comment on view public.customer_memory_projections_safe is
  'Owner-readable safe customer memory projection; excludes expired rows and raw AMIS payloads.';
comment on view public.customer_memory_briefs_safe is
  'Owner-readable safe brief fields only; hides approver, source, and brief version internals.';
comment on view public.customer_recommendation_signals_safe is
  'Owner-readable non-expired recommendation signals without projection internals.';
comment on view public.customer_personalization_settings_safe is
  'Owner-readable personalization settings without actor audit internals.';

commit;
