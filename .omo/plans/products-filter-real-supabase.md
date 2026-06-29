# products-filter-real-supabase - Work Plan (v2, main-aligned)

## TL;DR

**What you'll get:** Trang `/products` filter thật gọi Supabase theo URL. UI hiện tại đã có state client (multi-select brands/categories/rooms, modal filter drawer, appliedFilters chip list) — plan này kết nối state đó xuống server thay vì giữ mock. Loại bỏ hardcode `CATEGORIES[]`, `ROOMS[]`, `FALLBACK_BRANDS[]`. Pagination thật từ `totalCount`. Search Debounce → pgroonga. Sort dropdown thật.

**Why v2:** Plan v1 viết trước UI merge của main (commits 1164e59 → 6cf6f95). Main giờ có:
- `src/components/shared/*` (StatusBadge, Chip, FavoriteButton, UnderlineTabs, SectionHeading, PaginationDots, CarouselButtons, ColorSwatches, IconTextRow, DarkCTAButton, SharedHeader)
- `products-page.tsx` đã có `selectedBrands: Set<string>`, `selectedCategories: Set<string>`, `selectedRooms: Set<string>`, `selectedClassify: Set<string>`, filter modal drawer
- `BrandSelector.tsx` nhận `brands: readonly { id, logoUrl, name }[]` (nhưng vẫn có `FALLBACK_BRANDS = ["B&B Italia", ...]` mock list fallback)
- `FilterSidebar.tsx` nhận `brands` prop và render bằng `Image` logo, nhưng `CATEGORIES[]`/`ROOMS[]` vẫn hardcode Vietnamese strings
- `SectionHeader.tsx` đã có scroll-hide + filter toggle mobile, nhưng `sortBy = "recommended"` là state cứng
- `products/page.tsx` đã join `brands` table để lấy logo_url và name
- `getVariantProducts` đã có `category` (theo `category_id` uuid) và `excludeId`

Plan này phải **không phá vỡ** UI đã có, chỉ thêm wire thật.

**Effort:** M (lớn hơn v1 chút vì phải tôn trọng shared components)
**Risk:** Medium — phải tôn trọng UI hiện có; refactor state sang URL có thể phá drawer/modal UX nếu không cẩn thận.

---

## Scope

### Must have
- **URL-driven state**: filter state được derive từ `useSearchParams` thay vì `useState`. Mỗi toggle → `router.push` URL mới, server re-fetch.
- **Query layer extension** `getVariantProducts` chấp nhận:
  - `brand?: string[]` → `query.in("filter_brand", brand)` (slug-based)
  - `subCategory?: string` → `query.eq("filter_sub_category", subCategory)`
  - `rooms?: string[]` → `query.contains("filter_room", rooms)` (PostgREST `cs`)
  - `inStock?: boolean`, `onSale?: boolean`
  - search giữ pgroonga pattern từ `search.ts`
  - Trả `{ items, totalCount }` (count bằng query head).
- **Dataset helper functions**:
  - `getBrandOptions()` → trả `{ id, slug, name, logo_url, count }[]` dựa trên `filter_brand` + `brand_name_denorm` + `brand_cldr_logo` aggregation từ `variants` table (chứ không phải `brands` table — vì `brands` table có brand không có trong CSV).
  - `getCategoryOptions()` → trả cây `{ slug, name, name_vi, subCategories }[]` từ `filter_category` + `filter_sub_category`.
  - `getRoomOptions(locale)` → enum cố định 7 phòng (không query DB), trả `{ slug, label }[]`.
- **FilterSidebar refactor**:
  - Bỏ `CATEGORIES[]` hardcode → nhận `categoryOptions: CategoryNode[]` prop
  - Bỏ `ROOMS[]` hardcode → nhận `roomOptions: RoomOption[]` prop + `selectedRooms: Set<slug>`, so khớp theo slug
  - `classifyItems` 仅 `inStock` + `onSale` (bỏ `comingSoon`, đã quyết)
  - `toggleCategory(slug)` → `onChange.category = slug` (single-select choose One, "Tất cả" = remove category)
  - `toggleRoom(slug)` → add/remove trong mảng URL `?room=...&room=...`
  - `toggleClassify` giữ theo `inStock`/`onSale` slug (thay vì theo string label)
