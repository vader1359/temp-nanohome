do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nocodb_catalog_editor') then
    create role nocodb_catalog_editor nologin noinherit;
  end if;
end;
$$;

grant usage on schema public to nocodb_catalog_editor;
grant select, insert, update, delete on public.site_pages, public.page_sections, public.media_assets, public.hero_slides, public.hero_hotspots, public.product_curations, public.product_curation_items, public.content_carousels, public.content_carousel_items to nocodb_catalog_editor;
grant usage, select on all sequences in schema public to nocodb_catalog_editor;
grant select on public.brands, public.categories, public.designers, public.products, public.variants to nocodb_catalog_editor;
grant update (name, name_vi, name_ko, description, description_vi, description_ko, priority, product_line, size, slug, slug_vi, slug_ko, brand_id, category_id, designer_id, approved, validated) on public.products to nocodb_catalog_editor;
grant update (name, name_vi, name_ko, short_name, short_name_vi, short_name_ko, description, description_vi, description_ko, finish, finish_vi, finish_ko, size, slug, slug_vi, slug_ko, packshot_url, gallery_urls, media_closeup, media_lifestyle_1, media_lifestyle_2, media_long, priority, product_id, brand_id, category_id, designer_id, approved, validated) on public.variants to nocodb_catalog_editor;

alter table public.site_pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.media_assets enable row level security;
alter table public.hero_slides enable row level security;
alter table public.hero_hotspots enable row level security;
alter table public.product_curations enable row level security;
alter table public.product_curation_items enable row level security;
alter table public.content_carousels enable row level security;
alter table public.content_carousel_items enable row level security;
alter table public.catalog_audit_log enable row level security;

create policy nocodb_catalog_editor_manage_site_pages on public.site_pages for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_page_sections on public.page_sections for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_media_assets on public.media_assets for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_hero_slides on public.hero_slides for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_hero_hotspots on public.hero_hotspots for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_product_curations on public.product_curations for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_product_curation_items on public.product_curation_items for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_content_carousels on public.content_carousels for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_manage_content_carousel_items on public.content_carousel_items for all to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_update_products on public.products for update to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_update_variants on public.variants for update to nocodb_catalog_editor using (true) with check (true);
create policy nocodb_catalog_editor_read_products on public.products for select to nocodb_catalog_editor using (true);
create policy nocodb_catalog_editor_read_variants on public.variants for select to nocodb_catalog_editor using (true);

grant select on public.brands, public.categories, public.designers, public.news, public.catalogs, public.products, public.variants, public.site_pages, public.page_sections, public.media_assets, public.hero_slides, public.hero_hotspots, public.product_curations, public.product_curation_items, public.content_carousels, public.content_carousel_items to anon, authenticated;

create policy published_site_pages_read on public.site_pages for select to anon, authenticated using (approved and validated);
create policy published_page_sections_read on public.page_sections for select to anon, authenticated using (
  enabled and approved and validated and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  and exists (select 1 from public.site_pages where id = page_sections.page_id and approved and validated)
);
create policy published_media_assets_read on public.media_assets for select to anon, authenticated using (approved and validated);
create policy published_hero_slides_read on public.hero_slides for select to anon, authenticated using (
  approved and validated and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) and exists (
    select 1 from public.page_sections join public.site_pages on site_pages.id = page_sections.page_id
    where page_sections.id = hero_slides.section_id and page_sections.section_type = 'hero' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now()) and site_pages.approved and site_pages.validated
  )
);
create policy published_hero_hotspots_read on public.hero_hotspots for select to anon, authenticated using (
  exists (
    select 1 from public.hero_slides
    join public.page_sections on page_sections.id = hero_slides.section_id
    join public.site_pages on site_pages.id = page_sections.page_id
    where hero_slides.id = hero_hotspots.hero_slide_id
      and hero_slides.approved and hero_slides.validated
      and (hero_slides.starts_at is null or hero_slides.starts_at <= now()) and (hero_slides.ends_at is null or hero_slides.ends_at > now())
      and page_sections.section_type = 'hero' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now())
      and site_pages.approved and site_pages.validated
  )
);
create policy published_product_curations_read on public.product_curations for select to anon, authenticated using (
  approved and validated and exists (
    select 1 from public.page_sections join public.site_pages on site_pages.id = page_sections.page_id
    where page_sections.id = product_curations.section_id and page_sections.section_type = 'product_curation' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now()) and site_pages.approved and site_pages.validated
  )
);
create policy published_product_curation_items_read on public.product_curation_items for select to anon, authenticated using (
  exists (
    select 1 from public.product_curations
    join public.page_sections on page_sections.id = product_curations.section_id
    join public.site_pages on site_pages.id = page_sections.page_id
    where product_curations.id = product_curation_items.curation_id
      and product_curations.approved and product_curations.validated
      and page_sections.section_type = 'product_curation' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now())
      and site_pages.approved and site_pages.validated
  )
);
create policy published_content_carousels_read on public.content_carousels for select to anon, authenticated using (
  approved and validated and exists (
    select 1 from public.page_sections join public.site_pages on site_pages.id = page_sections.page_id
    where page_sections.id = content_carousels.section_id and page_sections.section_type = 'content_carousel' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now()) and site_pages.approved and site_pages.validated
  )
);
create policy published_content_carousel_items_read on public.content_carousel_items for select to anon, authenticated using (
  approved and validated and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  and exists (
    select 1 from public.content_carousels
    join public.page_sections on page_sections.id = content_carousels.section_id
    join public.site_pages on site_pages.id = page_sections.page_id
    where content_carousels.id = content_carousel_items.carousel_id
      and content_carousels.approved and content_carousels.validated
      and page_sections.section_type = 'content_carousel' and page_sections.enabled and page_sections.approved and page_sections.validated
      and (page_sections.starts_at is null or page_sections.starts_at <= now()) and (page_sections.ends_at is null or page_sections.ends_at > now())
      and site_pages.approved and site_pages.validated
  )
);
