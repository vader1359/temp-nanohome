create extension if not exists vector with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.vision_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  consent_policy_version text not null,
  purpose text not null default 'room_analysis' check (purpose = 'room_analysis'),
  original_object_path text,
  normalized_object_path text,
  object_hash text,
  state text not null default 'pending' check (state in ('pending', 'processing', 'completed', 'failed', 'deleted')),
  failure_code text,
  provider_id text,
  model_version text,
  schema_version text not null,
  idempotency_key text not null,
  retention_expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key),
  constraint vision_analysis_requests_original_path_layout check (original_object_path is null or original_object_path like owner_id::text || '/' || id::text || '/%'),
  constraint vision_analysis_requests_normalized_path_layout check (normalized_object_path is null or normalized_object_path like owner_id::text || '/' || id::text || '/%')
);
alter table public.vision_analysis_requests add constraint vision_analysis_requests_id_owner_key unique (id, owner_id);

create table public.room_scenes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.vision_analysis_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scene jsonb not null,
  mapper_version text not null,
  provider_version text not null,
  confidence numeric(5,4) check (confidence between 0 and 1),
  confirmation_state text not null default 'unconfirmed' check (confirmation_state in ('unconfirmed', 'confirmed')),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (request_id, owner_id) references public.vision_analysis_requests(id, owner_id) on delete cascade
);

create table public.vision_object_crops (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vision_analysis_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_category text not null,
  bounding_box jsonb not null,
  object_path text not null,
  object_hash text not null,
  embedding_state text not null default 'pending' check (embedding_state in ('pending', 'processing', 'completed', 'failed', 'deleted')),
  embedding_model_version text,
  created_at timestamptz not null default now(),
  constraint vision_object_crops_path_layout check (object_path like owner_id::text || '/' || request_id::text || '/%'),
  foreign key (request_id, owner_id) references public.vision_analysis_requests(id, owner_id) on delete cascade
);

create table public.product_visual_embeddings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete cascade,
  image_id text not null,
  image_hash text not null,
  view_type text not null,
  provider_id text not null,
  model_version text not null,
  dimensions integer not null check (dimensions > 0),
  embedding extensions.vector(1536) not null,
  generation_state text not null default 'pending' check (generation_state in ('pending', 'ready', 'failed', 'stale')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (image_id, model_version)
);

alter table public.vision_analysis_requests enable row level security;
alter table public.room_scenes enable row level security;
alter table public.vision_object_crops enable row level security;
alter table public.product_visual_embeddings enable row level security;

create policy vision_analysis_requests_owner_select on public.vision_analysis_requests
  for select to authenticated using (owner_id = auth.uid());
create policy room_scenes_owner_select on public.room_scenes
  for select to authenticated using (owner_id = auth.uid());
create policy room_scenes_owner_update on public.room_scenes
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy vision_object_crops_owner_select on public.vision_object_crops
  for select to authenticated using (owner_id = auth.uid());
revoke all on public.product_visual_embeddings from anon, authenticated, public;
grant all on public.product_visual_embeddings to service_role;
revoke all on public.vision_analysis_requests, public.room_scenes, public.vision_object_crops from anon, authenticated, public;
grant select on public.vision_analysis_requests, public.room_scenes, public.vision_object_crops to authenticated;
grant all on public.vision_analysis_requests, public.room_scenes, public.vision_object_crops to service_role;

create policy room_photos_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create or replace function public.get_vision_feature_defaults()
returns jsonb language sql immutable as $$
  select '{"uploadEnabled": false, "roomAnalysisEnabled": false, "visualSimilarityEnabled": false, "evaluationStorageEnabled": false}'::jsonb
$$;

create or replace function public.delete_vision_request(p_request_id uuid)
returns integer language plpgsql security definer set search_path = public, storage as $$
declare
  v_owner_id uuid;
  v_deleted integer := 0;
begin
  select owner_id into v_owner_id from public.vision_analysis_requests where id = p_request_id for update;
  if v_owner_id is null then return 0; end if;
  delete from storage.objects where bucket_id = 'room-photos' and (storage.foldername(name))[1] = v_owner_id::text and (storage.foldername(name))[2] = p_request_id::text;
  get diagnostics v_deleted = row_count;
  delete from public.vision_analysis_requests where id = p_request_id;
  return v_deleted;
end;
$$;

revoke all on function public.get_vision_feature_defaults() from public, anon, authenticated;
grant execute on function public.get_vision_feature_defaults() to service_role;
revoke all on function public.delete_vision_request(uuid) from public, anon, authenticated;
grant execute on function public.delete_vision_request(uuid) to service_role;

comment on table public.product_visual_embeddings is 'Catalog-only visual embeddings. Never attach customer owner or room-photo data.';
