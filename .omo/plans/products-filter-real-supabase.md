# products-filter-real-supabase - Work Plan

## TL;DR

**What you'll get:** Trang `/products` có filter thật gọi Supabase, không còn mock. URL-driven (shareable + back/forward). Brand list load từ DB, không hardcode 17 brand mock. Pagination tính từ `totalCount` thật. Search forward xuống server dùng pgroonga. Tất cả UI label i18n (vi/en/ko) theo message file.

**Why this approach:** URL search params → server-component fetch → re-render. Đây là pattern Next.js 16 App Router khuyến nghị cho filter (shareable, server-rendered, SEO friendly). State client dùng `useRouter().push` để cập nhật URL; không cần Server Action phức tạp. Filter data đã có trong DB sau migration `add_variants_csv_columns` (1061 variants có `filter_room`, 2210 có `filter_brand`, 17 brand, 4 `filter_category`, 13 `filter_sub_category`, 7 room).

**What it will NOT do:** Không thêm `comingSoon` filter (user đã skip — sẽ có cột `coming_soon_at` nếu sau này cần). Không sort tổng hợp nhiều field. Không infinite scroll — giữ pagination trad. Không filter theo `filter_collection_*`/`filter_is_new_arrival`/`filter_is_gifting_ideas` (bonus, để phase sau nếu UI cần).

**Effort:** M (5 file edit + 1 test + 1 message file update)
**Risk:** Low — Back-end đã có data + index, chỉ thay UI/query wiring. Test e2e hiện có cover locale, mở rộng thêm filter assertion là đủ.

**Decisions to sanity-check:**
1. URL multi-value: `?brand=hay&brand=fritz-hansen` (lặp param) thay vì `?brand=hay,fritz-hansen`. Lý do: Next.js `searchParams` mặc định parse thành array, idiom App Router.
2. `filter_brand` (text slug) làm match, không join `brands.id`. Lý do: đã có index trên `filter_brand`, slug unique trong thực tế, tránh join.
3. `filter_category` ở cấp 1 (4 nhóm `accessories/furniture/lighting/usm`), `filter_sub_category` ở cấp 2 (13 slug) — render cả hai ladder trong sidebar, sub-category phụ thuộc category chọn.
4. Sort giữ `priority | price_asc | price_desc | newest` simple 1 field, không chain.
5. Mặc định perPage = 24, page query `?page=N`. `totalCount` lấy qua `.select("*",{count:"exact",head:false})` song song với data fetch.
6. Classify toggle: chỉ `inStock` (`in_stock=true`) và `onSale` (`on_sale=true`). `comingSoon` bỏ khỏi UI để tránh regression.

Your next move: approve, hoặc yêu cầu review Momus. Full execution detail follows below.

---

## Scope

