create function public.catalog_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  record_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  before_data jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_data jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  audit_source text := case when pg_has_role(session_user, 'nocodb_catalog_editor', 'member') then 'nocodb' else 'system' end;
begin
  insert into public.catalog_audit_log (actor_role, source, table_name, record_id, action, before_data, after_data)
  values (session_user, audit_source, tg_table_name, (record_data ->> 'id')::uuid, lower(tg_op), before_data, after_data);
  return coalesce(new, old);
end;
$$;

create function public.validate_cms_parent_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected_section_type text := case tg_table_name
    when 'hero_slides' then 'hero'
    when 'product_curations' then 'product_curation'
    when 'content_carousels' then 'content_carousel'
  end;
begin
  if not exists (
    select 1 from public.page_sections
    where id = new.section_id and section_type = expected_section_type
  ) then
    raise exception '% must belong to a % page section', tg_table_name, expected_section_type using errcode = '23514';
  end if;

  if tg_table_name = 'hero_slides' and new.approved and new.validated then
    if not exists (
      select 1 from public.media_assets
      where id = new.desktop_media_id and asset_type = 'image' and approved and validated
    ) then
      raise exception 'validated hero slide requires approved, validated desktop image media' using errcode = '23514';
    end if;

    if new.mobile_media_id is not null and not exists (
      select 1 from public.media_assets
      where id = new.mobile_media_id and asset_type = 'image' and approved and validated
    ) then
      raise exception 'validated hero slide requires approved, validated mobile image media' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger touch_site_pages_updated_at before update on public.site_pages for each row execute function public.touch_updated_at();
create trigger touch_page_sections_updated_at before update on public.page_sections for each row execute function public.touch_updated_at();
create trigger touch_media_assets_updated_at before update on public.media_assets for each row execute function public.touch_updated_at();
create trigger touch_hero_slides_updated_at before update on public.hero_slides for each row execute function public.touch_updated_at();
create trigger touch_product_curations_updated_at before update on public.product_curations for each row execute function public.touch_updated_at();
create trigger touch_content_carousels_updated_at before update on public.content_carousels for each row execute function public.touch_updated_at();
create trigger touch_content_carousel_items_updated_at before update on public.content_carousel_items for each row execute function public.touch_updated_at();

create trigger validate_hero_slide_parent before insert or update on public.hero_slides for each row execute function public.validate_cms_parent_reference();
create trigger validate_product_curation_parent before insert or update on public.product_curations for each row execute function public.validate_cms_parent_reference();
create trigger validate_content_carousel_parent before insert or update on public.content_carousels for each row execute function public.validate_cms_parent_reference();

create trigger audit_site_pages after insert or update or delete on public.site_pages for each row execute function public.catalog_audit_change();
create trigger audit_page_sections after insert or update or delete on public.page_sections for each row execute function public.catalog_audit_change();
create trigger audit_media_assets after insert or update or delete on public.media_assets for each row execute function public.catalog_audit_change();
create trigger audit_hero_slides after insert or update or delete on public.hero_slides for each row execute function public.catalog_audit_change();
create trigger audit_hero_hotspots after insert or update or delete on public.hero_hotspots for each row execute function public.catalog_audit_change();
create trigger audit_product_curations after insert or update or delete on public.product_curations for each row execute function public.catalog_audit_change();
create trigger audit_product_curation_items after insert or update or delete on public.product_curation_items for each row execute function public.catalog_audit_change();
create trigger audit_content_carousels after insert or update or delete on public.content_carousels for each row execute function public.catalog_audit_change();
create trigger audit_content_carousel_items after insert or update or delete on public.content_carousel_items for each row execute function public.catalog_audit_change();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.catalog_audit_change();
create trigger audit_variants after insert or update or delete on public.variants for each row execute function public.catalog_audit_change();

revoke all on function public.catalog_audit_change() from public, anon, authenticated, nocodb_catalog_editor;
revoke all on function public.validate_cms_parent_reference() from public, anon, authenticated, nocodb_catalog_editor;
