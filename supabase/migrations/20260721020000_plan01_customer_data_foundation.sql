create table public.customer_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_token_hash text not null unique,
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  check (visitor_token_hash <> '')
);

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  session_token_hash text not null unique,
  started_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  check (session_token_hash <> '')
);

create index customer_sessions_visitor_id_idx on public.customer_sessions(visitor_id);

create table public.customer_identity_ledger (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  session_id uuid references public.customer_sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  identity_kind text not null,
  identity_value_hash text not null,
  recorded_at timestamp with time zone not null default now(),
  source text not null,
  check (identity_kind in ('anonymous', 'authenticated')),
  check (identity_value_hash <> '')
);

create index customer_identity_ledger_visitor_idx
  on public.customer_identity_ledger(visitor_id, recorded_at desc);

create table public.customer_consent_ledger (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  session_id uuid references public.customer_sessions(id) on delete set null,
  policy_version text not null,
  locale text not null,
  source text not null,
  actor text not null,
  analytics boolean not null default false,
  personalization boolean not null default false,
  ai_processing boolean not null default false,
  ai_conversation_storage boolean not null default false,
  room_image_processing boolean not null default false,
  room_image_storage boolean not null default false,
  marketing boolean not null default false,
  withdrawn_at timestamp with time zone,
  withdrawal_reason text,
  recorded_at timestamp with time zone not null default now(),
  check (actor in ('visitor', 'user', 'worker')),
  check ((withdrawn_at is null and withdrawal_reason is null)
    or (withdrawn_at is not null and nullif(btrim(withdrawal_reason), '') is not null))
);

create table public.customer_consent_current (
  visitor_id uuid primary key references public.customer_visitors(id) on delete cascade,
  consent_ledger_id bigint not null references public.customer_consent_ledger(id),
  policy_version text not null,
  locale text not null,
  source text not null,
  actor text not null,
  analytics boolean not null,
  personalization boolean not null,
  ai_processing boolean not null,
  ai_conversation_storage boolean not null,
  room_image_processing boolean not null,
  room_image_storage boolean not null,
  marketing boolean not null,
  withdrawn_at timestamp with time zone,
  withdrawal_reason text,
  recorded_at timestamp with time zone not null
);

create table public.customer_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  session_id uuid not null references public.customer_sessions(id) on delete cascade,
  event_name text not null,
  idempotency_key_hash text not null,
  occurred_at timestamp with time zone not null,
  received_at timestamp with time zone not null default now(),
  route_key text,
  locale text,
  product_id uuid,
  variant_id uuid,
  placement text,
  filter_keys text[],
  result_count_bucket text,
  request_id text,
  item_ids uuid[],
  item_id uuid,
  rank integer,
  source_placement text,
  cart_id uuid,
  item_count_bucket text,
  preference_keys text[],
  analysis_id text,
  correction_flags text[],
  unique (session_id, idempotency_key_hash),
  check (event_name in (
    'page_viewed', 'product_viewed', 'search_submitted',
    'recommendation_impression', 'recommendation_clicked', 'cart_item_added',
    'checkout_started', 'preference_updated', 'room_analysis_confirmed'
  )),
  check (idempotency_key_hash <> ''),
  check (event_name <> 'page_viewed' or (route_key is not null and locale is not null)),
  check (event_name <> 'product_viewed' or (product_id is not null and variant_id is not null and placement is not null)),
  check (event_name <> 'search_submitted' or result_count_bucket in ('0', '1-9', '10-49', '50+')),
  check (event_name <> 'recommendation_impression' or (request_id is not null and placement is not null and item_ids is not null and cardinality(item_ids) between 1 and 20)),
  check (event_name <> 'recommendation_clicked' or (request_id is not null and item_id is not null and rank between 1 and 100)),
  check (event_name <> 'cart_item_added' or (variant_id is not null and source_placement is not null)),
  check (event_name <> 'checkout_started' or (cart_id is not null and item_count_bucket in ('1', '2-4', '5+'))),
  check (event_name <> 'preference_updated' or preference_keys is not null),
  check (event_name <> 'room_analysis_confirmed' or (analysis_id is not null and correction_flags is not null))
);

create table public.customer_event_daily_aggregates (
  aggregate_date date not null,
  event_name text not null,
  event_count bigint not null default 0 check (event_count >= 0),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  primary key (aggregate_date, event_name)
);

comment on table public.customer_visitors is 'Plan 01 anonymous customer visitors; only token hashes are stored.';
comment on table public.customer_consent_current is 'Read-only derived consent projection maintained from the append-only ledger.';
comment on table public.customer_events is 'Allowlisted customer events with fixed typed columns; arbitrary client payloads are not stored.';