### Must have
- Route `src/app/[locale]/products/page.tsx` đọc `searchParams` (Promise), parse bằng zod schema, gọi `getVariantProducts(filters)` song song với `getBrandOptions(locale)` và `getCategoryOptions(locale)`. Truyền xuống `<ProductsPage>` như prop.
- Query layer `src/lib/queries/products.ts` mở rộng `getVariantProducts` nhận `brand?: string[]`, `category?: string`, `subCategory?: string`, `rooms?: string[]`, `inStock?: boolean`, `onSale?: boolean`, `sort?: ProductSort`, `page?: number`, `pageSize?: number`, `search?: string`. Trả `{ items, totalCount }`.
- Filter `search` dùng pgroonga RPC `pgroonga_query_escape` rồi `or` trên `name, finish_vi, finish, sku` (pattern đã có sẵn `src/lib/queries/search.ts`).
- Helper mới `getBrandOptions`: `select filter_brand, brand_name_denorm from variants where approved=true and validated=true and filter_brand is not null group by filter_brand, brand_name_denorm order by count(*) desc`. Trả mảng `{slug, name, count}[]`.
- Helper mới `getCategoryOptions`: `select distinct filter_category, filter_sub_category from variants where approved=true and validated=true`. Group trong TS thành cây.
- Helper mới `getRoomOptions(locale)`: trả 7 room cố định (CSV enum) kèm label EN + VI + KO. Không query DB (set cố định) vì rooms enum cố định trong CSV: `living-room/family-room/bedroom/dining-room/office/kitchen/outdoor`. Map VI: `Phòng khách/Phòng gia đình/Phòng ngủ/Phòng ăn/Văn phòng/Kitchen/Ngoài trời`. KO: `거실/가족 방/침실/다이닝룸/작업 공간/주방/야외`.
- `src/components/products/products-page.tsx` bỏ mock state (`selectedCategory/Classify/Rooms/search/currentPage/sortBy`). Nhận tất cả từ props. Filter change → `useRouter().push` URL với searchParams mới. Page còn client để push URL, nhưng state fixed = URL-derived.
- `src/components/products/FilterSidebar.tsx` bỏ hardcode `CATEGORIES[]`/`ROOMS[]`. Nhận `categoryOptions`, `roomOptions`, `selectedFilters`, `onChange` props. Render base trên label locale-active.
- `src/components/products/BrandSelector.tsx` bỏ hardcode `BRANDS[]`. Nhận `brandOptions` prop + multi-select state từ `searchParams.brand`. Toggle button add/remove.
- `src/components/products/AppliedFilters.tsx` vẫn ok, render mảng labels từ `selectedFilters` (đã được dịch).
- `src/components/products/SearchBar.tsx` forward value xuống URL via `router.push` (debounce 300ms). Riêng search vì else URL đổi quá nhanh.
- `src/components/products/Pagination.tsx` nhận `totalCount`, `pageSize`, `currentPage`. Tính số trang thật từ `Math.ceil(totalCount/pageSize)`. Bỏ mock `99`.
- `src/components/products/SectionHeader.tsx` nhận `sort: ProductSort` từ URL, dropdown sort thật.
- URL state: `?brand=...&brand=...&category=...&subCategory=...&room=...&room=...&classify=inStock&classify=onSale&q=...&sort=price_asc&page=2`.
- i18n: thêm keys `Products.subCategory`, `Products.classifyInStock`, `Products.classifyOnSale`, `Products.roomsHeading`, `Products.sort{Priority,PriceAsc,PriceDesc,Newest}`. Extend `Rooms` namespace nếu thiếu.

### Out of scope
- `comingSoon` filter (skipped).
- Filter `filter_collection_*`, `filter_is_new_arrival`, `filter_is_gifting_ideas`, `filter_price`, `filter_product_line` (bonus phase sau).
- Facet counts (e.g. hiển thị `(274)` cạnh room label) — phase sau nếu cần.
- Infinite scroll, cursor pagination.
- Sort tổng hợp nhiều field.
- Cache HTTP (Cache-Control) — để sau, scope riêng.

---

## Todos

### Wave 1 — Query layer foundation

1. **[src/lib/queries/products.ts] Refactor `getVariantProducts`** to accept `{ brand?, category?, subCategory?, rooms?, inStock?, onSale?, sort?, page?, pageSize?, search? }` and return `{ items, totalCount }`. Add `in`/`ilike`/`eq`/`contains` chainers. Use parallel `.select("id",{count:"exact",head:true})` call for totalCount.

   HOW:
   - Extend `getVariantProducts` signature with new optional fields.
   - For `brand`: `query.in("filter_brand", brand)`.
   - For `category`: `query.eq("filter_category", category)`.
   - For `subCategory`: `query.eq("filter_sub_category", subCategory)`.
   - For `rooms`: `query.contains("filter_room", rooms)` (PostgREST `cs` op).
   - For `inStock`: `query.eq("in_stock", true)`.
   - For `onSale`: `query.eq("on_sale", true)`.
   - For `search`: extract `buildPgroongaFilter(search, locale)` (task 5) and use it here.
   - Build data query + count query sharing same filter; `Promise.all` them.
   - Export new types `FilterParams`, `FilterResult`.

   EXPECTED: signature compiled by `npx tsc --noEmit`; mock unit test confirms call chain.
   QA: `bun test src/lib/queries/products.test.ts` shows new test for `getVariantProducts({brand:["hay"]})` passes — mocks verify `.in("filter_brand", ["hay"])` was called.

