begin;

alter table public.vision_analysis_requests
  add column owner_account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.room_scenes
  add column owner_account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.vision_object_crops
  add column owner_account_id uuid references public.customer_accounts(id) on delete restrict;

update public.vision_analysis_requests request
set owner_account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = request.owner_id;

update public.room_scenes scene
set owner_account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = scene.owner_id;

update public.vision_object_crops crop
set owner_account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = crop.owner_id;

do $block$
begin
  if exists (select 1 from public.vision_analysis_requests where owner_account_id is null)
    or exists (select 1 from public.room_scenes where owner_account_id is null)
    or exists (select 1 from public.vision_object_crops where owner_account_id is null) then
    raise exception 'vision ownership backfill left rows without accounts';
  end if;
end;
$block$;

alter table public.vision_analysis_requests
  alter column owner_account_id set not null,
  alter column owner_id drop not null;

alter table public.room_scenes
  alter column owner_account_id set not null,
  alter column owner_id drop not null;

alter table public.vision_object_crops
  alter column owner_account_id set not null,
  alter column owner_id drop not null;

alter table public.vision_analysis_requests
  add constraint vision_analysis_requests_legacy_owner_overlap_check
    check (public.is_legacy_account_ownership_valid(owner_id, owner_account_id));

alter table public.room_scenes
  add constraint room_scenes_legacy_owner_overlap_check
    check (public.is_legacy_account_ownership_valid(owner_id, owner_account_id));

alter table public.vision_object_crops
  add constraint vision_object_crops_legacy_owner_overlap_check
    check (public.is_legacy_account_ownership_valid(owner_id, owner_account_id));

alter table public.vision_analysis_requests
  drop constraint vision_analysis_requests_original_path_layout,
  drop constraint vision_analysis_requests_normalized_path_layout;

alter table public.vision_analysis_requests
  add constraint vision_analysis_requests_original_path_layout check (
    original_object_path is null
    or original_object_path like owner_account_id::text || '/' || id::text || '/%'
    or (owner_id is not null and original_object_path like owner_id::text || '/' || id::text || '/%')
  ),
  add constraint vision_analysis_requests_normalized_path_layout check (
    normalized_object_path is null
    or normalized_object_path like owner_account_id::text || '/' || id::text || '/%'
    or (owner_id is not null and normalized_object_path like owner_id::text || '/' || id::text || '/%')
  );

alter table public.vision_object_crops
  drop constraint vision_object_crops_path_layout;

alter table public.vision_object_crops
  add constraint vision_object_crops_path_layout check (
    object_path like owner_account_id::text || '/' || request_id::text || '/%'
    or (owner_id is not null and object_path like owner_id::text || '/' || request_id::text || '/%')
  );

alter table public.vision_analysis_requests
  add constraint vision_analysis_requests_id_account_key unique (id, owner_account_id);

do $block$
declare
  target_table regclass;
  legacy_constraint text;
begin
  foreach target_table in array array['public.room_scenes'::regclass, 'public.vision_object_crops'::regclass]
  loop
    select conname into legacy_constraint
    from pg_constraint
    where conrelid = target_table
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(request_id, owner_id)%';

    if legacy_constraint is null then
      raise exception 'legacy composite vision owner foreign key is missing on %', target_table;
    end if;

    execute format('alter table %s drop constraint %I', target_table, legacy_constraint);
  end loop;
end;
$block$;

alter table public.room_scenes
  add constraint room_scenes_request_account_fkey
    foreign key (request_id, owner_account_id)
    references public.vision_analysis_requests(id, owner_account_id) on delete cascade;

alter table public.vision_object_crops
  add constraint vision_object_crops_request_account_fkey
    foreign key (request_id, owner_account_id)
    references public.vision_analysis_requests(id, owner_account_id) on delete cascade;

create index vision_analysis_requests_owner_account_created_idx
  on public.vision_analysis_requests(owner_account_id, created_at desc);

create index room_scenes_owner_account_idx
  on public.room_scenes(owner_account_id);

create index vision_object_crops_owner_account_idx
  on public.vision_object_crops(owner_account_id, request_id);

create unique index vision_analysis_requests_account_idempotency_unique
  on public.vision_analysis_requests(owner_account_id, idempotency_key);

create or replace function public.assign_vision_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  legacy_account_id uuid;
begin
  if tg_op = 'UPDATE' and new.owner_account_id is distinct from old.owner_account_id then
    raise exception 'vision account ownership cannot be reassigned'
      using errcode = 'P0001';
  end if;

  if new.owner_id is not null then
    legacy_account_id := public.legacy_customer_account_id(new.owner_id);
    if legacy_account_id is null then
      raise exception 'legacy vision owner must map to an internal account'
        using errcode = 'P0001';
    end if;

    if new.owner_account_id is null then
      new.owner_account_id := legacy_account_id;
    elsif new.owner_account_id <> legacy_account_id then
      raise exception 'legacy vision owner and account ownership must match'
        using errcode = 'P0001';
    end if;
  elsif new.owner_account_id is null then
    raise exception 'vision record requires an internal account'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create trigger assign_vision_request_account_ownership
  before insert or update of owner_id, owner_account_id
  on public.vision_analysis_requests
  for each row execute function public.assign_vision_account_ownership();