- **BrandSelector refactor**:
  - Bỏ `FALLBACK_BRANDS[]` mock — yêu cầu `brands` prop real từ server (server luôn có 17 brand thực)
  - Match theo `slug` (filter_brand) thay vì name
  - `toggleBrand(slug)` → add/remove URL `?brand=...&brand=...`
- **products-page.tsx**:
  - Bỏ `useState` cho filter, derive từ `useSearchParams` về `selectedBrands: Set<slug>` etc
  - Tính `appliedFilters` từ URL + label lấy từ option list (đã được dịch sẵn)
  - `router.push` cập nhật URL thay đổi state → tự re-render với data mới
  - Drawer vẫn giữ (mobile UX), toggle nó vẫn đóng/mở để cập nhật URL cùng lúc
- **SearchBar**: giá trị khởi tạo từ `searchParams.get("q")`, deboun 300ms trước khi `updateFilters({q, page: 1})`
- **Pagination**: nhận `totalCount` + `pageSize`, tính `pages = Math.ceil(totalCount / pageSize)`, render thật, bỏ `[1..5] + 99` mock
- **SectionHeader**: `sortBy` derive từ URL `?sort=`, dropdown thật 4 options `priority/price_asc/price_desc/newest`
- **products/page.tsx**:
  - Đọc `searchParams: Promise<Record<string,string|string[]>>` từ route
  - zod schema parse → `FilterParams`
  - Gọi `getVariantProducts(filters)` + `getBrandOptions()` + `getCategoryOptions()` + `getRoomOptions(locale)` song song
  - Map variants → ProductGridItem (giữ logic hiện tại)
  - Truyền `brands`, `categoryOptions`, `roomOptions`, `selectedFilters`, `totalCount`, `products` xuống `<ProductsPage>`
- **Patch `messages/*`** thêm keys `Products.subCategory`, `Products.classifyInStock`, `Products.classifyOnSale`, `Products.sortPriority`, `Products.sortPriceAsc`, `Products.sortPriceDesc`, `Products.sortNewest`, `Products.roomsHeading` cho 3 locale. Extend `Rooms` namespace cho 3 locales với `familyRoom`/`kitchen`.

### Out of scope
- `comingSoon` filter (skipped)
- Filter `filter_collection_*`, `filter_is_new_arrival`, `filter_is_gifting_ideas`, `filter_price`, `filter_product_line` (bonus phase sau)
- Facet counts "(274)" cạnh room label
- Infinite scroll
- HTTP cache headers
- Migrating to `SharedHeader` from `shared/shared-header.tsx` — keep current `CatalogHeader` để tránh regression lớn; phase sau.

---

##todos

### Wave 1 — Query layer foundation

1. **[src/lib/queries/products.ts] Refactor `getVariantProducts`** to accept `{ brand?, subCategory?, rooms?, inStock?, onSale?, excludeId?, category?, sort?, page?, pageSize?, search? }` and return `{ items, totalCount: number }`.

   HOW:
   - Add new optional fields to `VariantProductQueryOptions`.
   - For each new param: branch `query`. Rooms uses `query.contains("filter_room", rooms)`. Brand uses `query.in("filter_brand", brand)`. subCategory uses `query.eq("filter_sub_category", subCategory)`. inStock/onSale use `query.eq`.
   - For search: extract `buildPgroongaFilter(search)` from task 5 and apply via `query.or(...)`.
   - Run data query + count query (`select("id", { count: "exact", head: true })`) in parallel with `Promise.all` — share the same filter chain.
   - Return type: `{ items: readonly VariantProductListItem[]; totalCount: number }`.
   - Add new types: `FilterParams`, `FilterResult`, `FilteredVariantQueryOptions`.

   EXPECTED: signature compiled by `npx tsc --noEmit`; existing callers (product detail page uses `getVariantProducts({ pageSize: 4, excludeId: variant.id })`) still work — backward compatible by optional fields.
   QA:
   - `bun test src/lib/queries/products.test.ts` — new test for `getVariantProducts({ brand: ["hay"], rooms: ["living-room"] })` passes; mock chain verifies `.in("filter_brand", ["hay"])` and `.contains("filter_room", ["living-room"])` called.
   - `npx tsc --noEmit` exit 0.