2. **[src/lib/queries/products.ts] Add `getBrandOptions`**. Use Supabase query:
   ```ts
   supabase.from("variants")
     .select("filter_brand, brand_name_denorm")
     .eq("approved", true).eq("validated", true)
     .not("filter_brand", "is", null);
   ```
   Group in TS: `Map<slug, {slug, name, count}>` ordered by count desc.

   EXPECTED: type-safe; returns `BrandOption[]`.
   QA: SQL `SELECT filter_brand, brand_name_denorm, COUNT(*) FROM variants WHERE approved AND validated GROUP BY 1,2 ORDER BY 3 DESC` matches first item count (HAY=203).

3. **[src/lib/queries/products.ts] Add `getCategoryOptions`**. Query `select distinct filter_category, filter_sub_category` where `approved && validated`. Group into tree `{category, subCategories[]}`.

   EXPECTED: returns 4 top categories with sub-list.
   QA: SQL `SELECT DISTINCT filter_category, filter_sub_category FROM variants WHERE approved AND validated` returns ~14 rows; grouping in TS yields tree with `accessories` parent containing `accessories` sub.

4. **[src/lib/queries/products.ts] Add `getRoomOptions(locale): RoomOption[]`**. Hardcoded enum (no DB query):
   ```ts
   const ROOMS = [
     {slug:'living-room', vi:'Phòng khách', en:'Living Room', ko:'거실'},
     {slug:'family-room', vi:'Phòng gia đình', en:'Family Room', ko:'가족 방'},
     {slug:'bedroom', vi:'Phòng ngủ', en:'Bedroom', ko:'침실'},
     {slug:'dining-room', vi:'Phòng ăn', en:'Dining Room', ko:'다이닝룸'},
     {slug:'office', vi:'Văn phòng', en:'Office', ko:'작업 공간'},
     {slug:'kitchen', vi:'Kitchen', en:'Kitchen', ko:'주방'},
     {slug:'outdoor', vi:'Ngoài trời', en:'Outdoor', ko:'야외'},
   ];
   ```
   Return mapped with locale-specific `label`.

   EXPECTED: returns 7 rooms with EN+VI+KO labels.
   QA: `bun test src/lib/queries/products.test.ts` shows `getRoomOptions('ko')[0].label === '거실'`.

5. **[src/lib/queries/search.ts + src/lib/queries/products.ts] Extract `buildPgroongaFilter`** into reusable exported function returning PostgREST `or` string given `(search, locale)`. Used by `search.ts` and `getVariantProducts`.

   HOW:
   - Move logic from `search.ts` lines that build the `or(...)` filter into a shared helper in a new `src/lib/queries/search-filter.ts` (or as exported function in `search.ts`).
   - Signature: `export function buildPgroongaFilter(search: string, locale: Locale): string | null` — returns null when search empty, otherwise the `or` filter string ready to pass to `.or(...)`.
   - `search.ts` continues using same logic — no behavior change.

   EXPECTED: `search.ts` continues to pass existing test `bun test src/lib/queries/search.test.ts`; new helper unit-tested.
   QA: unit test `buildPgroongaFilter("egg", "en")` returns string containing `name.&@~.` substring.

### Wave 2 — Server page + URL parsing