create trigger assign_room_scene_account_ownership
  before insert or update of owner_id, owner_account_id
  on public.room_scenes
  for each row execute function public.assign_vision_account_ownership();

create trigger assign_vision_crop_account_ownership
  before insert or update of owner_id, owner_account_id
  on public.vision_object_crops
  for each row execute function public.assign_vision_account_ownership();

create or replace function public.is_room_photo_path_readable(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, storage
as $function$
  with viewer as (
    select public.current_customer_account_id() as account_id
  ),
  folder as (
    select
      (storage.foldername(p_object_name))[1] as owner_folder,
      (storage.foldername(p_object_name))[2] as request_folder
  )
  select exists (
    select 1
    from viewer, folder, public.vision_analysis_requests request
    where viewer.account_id is not null
      and folder.request_folder is not null
      and request.owner_account_id = viewer.account_id
      and request.id::text = folder.request_folder
      and (
        folder.owner_folder = viewer.account_id::text
        or (request.owner_id is not null and folder.owner_folder = request.owner_id::text)
      )
  );
$function$;

drop policy if exists vision_analysis_requests_owner_select on public.vision_analysis_requests;
create policy vision_analysis_requests_owner_select on public.vision_analysis_requests
  for select to authenticated using (
    owner_account_id = (select public.current_customer_account_id())
    and public.is_legacy_account_ownership_valid(owner_id, owner_account_id)
  );

drop policy if exists room_scenes_owner_select on public.room_scenes;
create policy room_scenes_owner_select on public.room_scenes
  for select to authenticated using (
    owner_account_id = (select public.current_customer_account_id())
    and public.is_legacy_account_ownership_valid(owner_id, owner_account_id)
  );

drop policy if exists room_scenes_owner_update on public.room_scenes;
create policy room_scenes_owner_update on public.room_scenes
  for update to authenticated using (
    owner_account_id = (select public.current_customer_account_id())
    and public.is_legacy_account_ownership_valid(owner_id, owner_account_id)
  ) with check (
    owner_account_id = (select public.current_customer_account_id())
    and public.is_legacy_account_ownership_valid(owner_id, owner_account_id)
  );

drop policy if exists vision_object_crops_owner_select on public.vision_object_crops;
create policy vision_object_crops_owner_select on public.vision_object_crops
  for select to authenticated using (
    owner_account_id = (select public.current_customer_account_id())
    and public.is_legacy_account_ownership_valid(owner_id, owner_account_id)
  );

drop policy if exists room_photos_owner_read on storage.objects;
create policy room_photos_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'room-photos' and public.is_room_photo_path_readable(name)
  );

create or replace function public.delete_vision_request(p_request_id uuid)
returns integer language plpgsql security definer set search_path = public, storage as $$
declare
  v_account_id uuid;
  v_legacy_owner_id uuid;
  v_deleted integer := 0;
begin
  if session_user <> 'service_role'
    and current_user <> 'service_role'
    and current_setting('role', true) is distinct from 'service_role' then
    raise exception 'vision deletion requires service role';
  end if;

  select owner_account_id, owner_id
  into v_account_id, v_legacy_owner_id
  from public.vision_analysis_requests
  where id = p_request_id
  for update;

  if v_account_id is null then return 0; end if;

  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects
  where bucket_id = 'room-photos'
    and (storage.foldername(name))[2] = p_request_id::text
    and (
      (storage.foldername(name))[1] = v_account_id::text
      or (v_legacy_owner_id is not null and (storage.foldername(name))[1] = v_legacy_owner_id::text)
    );

  get diagnostics v_deleted = row_count;
  perform set_config('storage.allow_delete_query', 'false', true);

  delete from public.vision_analysis_requests where id = p_request_id;
  return v_deleted;
end;
$$;

revoke all on function public.is_room_photo_path_readable(text) from public, anon;
grant execute on function public.is_room_photo_path_readable(text) to authenticated, service_role;
revoke execute on function public.assign_vision_account_ownership() from public, anon, authenticated;
revoke all on function public.delete_vision_request(uuid) from public, anon, authenticated;
grant execute on function public.delete_vision_request(uuid) to service_role;

comment on column public.vision_analysis_requests.owner_account_id is 'Internal customer account owner; legacy owner_id is overlap metadata only.';
comment on column public.room_scenes.owner_account_id is 'Internal customer account owner inherited from the owning vision request.';
comment on column public.vision_object_crops.owner_account_id is 'Internal customer account owner inherited from the owning vision request.';
comment on function public.is_room_photo_path_readable(text) is 'Account-derived room-photo read rule; legacy auth-UUID folders stay readable only for the same internal account during the migration overlap.';

commit;