2. **[src/lib/queries/products.ts] Add `getBrandOptions`** returning `{ id, slug, name, logoUrl, count }[]`.

   HOW:
   - Query: `supabase.from("variants").select("filter_brand, brand_name_denorm, brand_cldr_logo, brand_id, brands!inner(id, logo_url, name)").eq("approved", true).eq("validated", true).not("filter_brand", "is", null)`.
   - Group in TS: `Map<filter_brand, { slug, name, brandId, brandLogoUrl, count }>` ordered by count desc.
   - `logoUrl` prefers `brand_cldr_logo` from variants row; falls back to `brands.logo_url` from the join.
   - This avoids the `FALLBACK_BRANDS` mock list of "B&B Italia" etc which doesn't exist in DB.

   EXPECTED: returns 17 brands (HAY=203, Fritz Hansen=104, USM=81, …).
   QA:
   - SQL `SELECT filter_brand, brand_name_denorm, COUNT(*) FROM variants WHERE approved AND validated GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5` matches first 5 entries.
   - `bun test src/lib/queries/products.test.ts` — new test for `getBrandOptions()` asserts 17 entries, first slug is "hay".

3. **[src/lib/queries/products.ts] Add `getCategoryOptions`** returning `{ slug, name, name_vi, subCategories: { slug, name, name_vi }[] }[]`.

   HOW:
   - Query: `supabase.from("variants").select("filter_category, filter_sub_category").eq("approved", true).eq("validated", true).not("filter_category", "is", null)`.
   - Group in TS: `Map<filter_category, { slug, subCategories: Set<slug> }>`.
   - Map slugs to i18n labels via a constant `CATEGORY_LABELS` lookup (slug → {en, vi, ko}) defined in this file — `{ "accessories": { en: "Accessories", vi: "Trang trí", ko: "액세서리" }, "furniture": ..., "lighting": ..., "usm": ... }`.
   - Same lookup for sub_category slugs (`lounges`, `chairs`, `sofas`, etc).
   - Returns 4 top categories nested with sub-categories.

   EXPECTED: tree with 4 top + 13 sub total; accessories has sub `accessories`, furniture has sub `chairs/sofas/tables/lounges/cabinets/outdoor`, lighting has sub `pendants/floor-lamps/table-lamps/wall-lamps/architectural-lighting`, usm has sub `usm` only.
   QA:
   - `bun test src/lib/queries/products.test.ts` asserts `getCategoryOptions()` returns 4 categories with `accessories.subCategories.length === 1`.
   - Existing routing tests still pass.