6. **[src/app/[locale]/products/page.tsx] Rewrite** to: `export default async function ProductsRoute({ params, searchParams }: PageProps)`. Use zod schema to parse `searchParams`. Call `getVariantProducts(filters)` + parallel `getBrandOptions`, `getCategoryOptions`, `getRoomOptions` via `Promise.all`. Map `VariantProductListItem` → `ProductGridItem` (existing logic). Pass all props to `<ProductsPage>`.

   HOW:
   - Define zod schema at module top: `FilterParamsSchema = z.object({ brand: z.union([z.string(), z.array(z.string())]).optional().transform(v => Array.isArray(v) ? v : v ? [v] : undefined), category: z.string().optional(), subCategory: z.string().optional(), room: z.union([z.string(), z.array(z.string())]).optional().transform(...same array coerce...), classify: z.union([z.string(), z.array(z.string())]).optional().transform(...), q: z.string().optional(), sort: z.enum(["priority","price_asc","price_desc","newest"]).optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() })`.
   - Parse `searchParams` (Promise resolves to object).
   - Map classify → `inStock`/`onSale` flags.
   - Call `Promise.all([getVariantProducts(filters), getBrandOptions(), getCategoryOptions(), getRoomOptions(locale)])`.
   - Serialize selected filters to pass down.

   EXPECTED: `npx tsc --noEmit` passes; URL `/vi/products?brand=hay` returns only HAY variants.
   QA: `curl -s "http://localhost:3000/vi/products?brand=hay" | grep -c "Fritz Hansen"` returns 0; `grep -c "HAY"` returns >= 1.

### Wave 3 — Client component refactor

7. **[src/components/products/products-page.tsx] Replace mock state** with URL-derived props. Add `useRouter` + `usePathname` + `useSearchParams` from `next-intl/navigation`. Build `updateFilters(partial: Partial<FilterParams>)` helper that merges into URL and `router.push`. Pagination + filter all go through this helper.

   HOW:
   - Remove `useState` for category/room/classify/search/sort/page.
   - Receive all as props from server.
   - Implement `updateFilters(partial)`: merges with current `useSearchParams` (overwriting keys, removing keys when value is null/empty, treating arrays specially — replace all values for that key, then delete + add).
   - `router.push(pathname + "?" + newSearch.toString(), {scroll: false})`.

   EXPECTED: clicking brand “HAY” updates URL to `?brand=hay` and triggers server re-fetch; pagination updates `?page=2`.
   QA: manual `bun dev` smoke — open `/vi/products`, click a brand button, assert `useSearchParams().get("brand") === "hay"`.

8. **[src/components/products/FilterSidebar.tsx] Replace hardcoded arrays** with props: `categoryOptions: CategoryNode[]`, `roomOptions: RoomOption[]`, `selected: SelectedFilters`, `onChange: (next: Partial<SelectedFilters>) => void`.

   HOW:
   - Delete `CATEGORIES[]` and `ROOMS[]` constants.
   - Render `categoryOptions.map(cat => <button onClick={() => onChange({category: cat.slug})}>)`.
   - For sub-category ladder: when `selected.category` is set, render `category.subCategories` list below.
   - For rooms: render `roomOptions.map(room => <button onClick={() => toggleRoom(room.slug)}>)`.
   - For classify: keep 2 toggles (inStock, onSale) — wire to `onChange({inStock: !selected.inStock})`.

   EXPECTED: category list shows 4 top + nested sub-list; rooms list shows 7 rooms with locale label; selected state visual reflects URL.
   QA: `curl -s "http://localhost:3000/vi/products?category=furniture"` shows `furniture` button highlighted; sub-category list visible below.

9. **[src/components/products/BrandSelector.tsx] Replace hardcoded BRANDS[]** with `brandOptions: BrandOption[]` prop + `selectedBrands: string[]` + `onToggleBrand(slug)`.

   HOW:
   - Delete `BRANDS[]` constant.
   - Render `brandOptions.map(b => <button data-testid={`brand-filter-${b.slug}`} onClick={() => onToggleBrand(b.slug)} className={selectedBrands.includes(b.slug) ? "active" : ""}>)`.
   - Active class adds `bg-nh-ink text-white`.

   EXPECTED: shows 17 real brands (HAY, Fritz Hansen, USM, ...) not mock (B&B Italia, Cassina, ...); multi-select via URL `?brand=X&brand=Y`.
   QA: `curl -s "http://localhost:3000/vi/products" | grep -o "HAY" | head -1` returns "HAY"; `grep -o "Cassina"` returns nothing.

10. **[src/components/products/SearchBar.tsx] Wire to URL** with 300ms debounce. Read initial value from `searchParams.q`. On change push `?q=...&page=1`.

    HOW:
    - `useState(searchParams.get("q") ?? "")` for local input value.
    - `useEffect` watch local value → setTimeout 300ms → `updateFilters({q: localValue, page: 1})`.
    - Cleanup timeout on unmount/re-render.

    EXPECTED: typing “egg” updates URL after 300ms; results filter via pgroonga.
    QA: manual smoke — type "egg" in search, wait 400ms, assert URL contains `?q=egg&page=1`.

11. **[src/components/products/Pagination.tsx] Add totalCount prop**. Compute `pages = Math.ceil(totalCount/pageSize)`. Render only real pages; remove mock `99`. Hide when pages <= 1.

    HOW:
    - Replace `useState` `pages = [1,2,3,4,5]` with `Array.from({length: Math.min(totalPages, 7)}, (_, i) => i+1)` (or proper ellipsis logic).
    - Clicking page N → `updateFilters({page: N})`.
    - If `totalCount <= pageSize`, render nothing.

    EXPECTED: shows real pagination — e.g. if 203 HAY variants / 24 per page → 9 pages.
    QA: `curl -s "http://localhost:3000/vi/products?brand=hay"` HTML contains pagination with up to 9 pages; mock `99` gone.

12. **[src/components/products/SectionHeader.tsx] Add sort dropdown**. `sort: ProductSort`, `onSortChange`. Replace mock `sortBy="recommended"` with URL-driven. Use native `<select>` or Radix listbox.

    HOW:
    - Add `useState` for dropdown open.
    - Render 4 options: priority/price_asc/price_desc/newest (translated labels).
    - Clicking option → `updateFilters({sort: "price_asc"})`.

    EXPECTED: clicking “Price: Low to High” sets `?sort=price_asc`.
    QA: `curl -s "http://localhost:3000/vi/products?sort=price_asc" | grep -c "price_asc"` confirms URL-driven (the label rendered is i18n Vietnamese "Giá: Thấp → Cao").

### Wave 4 — i18n + tests

13. **[messages/{vi,en,ko}.json] Add i18n keys**: `Products.subCategory`, `Products.classifyInStock`, `Products.classifyOnSale`, `Products.roomsHeading`, `Products.sortPriority`, `Products.sortPriceAsc`, `Products.sortPriceDesc`, `Products.sortNewest`. Extend `Rooms` namespace with `familyRoom`, `kitchen` if missing in all locales.

    HOW:
    - Open each of `messages/vi.json`, `messages/en.json`, `messages/ko.json`.
    - Append keys to `Products` object.
    - For `Rooms`, check `familyRoom`/`kitchen` exist (`vi` has them; `en`/`ko` may not — add).
    - Run `json.load` quick sanity to ensure valid JSON.

    EXPECTED: JSON parses for all 3 locales; key count matches across.
    QA: `python3 -c "import json; [json.load(open(f'messages/{l}.json')) for l in ('vi','en','ko')]"` exits 0.

14. **[src/lib/queries/products.test.ts] Add unit tests** for `getVariantProducts` with `brand=['hay']`, `rooms=['living-room']`, `category='furniture'` — mock supabase chain like `variants.test.ts`. Add tests for `getBrandOptions`, `getCategoryOptions`, `getRoomOptions`, `buildPgroongaFilter`.

    HOW:
    - Extend mock chain stub (like `variants.test.ts`) with `in`, `contains`, `not`, `group`。
    - For each new helper, assert the expected chain methods are called with right args.
    - For `buildPgroongaFilter`, assert `null` for empty search + substring match for non-empty.

    EXPECTED: 4+ new tests pass.
    QA: `bun test src/lib/queries/products.test.ts` shows all green, no eslint errors.

15. **[e2e/smoke-i18n.spec.ts] Add product filter assertions**:
    - `/vi/products?brand=hay` body contains “HAY” brand and no “Fritz Hansen”.
    - `/en/products?room=living-room` body contains English room label and `lang="en"`.
    - `/ko/products` returns 200, body contains Korean `Products.title` (가구 상품).

    HOW:
    - Add 3 new tests using existing Playwright fixtures.
    - For room filter on EN route: assert `getByText("Living Room", { exact: false }).first()` visible.
    - For Korean: assert `getByText("가구 상품")` visible.

    EXPECTED: 3 new tests pass; existing tests still pass.
    QA: `bunx playwright test e2e/smoke-i18n.spec.ts --project=chromium` shows all green.