4. **[src/lib/queries/products.ts] Add `getRoomOptions(locale): RoomOption[]`** as a pure function (no DB query):

   ```ts
   const ROOMS: { slug: string; labels: { vi: string; en: string; ko: string } }[] = [
     { slug: "living-room", labels: { vi: "Phòng khách", en: "Living Room", ko: "거실" } },
     { slug: "family-room", labels: { vi: "Phòng gia đình", en: "Family Room", ko: "가족 방" } },
     { slug: "bedroom", labels: { vi: "Phòng ngủ", en: "Bedroom", ko: "침실" } },
     { slug: "dining-room", labels: { vi: "Phòng ăn", en: "Dining Room", ko: "다이닝룸" } },
     { slug: "office", labels: { vi: "Văn phòng", en: "Office", ko: "작업 공간" } },
     { slug: "kitchen", labels: { vi: "Kitchen", en: "Kitchen", ko: "주방" } },
     { slug: "outdoor", labels: { vi: "Ngoài trời", en: "Outdoor", ko: "야외" } },
   ];
   export function getRoomOptions(locale: Locale): RoomOption[] {
     return ROOMS.map(({ slug, labels }) => ({ slug, label: labels[locale] ?? labels.en }));
   }
   ```

   EXPECTED: returns 7 rooms locale-aware.
   QA:
   - `bun test src/lib/queries/products.test.ts` asserts `getRoomOptions("ko")[0].label === "거실"`, `getRoomOptions("vi")[3].label === "Phòng ăn"`.

5. **[src/lib/queries/search.ts] Extract reusable `buildPgroongaFilter(search, locale)`** without modifying existing search.ts behavior.

   HOW:
   - Move the `or(...)` string-building logic for `vi/en/ko` field boosting out of `search()` into a pure exported function.
   - Signature: `export function buildPgroongaFilter(search: string, locale: Locale): string | null`.
   - Returns `null` when `search.trim() === ""` (caller skips `.or`).
   - `search()` body continues to use it — pure refactor.

   EXPECTED: existing test `bun test src/lib/queries/search.test.ts` still passes; new unit test `buildPgroongaFilter("egg", "en")` returns string containing `name.&@~.egg` substring.
   QA: `bun test src/lib/queries/search.test.ts` — 4 existing tests still pass + 1 new test added.

### Wave 2 — Server page + URL parsing

6. **[src/app/[locale]/products/page.tsx] Rewrite** with `searchParams: Promise<...>` as new param.

   HOW:
   - Define zod schema `FilterParamsSchema`:
     - `brand`: `z.union([z.string(), z.array(z.string())]).optional().transform(v => Array.isArray(v) ? v : v ? [v] : undefined)`
     - `category`: `z.string().optional()`
     - `subCategory`: `z.string().optional()`
     - `room`: same array-coerce as brand
     - `classify`: same array-coerce
     - `q`: `z.string().optional()`
     - `sort`: `z.enum(["priority", "price_asc", "price_desc", "newest"]).optional()`
     - `page`: `z.coerce.number().int().min(1).optional()`
   - `const sp = await searchParams;` then `FilterParamsSchema.parse(sp)`.
   - Map `classify` array → `inStock/onSale` booleans (`classify.includes("in_stock")`, etc).
   - Call `Promise.all([getVariantProducts(filters), getBrandOptions(), getCategoryOptions(), getRoomOptions(supportedLocale)])`.
   - Build `selectedFilters` summary (mercenary — already sorted into props ready for client).
   - Pass to `<ProductsPage>` as new shape: `{ brands, categoryOptions, roomOptions, selectedFilters, totalCount, products }`.

   EXPECTED: `npx tsc --noEmit` passes; URL `/vi/products?brand=hay` returns only HAY variants.
   QA:
   - `bun dev` then `curl -s "http://localhost:3000/vi/products?brand=hay" | grep -c "Fritz Hansen"` = 0; `grep -c "HAY"` ≥ 1.
   - `curl -s "http://localhost:3000/en/products" | grep "FURNITURE PRODUCTS"` ≥ 1 (existing English title still works).
   - Real HTTP 200 for all 3 locales: `curl -o /dev/null -w "%{http_code}" "http://localhost:3000/ko/products"` = 200.

### Wave 3 — Client component refactor