16. **[e2e/product-navigation.spec.ts] Add URL-driven filter navigation test**: open `/vi/products`, click brand button (selector by data-testid `brand-filter-hay`), assert URL updates to include `?brand=hay` and grid count drops to ≤ 24 (first page).

    HOW:
    - Read existing e2e/product-navigation.spec.ts to see existing flow.
    - Add test that uses `page.getByTestId("brand-filter-hay")` then `await expect(page).toHaveURL(/brand=hay/)`.

    EXPECTED: selector-based assertion passes.
    QA: `bunx playwright test e2e/product-navigation.spec.ts --project=chromium` green.

### Wave 5 — Verification

17. **Manual smoke `bun dev`**: test `/vi/products?brand=hay&room=living-room&sort=price_asc` with real Supabase. Verify returns filtered list + correct pagination.

    HOW:
    - Start `bun dev`.
    - Open each URL in browser: `/vi/products?brand=hay`, `/vi/products?room=living-room`, `/vi/products?brand=hay&room=living-room&sort=price_asc`, `/en/products?brand=usm`, `/ko/products?onSale=true`.
    - Cross-check pagination count vs SQL: `SELECT COUNT(*) FROM variants WHERE approved=true AND validated=true AND filter_brand='hay' AND 'living-room' = ANY(filter_room)`.

    EXPECTED: real network round-trip, count matches SQL.
    QA: SQL count matches `Math.ceil(totalCount/pageSize)` from page HTML.

18. **`npx tsc --noEmit`** must pass. **`bun run test`** all green except known pre-existing amis-sync env failures.

    HOW:
    - Run typecheck + full suite.
    - Compare failure count to pre-change baseline (6 amis-sync failures unrelated).

    EXPECTED: 0 type errors; new tests pass; no new test failures introduced by this change.
    QA: `npx tsc --noEmit && bun run test 2>&1 | grep -E "Test Files|Tests"` shows same `6 failed | X passed` base, with X increased by new tests.

---

## Glossary

- `FilterParams`: `{ brand?: string[]; category?: string; subCategory?: string; rooms?: string[]; inStock?: boolean; onSale?: boolean; sort?: ProductSort; page?: number; pageSize?: number; search?: string }`
- `FilterResult`: `{ items: readonly VariantProductListItem[]; totalCount: number }`
- `BrandOption`: `{ slug: string; name: string; count: number }`
- `CategoryNode`: `{ slug: string; name: string; name_vi: string; subCategories: { slug: string; name: string; name_vi: string }[] }`
- `RoomOption`: `{ slug: string; label: string }` — label locale-dependent.
- `SelectedFilters`: same shape as `FilterParams` but pulled from URL.

## Code conventions

- No `as any`. No `@ts-ignore`. No empty catch. Type-safe throughout.
- `getVariantProducts` already in repo — extended, not duplicated.
- All client components keep `"use client"`.
- Follow existing `useTranslations("Products")` pattern (see `BrandSelector.tsx`).
- PostgREST `in` operator for arrays: `query.in("filter_brand", ["hay","fritz-hansen"])`.
- PostgREST `contains` for text[] `filter_room`: `query.contains("filter_room", ["living-room"])` (returns variants whose filter_room array ⊇ passed array).
- pgroonga search: pattern from `src/lib/queries/search.ts` — `rpc("pgroonga_query_escape", {query})` returns escaped string; then `or(`name.&@~.${escaped},finish_vi.&@~.${escaped},...`)`.

## Verification commands
- `npx tsc --noEmit`
- `bun run test`
- `bun dev` + `curl http://localhost:3000/vi/products?brand=hay` — body contains “HAY”, no “Fritz Hansen”
- SQL direct: `SELECT COUNT(*) FROM variants WHERE approved AND validated AND filter_brand='hay'`