7. **[src/components/products/products-page.tsx] Replace `useState` filter state with URL-derived state** while preserving drawer + appliedFilters UX.

   HOW:
   - Remove `useState` for `selectedBrands/Categories/Classify/Rooms/search/currentPage/sortBy`.
   - Receive them as props: `selectedFilters: SelectedFilters`, `categoryOptions`, `roomOptions`, `brands`, `totalCount`, `products`.
   - Keep `filtersOpen` state (UI only, doesn't go to URL).
   - Keep `favorites` state (UI only, could later move to wishlist store).
   - Use `useRouter` + `usePathname` + `useSearchParams` from `next-intl/navigation` (NOT `next/navigation`).
   - Build `updateFilters(partial: Partial<Record<string, string | string[] | null>>)`:
     - Read current `useSearchParams`,
     - Clone into new `URLSearchParams`,
     - For each new key: if value is `null` → delete key; if `string` → set; if `string[]` → delete then append each,
     - Build new URL `pathname?${newParams}`,
     - `router.push(url, { scroll: false })`.
   - Replace `toggleBrand/toggleCategory/toggleRoom/toggleClassify` with helpers calling `updateFilters`.
   - `appliedFilters` derived from `selectedFilters` end `selectedFilters` Map filtered by active label.
   - Pass `totalCount + pageSize` down to Pagination.

   EXPECTED: clicking “HAY” brand updates URL to `?brand=hay` and re-fetch happens; drawer stays open during filter (just updates URL).
   QA:
   - `bun dev` + Playwright manual: open `/vi/products`, click brand button, assert URL contains `?brand=hay` and drawer remains open.
   - `npx tsc --noEmit` exit 0.

8. **[src/components/products/FilterSidebar.tsx] Replace hardcoded arrays** + integrate `Chip` from `shared/`.

   HOW:
   - Delete `CATEGORIES[]` constant.
   - Delete `ROOMS[]` constant.
   - Keep `classifyItems` as array of `{ slug, label }` — `[{ slug: "in_stock", label: t("classifyInStock") }, { slug: "on_sale", label: t("classifyOnSale") }]` (drop `comingSoon`).
   - Accept new props: `categoryOptions: CategoryNode[]`, `roomOptions: RoomOption[]`. Existing props `selectedBrands/Categories/Rooms/Classify` switch from `Set<string>` (with labels) to `Set<slug>` (with slugs).
   - Render category list from `categoryOptions`: top-level 4 items + a `<Check>` row toggle for "All" → `toggleCategory(null)` clears URL category.
   - Render rooms from `roomOptions`: button per room with checkbox-style `<Check>` from lucide.
   - Use `shared/chip` for appliedFilters display — variant `"outline"` fits existing border styling.

   EXPECTED: category list shows 4 top + nested sub-list when category selected; rooms list shows 7 rooms with locale label.
   QA: `curl -s "http://localhost:3000/vi/products?category=furniture" | grep -c "Furniture"` ≥ 1; `/en/products?room=living-room` shows "Living Room" label selected.

9. **[src/components/products/BrandSelector.tsx] Remove `FALLBACK_BRANDS[]`** and use `brand.slug` for match.

   HOW:
   - Delete the `FALLBACK_BRANDS` constant.
   - Delete the brand-name-only `LOCAL_LOGOS` map (now using `brand.logoUrl` from DB row directly).
   - Accept `selectedBrands: Set<slug>` instead of brand name.
   - Wire `toggleBrand(brand.slug)` from `onToggleBrand(slug)` callback.
   - Add `data-testid={`brand-filter-${brand.slug}`}` on each button.
   - Render warning state if `brands` is empty: `"Đang cập nhật"` text (no silent fallback).

   EXPECTED: shows 17 real brand slugs → matching URL params.
   QA: `grep -c "Cassina" /tmp/en-products.html` = 0 (mock brands gone); `grep -o "HAY"` appears as clicking target.

10. **[src/components/products/SearchBar.tsx] Wire to URL** with 300ms debounce.

    HOW:
    - Local state: `useState(searchParams.get("q") ?? "")`.
    - `useEffect` watches local value → `setTimeout(() => updateFilters({ q: localValue, page: 1 }), 300)`. Cleanup timeout.
    - `useSearchParams` reads `q` for derived mode.
    - On blank input → `updateFilters({ q: null, page: 1 })` removes the key.

    EXPECTED: typing "egg" updates URL after 300ms.
    QA: `bun dev` + Playwright manual smoke — type "egg", wait 400ms, assert URL contains `?q=egg&page=1`.

11. **[src/components/products/Pagination.tsx] Add totalCount** + render real pages.

    HOW:
    - Accept new props: `totalCount: number`, `pageSize: number`.
    - Compute `totalPages = Math.max(1, Math.ceil(totalCount / pageSize))`.
    - Render `Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1)`; if `totalPages > 7`, render first 5 + `... + last`.
    - Clicking page N → `updateFilters({ page: String(N) })`.
    - Hide when `totalPages <= 1`.
    - Remove mock `[1,2,3,4,5]` + `99` button.

    EXPECTED: real pagination appears — e.g., `?brand=hay` (203 variants / 24 per page → 9 pages visible).
    QA: `curl -s "http://localhost:3000/vi/products?brand=hay" | grep -oE 'data-page="[^"]+"' | wc -l` returns >= 5 page buttons.

12. **[src/components/products/SectionHeader.tsx] Add sort dropdown** replacing mock `sortBy="recommended"`.

    HOW:
    - Accept `sort: ProductSort` from URL + `onSortChange(sort: ProductSort)`.
    - Render `<UnderlineTabs>` from `shared/` with 4 tabs: priority / price_asc / price_desc / newest.
    - Each tab label comes from `t("sortPriority")` / `t("sortPriceAsc")` / `t("sortPriceDesc")` / `t("sortNewest")`.
    - Clicking a tab → `onSortChange("price_asc")`.

    EXPECTED: clicking "Price: Low to High" sets `?sort=price_asc`.
    QA: `curl -s "http://localhost:3000/vi/products?sort=price_asc" | grep -c "Giá: Thấp → Cao"` ≥ 1.

### Wave 4 — i18n + tests

13. **[messages/{vi,en,ko}.json] Add i18n keys**.

    HOW:
    - Open all 3 message files.
    - In `Products` add: `subCategory`, `classifyInStock`, `classifyOnSale`, `roomsHeading`, `sortPriority`, `sortPriceAsc`, `sortPriceDesc`, `sortNewest`, `filterWarningEmpty`.
    - In `Rooms` add: `familyRoom`, `kitchen` (missing in en/ko currently).
    - Save each as valid JSON.

    EXPECTED: all 3 locales have matching keys.
    QA:
    - `python3 -c "import json; [json.load(open(f'messages/{l}.json')) for l in ('vi','en','ko')]"` exits 0.
    - `npx tsc --noEmit` exit 0 (no missing key type errors since next-intl doesn't strictly typecheck; but app build doesn't crash).

14. **[src/lib/queries/products.test.ts] Add unit tests** for new helpers.

    HOW:
    - Extend mock chain stub (`in`, `contains`, `not`, `group`, `head`).
    - Add 6 new tests: `getVariantProducts({ brand: ["hay"] })`, `getVariantProducts({ rooms: ["living-room"] })`, `getVariantProducts({ category: "furniture" })` (verify filter_category eq not category_id), `getBrandOptions()` returns 17, `getCategoryOptions()` returns 4 with sub-tree, `getRoomOptions("ko")[0].label === "거실"`.
    - Add `buildPgroongaFilter` test (assert null for empty, contains `name.&@~.egg` for "egg").

    EXPECTED: 7 new tests pass.
    QA: `bun test src/lib/queries/products.test.ts` — all tests green.

15. **[e2e/smoke-i18n.spec.ts] Add product filter assertions**.

    HOW:
    - Add 3 new tests:
      1. `/vi/products?brand=hay` body contains "HAY" string and not "Fritz Hansen".
      2. `/en/products?room=living-room` body contains "Living Room" label and `lang="en"`.
      3. `/ko/products` returns 200 with `가구 상품` title visible.
    - Use `page.getByText("...")` from Playwright.

    EXPECTED: 3 new tests pass.
    QA: `bunx playwright test e2e/smoke-i18n.spec.ts --project=chromium` shows 3 added tests green.

16. **[e2e/product-navigation.spec.ts] Add URL-driven filter flow test**.

    HOW:
    - Add a test that opens `/vi/products`, clicks `getByTestId("brand-filter-hay")`, asserts `await expect(page).toHaveURL(/brand=hay/)` and grid re-renders with up to 24 items on first page.

    EXPECTED: test passes via real Supabase fetch.
    QA: `bunx playwright test e2e/product-navigation.spec.ts --project=chromium` green.

### Wave 5 — Verification

17. **Manual smoke `bun dev`** with filter URLs.

    HOW: Test list:
    - `/vi/products` — default page,sortable result
    - `/vi/products?brand=hay` — only HAY
    - `/vi/products?room=living-room` — only variants có living-room trong filter_room
    - `/vi/products?brand=hay&room=living-room&sort=price_asc` — combined
    - `/vi/products?q=egg` — pgroonga search
    - `/vi/products?category=furniture&subCategory=sofas` — nested category + sub
    - `/en/products?brand=usm` — English equivalent
    - `/ko/products` — Korean title visible

    Cross-check: query Supabase directly with `SELECT COUNT(*) FROM variants WHERE approved AND validated AND filter_brand='hay' AND 'living-room' = ANY(filter_room)` and verify `pagination` page count matches `Math.ceil(count/24)`.

    EXPECTED: counts match SQL.
    QA: SQL count via SQLite-style verification command.

18. **`npx tsc --noEmit` + `bun run test`**.

    HOW: run typecheck and full test suite.
    EXPECTED: 0 type errors; new tests pass; no new failures beyond pre-existing 6 amis-sync ones.

---

## Glossary

- `FilterParams`: `{ brand?: string[]; category?: string; subCategory?: string; rooms?: string[]; inStock?: boolean; onSale?: boolean; sort?: ProductSort; page?: number; pageSize?: number; search?: string }`
- `FilterResult`: `{ items: readonly VariantProductListItem[]; totalCount: number }`
- `BrandOption`: `{ id: string; slug: string; name: string; logoUrl: string | null; count: number }`
- `CategoryNode`: `{ slug: string; name: string; name_vi: string; subCategories: { slug: string; name: string; name_vi: string }[] }`
- `RoomOption`: `{ slug: string; label: string }`
- `SelectedFilters`: `{ brand: Set<string>; category: string | null; subCategory: string | null; rooms: Set<string>; inStock: boolean; onSale: boolean; search: string; sort: ProductSort; page: number; pageSize: number }`

## Code conventions

- No `as any`. No `@ts-ignore`. No empty catch.
- Use `next-intl/navigation` for `useRouter/usePathname/useSearchParams`, NOT `next/navigation` — locale-aware.
- Reuse `shared/Chip`, `shared/StatusBadge`, `shared/FavoriteButton`, `shared/UnderlineTabs` where they already fit pattern.
- PostgREST operators: `in` (multi-eq), `contains` (array ⊇), `or` for pgroonga.
- pgroonga search: rpc `pgroonga_query_escape` then `or(`name.&@~.${escaped},finish_vi.&@~.${escaped},...`)`.

## Verification commands
- `npx tsc --noEmit`
- `bun run test`
- `bun dev` + curl `/vi/products?brand=hay` (body contains "HAY", no "Fritz Hansen")
- `bunx playwright test e2e/smoke-i18n.spec.ts e2e/product-navigation.spec.ts --project=chromium`
- SQL: `SELECT COUNT(*) FROM variants WHERE approved=true AND validated=true AND filter_brand='hay'`