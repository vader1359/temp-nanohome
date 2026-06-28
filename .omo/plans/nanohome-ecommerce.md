# nanohome-ecommerce - Work Plan

## TL;DR (For humans)

**What you'll get:** A fully functional bilingual (Vietnamese + English) e-commerce website for nanoHome premium furniture — product catalog, search, cart, checkout form, authentication, and automated price/stock sync from AMIS CRM. Built on Next.js 16 with Supabase, deployed on Vercel. Code structure is complete and tested; visual UI design (colors, layout polish, Figma implementation) is a separate follow-up plan.

**Why this approach:** Three load-bearing decisions: (1) Next.js 16 App Router with React Server Components for SEO + performance, with next-intl for bilingual routing matching the live nanohome.vn structure; (2) Hybrid cart (guest localStorage + authenticated Supabase persistence with login merge) because it captures sales from casual browsers while giving logged-in users persistence; (3) One-way AMIS→Supabase sync via Vercel Cron because the user has AMIS OpenAPI credentials and needs automated price/stock updates without bidirectional complexity.

**What it will NOT do:** No Figma UI implementation (separate plan), no ZaloPay payment processing (deferred — checkout captures orders as quotes), no Korean locale (deferred), no Rooms feature (no data), no admin dashboard (Supabase Studio for v1), no transactional email, no wishlist/reviews/multi-currency.

**Effort:** XL
**Risk:** Medium — bleeding-edge stack (Next 16 + React 19 + Tailwind v4 + React Compiler) has compatibility surface area; mitigated by per-todo smoke tests.
**Decisions to sanity-check:** (1) Vercel Cron for AMIS sync vs Supabase Edge Function — chose Vercel Cron for code-sharing, reversible. (2) Stock not decremented at order capture (no payment = no commitment) — manual review via Supabase Studio. (3) next/image with string-based Cloudinary transforms instead of next-cloudinary loader — simpler, fewer deps, user's explicit choice.

Your next move: approve the plan, or run a high-accuracy review. Full execution detail follows below.

---

> TL;DR (machine): XL effort, Medium risk, 21 todos across 6 waves — nanoHome bilingual e-commerce code structure on Next 16 + Supabase + Tailwind v4, with AMIS sync, hybrid cart, checkout form, auth, search, SEO. No UI/Figma, no payment, no Korean.

## Scope
### Must have
- Next.js 16.2.7 App Router project scaffolded with TypeScript, Tailwind v4.3.1, React Compiler enabled, Turbopack
- next-intl i18n with vi + en locales, `[locale]` dynamic segment, middleware locale routing
- Three Supabase clients (browser-anon, server-anon-cookies, server-service-role-strict) with server-only guards
- Supabase schema extensions: carts, cart_items, orders, order_items, order_status_history, profiles (with auth trigger), amis_sync_log — all RLS-enabled
- pgroonga Vietnamese full-text search extension + indexes on products + variants
- Data access layer (`lib/queries/*`) with typed query functions for all entities
- Route shells: error.tsx, not-found.tsx, loading.tsx, global-error.tsx at root + `[locale]` levels
- Homepage route with data fetching for hero/stylist picks/design trends/showrooms sections
- Product list routes: /products, /products/category/{slug}, /brands/{slug}/products, /designers/{slug}/products, /clearance — with filter/sort/pagination via URL search params
- Product detail route: /products/{airtableId}/{slug} — variant selector, gallery, price/stock, related products, news cross-link
- News list + detail routes: /news, /news/{airtableId}
- Hybrid cart: guest localStorage (zustand persist) + authed Supabase carts/cart_items, merge on login (dedup by variant_id, sum quantities, idempotent)
- Checkout form: react-hook-form + zod, captures order into orders/order_items with status=pending, NO payment processing
- Auth: Supabase Auth email/password + Google OAuth + Facebook OAuth, profile auto-created via DB trigger, OAuth callback at /auth/callback (outside [locale])
- AMIS one-way sync: Vercel Cron + Next Route Handler, pulls SKU/price/stock into variants, delta sync via watermark, batched with savepoints, amis_sync_log per run
- Search: /search route with pgroonga FTS, search bar component, bilingual ranking (locale-boosted)
- Brands / Designers / Catalogs / static pages routes (about, policies, services, beautifulliving)
- SEO: meta tags from DB fields, dynamic sitemap.xml, robots.txt, JSON-LD structured data (Product, Article, Organization, BreadcrumbList), Vercel deploy config
- Test infrastructure: local Supabase, seed data, pgTAP RLS test roles, Playwright config, Vitest config
- Agent-executed QA per todo (happy + failure paths, concrete commands)

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NO Figma UI implementation — structure + data wiring + semantic HTML + shadcn primitives ONLY. No custom colors, spacing, animations, or visual styling. className only for layout primitives (flex/grid) where structurally required.
- NO ZaloPay payment processing — checkout captures orders as pending/quote only
- NO Korean locale — vi + en only in v1
- NO Rooms feature — no schema data, nav link omitted
- NO AMIS write-back — one-way AMIS→Supabase read-only sync
- NO Million.js — React Compiler only (built into Next 16)
- NO next-cloudinary loader — next/image with remotePatterns + string-based URL transforms
- NO Sentry — Axiom only for v1
- NO admin dashboard / order management UI — Supabase Studio for v1
- NO transactional email — orders sit in DB for manual review
- NO account/profile page — deferred to UI phase
- NO wishlist, reviews, ratings, multi-currency, tax calculation — VND only, tax-inclusive (VN default)
- NO Notion content rendering — news notion_url is an outbound link only
- NO PDF viewer for catalogs — download links + cover image only
- NO pg_cron — Vercel Cron for AMIS sync scheduling
- NO raw SQL execute via MCP — use apply_migration for all DDL
- NO shadcn component installs beyond: Button, Input, Select, Form, Label, Sonner, Skeleton, Card (full component library = UI phase)
- NO service role key in any client-importable module — server-only with ESLint enforcement
- NO stock decrement at order capture — stock changes deferred to admin phase
- NO visual QA criteria — UI is a separate plan; QA is functional (routes resolve, data renders, RLS blocks)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (each todo includes its own tests) + framework: Vitest (unit/component), Playwright (e2e route resolution), pgTAP (RLS policies)
- Evidence: .omo/evidence/task-<N>-nanohome-ecommerce.<ext>
- RLS tests: pgTAP with test roles (anon, authenticated, service) asserting read/write permissions per table
- Route tests: Playwright asserting `/vi/<route>` + `/en/<route>` return 200, `/vi/<nonexistent>` returns 404
- Sync tests: route handler invoked with CRON_SECRET, assert amis_sync_log row, force AMIS 404 and assert items_failed logged without 500
- Cart merge tests: Playwright — add guest item, login, assert merged cart_items with summed qty; login twice, assert no duplicates
- Search tests: pgroonga query `SELECT ... WHERE name &@~ 'den'` returns rows; bench <100ms on full set
- Visibility filter: ALL public queries filter `validated=true AND approved=true`; unapproved product PDP returns 404

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

### Fast-path amendment (2026-06-28)
User priority changed to a working website fast before full production hardening. Preserve existing task definitions and evidence rules, but execute the remaining work in this MVP-first order after T9 completes: T10-T14 content routes, T16 search, T19 cart, T20 checkout, then T21 SEO/build basics. Defer T15 full auth/OAuth, T17 AMIS sync, T18 full RLS tests, and final hardening unless a later fast-path task explicitly needs them. Guest cart + checkout quote flow is acceptable for the first working demo; persistent accounts and automated AMIS updates are production-hardening follow-ups.

### Backend-only amendment (2026-06-28)
User clarified homepage and design-related work is handled in a separate UI worktree. This worktree must focus on backend/server/data/infrastructure only. Do not dispatch UI/design/homepage/page-presentation implementation here. After T9, prioritize backend fast-path tasks: T16 search server/query contract, T19 cart backend/store/server actions, T20 checkout/order capture backend, T21 backend SEO endpoints/config only where not owned by UI. Defer T10-T14 route/page presentation and any design/content UI implementation to the UI worktree unless the user explicitly reassigns them here.

### Auth + AMIS priority amendment (2026-06-28)
User clarified the backend lane should focus specifically on simple Supabase auth and AMIS data fetch. Prioritize T15 as a simple backend auth slice and T17 as AMIS fetch/sync. Keep auth minimal: Supabase session refresh/callback/server actions or route handlers as needed, no account/profile UI, no extra auth UX. AMIS work should fetch data and update backend records/logs, one-way only. Deprioritize search/cart/checkout/SEO until these two are done or the user reorders again.

### Backend-only T9/T16/T19 amendment (2026-06-28)
User clarified T9, T16, and T19 are needed, but only backend work should happen in this worktree. Execute T9 first as middleware/request-validation and route-smoke infrastructure without UI/design changes. After T9 is verified, execute T16 as search server/query contract only and T19 as cart backend/server-action or route/query contract only. Do not implement search UI, search page, cart UI, cart store, cart provider, cart icon, add-to-cart UI, product page presentation, or design/styling here.

**Wave 1 (Foundation — 5 todos, parallel):** T1 scaffold, T2 env validation, T3 commerce schema, T4 auth schema, T5 sync+search schema. All independent.

**Wave 2 (Infrastructure — 4 todos, parallel, after W1):** T6 type gen + data layer, T7 route shells, T8 test infra, T9 i18n middleware + smoke test.

**Wave 3 (Content routes — 5 todos, parallel, after W2):** T10 homepage, T11 product list, T12 PDP, T13 news, T14 brands/designers/catalogs/static.

**Wave 4 (Features — 4 todos, parallel, after W2):** T15 auth, T16 search, T17 AMIS sync, T18 RLS tests.

**Wave 5 (Cart + Checkout — 2 todos, after T15):** T19 cart, T20 checkout form.

**Wave 6 (Final — 1 todo, after W3):** T21 SEO + sitemap + deploy.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | — | T2(soft),T6-T9 | T2,T3,T4,T5 |
| T2 | T1(soft) | all(soft) | T3,T4,T5 |
| T3 | — | T6,T19,T20 | T1,T2,T4,T5 |
| T4 | — | T6,T15,T18 | T1,T2,T3,T5 |
| T5 | — | T6,T16,T17 | T1,T2,T3,T4 |
| T6 | T3,T4,T5 | T10-T14,T17,T19 | T7,T8,T9 |
| T7 | T1 | T10-T14 | T6,T8,T9 |
| T8 | T1 | T18 | T6,T7,T9 |
| T9 | T1 | T10-T14 | T6,T7,T8 |
| T10 | T6,T7,T9 | T21 | T11-T14,T15-T18 |
| T11 | T6,T7,T9 | T21 | T10,T12-T14,T15-T18 |
| T12 | T6,T7,T9 | T21 | T10,T11,T13,T14,T15-T18 |
| T13 | T6,T7,T9 | T21 | T10-T12,T14,T15-T18 |
| T14 | T6,T7,T9 | T21 | T10-T13,T15-T18 |
| T15 | T4,T6,T9 | T19,T20,T18 | T10-T14,T16,T17 |
| T16 | T5,T6,T7,T9 | — | T10-T15,T17,T18 |
| T17 | T5,T6 | — | T10-T16,T18 |
| T18 | T3,T4,T5,T15 | — | T16,T17 |
| T19 | T3,T6,T15 | T20 | — (sequential before T20) |
| T20 | T3,T6,T19 | — | — |
| T21 | T10-T14 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. C1 — Project scaffold: Next 16 + Tailwind v4 + next-intl + layout + providers + image config + telemetry
  What to do:
  - `bunx create-next-app@latest . --typescript --tailwind --app --turbopack --eslint --src-dir --import-alias "@/*"` (in-place, dir is empty git repo). Pin `next@16.2.7`.
  - Install: `@tanstack/react-query@5.101.0 @tanstack/react-query-devtools`, `next-intl`, `keen-slider@6.8.6`, `@supabase/ssr @supabase/supabase-js`, `zustand`, `react-hook-form zod @hookform/resolvers`, `@axiomhq/nextjs@0.2.0 @axiomhq/js`, `@microsoft/clarity`, `tw-animate-css`. Dev deps: `vitest @testing-library/react @testing-library/jest-dom @playwright/test jsdom`.
  - `next.config.ts`: `createNextIntlPlugin('./src/i18n/request.ts')`, `images.remotePatterns` for `res.cloudinary.com` (pathname `/nanohome-web/**`) + `ik.imagekit.io`, `reactCompiler` enabled.
  - next-intl setup: `src/i18n/routing.ts` (locales `['vi','en']`, default `'vi'`), `src/i18n/navigation.ts`, `src/i18n/request.ts`, `src/middleware.ts` (createIntlMiddleware, `localePrefix:'always'`), `messages/vi.json` + `messages/en.json` skeletons with namespaces: Common,Nav,Home,Products,ProductDetail,News,Cart,Checkout,Auth,Search,Brands,Designers,Catalogs,Static,Footer.
  - `src/app/[locale]/layout.tsx`: server component, `setRequestLocale`, wraps in `NextIntlClientProvider` + `QueryClientProvider` (via `src/app/providers.tsx` client wrapper).
  - `src/lib/image.ts`: `cloudinaryUrl(src, opts)` — string-based Cloudinary transform builder (insert `/c_fill,w_800,q_auto,f_auto/` before upload path). No next-cloudinary. Also export `placeholderUrl()` returning `/images/placeholder.webp` (static asset in `public/images/`). All image components pass null/empty URLs through `placeholderUrl()`.
  - `src/instrumentation.ts`: Axiom `register()` per @axiomhq/nextjs docs.
  - Clarity via `next/script` in `[locale]/layout.tsx` (afterInteractive, guarded by `NEXT_PUBLIC_CLARITY_ID`).
  - shadcn init: `bunx shadcn@latest init` (new-york, CSS vars, src dir). Add ONLY: `button input select form label sonner skeleton card`. If CLI asks for tailwind.config.js (Tailwind v4 incompat), add `@theme` tokens in `globals.css` manually.
  - `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=https://ithwvxvaomqbtlxbubtj.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_G8R20MBpTRjY1Z0Jrwe3tQ_28K2ZhHV`, server-only placeholders. `.env.example` with all vars documented.
  - `src/lib/supabase/browser.ts`: `createBrowserClient(url, key)`. `src/lib/supabase/server.ts`: `createServerClient` with cookies() (anon, RLS). `src/lib/supabase/admin.ts`: `createClient(url, serviceRoleKey)` + `import 'server-only'`.
  - `vitest.config.ts` (jsdom, setup `src/test/setup.ts`). `playwright.config.ts` (baseURL localhost:3000, testDir `e2e/`).
  Must NOT do: NO custom visual styling. NO shadcn beyond Button/Input/Select/Form/Label/Sonner/Skeleton/Card. NO Million.js. NO next-cloudinary. NO account page.
  Parallelization: Wave 1 | Blocked by: — | Blocks: T2(soft),T6-T9
  References: Working dir /Users/iant1359/Develop/temp-nanohome (empty git repo). Supabase id ithwvxvaomqbtlxbubtj, URL https://ithwvxvaomqbtlxbubtj.supabase.co. Publishable key sb_publishable_G8R20MBpTRjY1Z0Jrwe3tQ_28K2ZhHV. next-intl: createNextIntlPlugin, [locale] segment, setRequestLocale, NextIntlClientProvider. Tailwind v4: CSS-first @theme, no config.js. shadcn 4.12.0: new-york, tw-animate-css, sonner, data-slot. React Compiler: stable in Next 16. @axiomhq/nextjs 0.2.0: instrumentation.ts register(). Cloudinary domain: res.cloudinary.com/nanohome-web.
  Acceptance criteria: `bun run build` zero errors. `curl localhost:3000/vi` returns 200 with locale header. `curl localhost:3000/en` returns 200. `bun pm ls next tailwindcss @tanstack/react-query @supabase/ssr keen-slider @axiomhq/nextjs` all present.
  QA scenarios: Playwright `e2e/smoke-i18n.spec.ts` — `/vi` + `/en` resolve, html lang attr correct. Failure: `/de` returns 404 or redirect. Evidence: .omo/evidence/task-1-nanohome-ecommerce.txt
  Commit: Y | feat(scaffold): init Next 16 + Tailwind v4 + next-intl + Supabase + providers

- [x] 2. C1.1 — Env validation + security guards
  What to do:
  - `src/lib/env.ts`: zod schema. Public: `NEXT_PUBLIC_SUPABASE_URL`(url), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(str), `NEXT_PUBLIC_CLARITY_ID`(str opt), `NEXT_PUBLIC_AXIOM_DATASET`(str opt), `NEXT_PUBLIC_AXIOM_TOKEN`(str opt). Server: `SUPABASE_SERVICE_ROLE_KEY`(str), `AMIS_API_BASE_URL`(url opt), `AMIS_API_KEY`(str opt), `AMIS_CLIENT_ID`(str opt), `AMIS_CLIENT_SECRET`(str opt), `AMIS_TENANT`(str opt), `CRON_SECRET`(str). Export parsed `env`.
  - `import 'server-only'` in `src/lib/supabase/admin.ts` (already in T1, verify).
  - ESLint `no-restricted-imports`: block `@/lib/supabase/admin` from client components. Add to eslint config.
  - `.env.example`: all vars with comments, grouped PUBLIC/SERVER-ONLY/AMIS/ANALYTICS.
  Must NOT do: NO `NEXT_PUBLIC_` prefix on service role key. NO process.env direct access in components.
  Parallelization: Wave 1 | Blocked by: T1(soft) | Blocks: all(soft)
  References: zod env pattern `z.object({...}).parse(process.env)`. server-only throws on client import. ESLint no-restricted-imports pattern.
  Acceptance criteria: `bun run build` succeeds. Importing admin in `'use client'` file triggers ESLint error. Missing `SUPABASE_SERVICE_ROLE_KEY` → build fails with zod error.
  QA scenarios: Happy: `bunx eslint src/lib/supabase/admin.ts` passes. Failure: temp client file importing admin → eslint error → delete temp. Evidence: .omo/evidence/task-2-nanohome-ecommerce.txt
  Commit: Y | feat(env): zod env validation + server-only guards + ESLint restrictions

- [x] 3. C2a — Commerce schema: carts, cart_items, orders, order_items, order_status_history + RLS
  What to do:
  - `supabase_apply_migration(project_id='ithwvxvaomqbtlxbubtj', name='add_commerce_tables', query=...)`:
  - `carts`: id uuid PK default gen_random_uuid(), user_id uuid FK auth.users on delete cascade, guest_id text, merged_from_guest_id text, created_at, updated_at. Unique(user_id) where not null. Unique(guest_id) where not null.
  - `cart_items`: id uuid PK, cart_id uuid FK carts cascade, variant_id uuid FK variants cascade, quantity int check(>0), created_at, updated_at. Unique(cart_id, variant_id).
  - `orders`: id uuid PK, order_number text unique not null, user_id uuid FK auth.users on delete set null, email citext not null, full_name text not null, phone text not null, address text not null, city text, district text, ward text, note text, subtotal numeric(15,2) default 0, status text default 'pending' check(in ('pending','quote','confirmed','cancelled','fulfilled')), created_at, updated_at.
  - `order_items`: id uuid PK, order_id uuid FK orders cascade, variant_id uuid FK variants, product_name text, variant_name text, sku text, price numeric(15,2), quantity int check(>0), created_at.
  - `order_status_history`: id uuid PK, order_id uuid FK orders cascade, status text, changed_by uuid, note text, created_at.
  - RLS on all 5. Policies: carts SELECT/INSERT/UPDATE/DELETE where `user_id=auth.uid()`. cart_items via join `cart.user_id=auth.uid()`. orders SELECT where `user_id=auth.uid()`, INSERT for authed (user_id=auth.uid()) OR anon guest checkout (user_id IS NULL AND email IS NOT NULL). order_items SELECT where `order.user_id=auth.uid()` (or for anon-created orders: `order.user_id IS NULL AND order.email = current_setting('request.jwt.claim.email', true)`). order_status_history SELECT where `order.user_id=auth.uid()`.
  - Guest checkout order retrieval: anon can SELECT own order by `order_number` only (no email enumeration). Add policy: `FOR SELECT USING (user_id IS NULL AND order_number = current_setting('app.order_number', true))`. Server action sets the GUC before query.
  - `updated_at` trigger for carts/cart_items (new function `SECURITY DEFINER search_path=public` to fix existing mutable search_path warning).
  Must NOT do: NO zalo_pay_transactions. NO stock decrement trigger. NO admin policies.
  Parallelization: Wave 1 | Blocked by: — | Blocks: T6,T19,T20
  References: Supabase id ithwvxvaomqbtlxbubtj. Variants table: id uuid, product_id, sku, price numeric, in_stock bool, slug, packshot_url, gallery_urls text[]. citext available. pg_hashids for order numbers. auth.uid() in RLS.
  Acceptance criteria: `supabase_list_tables(project_id, ['public'], true)` shows all 5 tables + RLS enabled. `supabase_get_advisors(project_id, 'security')` no new warnings.
  QA scenarios: Verify via list_tables verbose. Advisors check for RLS gaps. Evidence: .omo/evidence/task-3-nanohome-ecommerce.json
  Commit: Y | feat(schema): add commerce tables + RLS

- [x] 4. C2b — Auth schema: profiles + on_auth_user_created trigger + RLS
  What to do:
  - `supabase_apply_migration(project_id='ithwvxvaomqbtlxbubtj', name='add_profiles_and_trigger', query=...)`:
  - `profiles`: id uuid PK references auth.users(id) on delete cascade, email citext, full_name text, phone text, avatar_url text, preferred_locale text default 'vi', created_at, updated_at.
  - RLS: SELECT/UPDATE where `id=auth.uid()`. No client INSERT (trigger only).
  - `handle_new_user()` SECURITY DEFINER search_path=public: insert into profiles(id, email, full_name, phone) values(new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone').
  - Trigger `on_auth_user_created` AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user().
  - `updated_at` trigger for profiles (fixed search_path function).
  Must NOT do: NO app-code profile insertion. NO admin profile management.
  Parallelization: Wave 1 | Blocked by: — | Blocks: T6,T15,T18
  References: Supabase Auth auth.users, raw_user_meta_data jsonb. Trigger pattern SECURITY DEFINER search_path=public. Existing touch_updated_at advisor warning — use fixed search_path.
  Acceptance criteria: `supabase_list_tables` shows profiles + RLS. `supabase_get_advisors` no RLS gaps. New user signup auto-creates profile (verified in T15).
  QA scenarios: Advisors security check. Evidence: .omo/evidence/task-4-nanohome-ecommerce.json
  Commit: Y | feat(schema): add profiles table + auth trigger + RLS

- [x] 5. C2c — Sync + search schema: amis_sync_log + pgroonga + slug unique indexes
  What to do:
  - First: `supabase_list_extensions(project_id='ithwvxvaomqbtlxbubtj')` — confirm pgroonga available.
  - Migration `add_amis_sync_log`: amis_sync_log id uuid PK, started_at timestamptz default now(), finished_at timestamptz, status text default 'running' check(in ('running','success','partial','failed')), items_processed int default 0, items_failed int default 0, error text, watermark timestamptz. RLS: `FOR ALL USING(false) WITH CHECK(false)` (service role only).
  - Migration `add_pgroonga_extension`: `CREATE EXTENSION IF NOT EXISTS pgroonga;` + `CREATE INDEX products_pgroonga_idx ON products USING pgroonga (name, name_vi, description, description_vi);` + `CREATE INDEX variants_pgroonga_idx ON variants USING pgroonga (name, sku, finish, finish_vi);`.
  - Migration `add_slug_unique_indexes`: unique indexes on slug columns for products(slug, slug_vi), variants(slug, slug_vi), brands(slug), designers(slug), categories(slug), news(slug) — all `WHERE slug IS NOT NULL`.
  Must NOT do: NO pg_cron jobs. NO FTS on news. NO trigram indexes.
  Parallelization: Wave 1 | Blocked by: — | Blocks: T6,T16,T17
  References: pgroonga 3.2.5 available. Operator `&@~`. Products 1083 rows, variants 2209 — fast index build. amis_sync_log: one row per run, watermark for delta. Slug columns on products, variants, brands, designers, categories, news.
  Acceptance criteria: `supabase_list_extensions` shows pgroonga enabled. `supabase_list_tables` shows amis_sync_log + RLS. `supabase_get_advisors` no issues.
  QA scenarios: If pgroonga unavailable → fall back to pg_trgm `gin_trgm_ops` + note. If duplicate slugs → add `WHERE approved=true AND validated=true`. Evidence: .omo/evidence/task-5-nanohome-ecommerce.json
  Commit: Y | feat(schema): add amis_sync_log + pgroonga FTS + slug unique indexes

- [x] 6. C1.5 — Type generation + data access layer (lib/queries + 3 Supabase clients typed)
  What to do:
  - `bunx supabase gen types typescript --project-id ithwvxvaomqbtlxbubtj > src/types/database.types.ts` (or `supabase_generate_typescript_types` MCP tool).
  - `src/types/db.ts`: re-export Database type, typed query helpers.
  - Verify `src/lib/supabase/{browser,server,admin}.ts` (from T1) are typed with Database generic.
  - Create `src/lib/queries/` with typed functions:
    - `products.ts`: `getProducts({category?,brand?,designer?,onSale?,search?,sort?,page?,pageSize?})` — filters `validated=true AND approved=true`. Sort: priority(default), price_asc, price_desc, newest. Pagination via range().
    - `product.ts`: `getProductByAirtableId(airtableId)` — product + variants + brand + designer + category + related(4, same category) + linked news(via news_products). Null if not found/approved.
    - `variants.ts`: `getVariantById(id)`, `getVariantsByProductId(productId)`.
    - `categories.ts`: `getCategories()`, `getCategoryBySlug(slug)`.
    - `brands.ts`: `getBrands()`, `getBrandBySlug(slug)`, `getProductsByBrandSlug(slug, opts)`.
    - `designers.ts`: `getDesigners()`, `getDesignerBySlug(slug)`, `getProductsByDesignerSlug(slug, opts)`.
    - `news.ts`: `getNewsList(page, pageSize)`, `getNewsByAirtableId(airtableId)`.
    - `catalogs.ts`: `getCatalogs()`, `getCatalogsByBrandId(brandId)`.
    - `search.ts`: `searchProducts(query, locale, opts)` — pgroonga `&@~`, locale-boosted (vi prioritizes name_vi/description_vi).
    - `cart.ts`: `getCart(userId)`, `createCart(userId)`, `getCartItems(cartId)`, `addCartItem(cartId, variantId, qty)`, `updateCartItemQuantity(...)`, `removeCartItem(...)`, `mergeGuestCart(userId, guestItems)` — admin client, idempotent via `merged_from_guest_id`.
    - `orders.ts`: `createOrder(data)`, `getOrdersByUserId(userId)`.
  - All use `server.ts` (anon, RLS) for reads. `admin.ts` (service role) ONLY for `mergeGuestCart`.
  Must NOT do: NO direct supabase calls in route components. NO service role in any function except mergeGuestCart. NO raw SQL. NO caching config yet.
  Parallelization: Wave 2 | Blocked by: T1,T3,T4,T5 | Blocks: T10-T14,T17,T19
  References: Supabase id ithwvxvaomqbtlxbubtj. All table schemas (brands, designers, categories, products, variants, news, catalogs, junctions + new commerce tables). Visibility filter validated=true AND approved=true. pgroonga `&@~`. supabase-js v2 query builder. Junctions: product_designers, news_products, news_variants.
  Acceptance criteria: `bunx tsc --noEmit` passes. Each `lib/queries/*.ts` has a corresponding `*.test.ts` that imports every export. `bun run build` succeeds.
  QA scenarios: Vitest `products.test.ts` — mock client, call `getProducts({page:1})`, assert `.eq('validated',true).eq('approved',true)`. Failure: `getProductByAirtableId('nonexistent')` returns null. Evidence: .omo/evidence/task-6-nanohome-ecommerce.txt
  Commit: Y | feat(data): generate types + data access layer with typed queries

- [x] 7. C0.5 — Route shells: error/not-found/loading at root + [locale]
  What to do:
  - `src/app/global-error.tsx`: 'use client', html+body, error message + retry (shadcn Button).
  - `src/app/error.tsx`: 'use client', error + reset.
  - `src/app/not-found.tsx`: 404 + home link.
  - `src/app/[locale]/error.tsx`: 'use client', `useTranslations('Common')`.
  - `src/app/[locale]/not-found.tsx`: locale-aware 404.
  - `src/app/[locale]/loading.tsx`: shadcn Skeleton.
  - `src/app/[locale]/products/loading.tsx`, `src/app/[locale]/products/[airtableId]/[slug]/loading.tsx`: route-specific skeletons. All other routes (news/search/catalogs/static) rely on parent `[locale]/loading.tsx` — do NOT add per-route loading.tsx for them.
  Must NOT do: NO custom error styling. NO per-component boundaries. NO error tracking integration.
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: T10-T14
  References: Next 16 App Router: error.tsx ('use client'), not-found.tsx, loading.tsx, global-error.tsx (html+body required). next-intl useTranslations. shadcn Skeleton.
  Acceptance criteria: `bun run build` succeeds. `/vi/nonexistent-route` returns 404. Error in route renders error.tsx.
  QA scenarios: Playwright — `/vi/nonexistent` → 404 + "not found" text. `/en/nonexistent` → English text. Temp throw → error.tsx renders. Evidence: .omo/evidence/task-7-nanohome-ecommerce.txt
  Commit: Y | feat(routes): add error/not-found/loading route shells

- [x] 8. C12.5 — Test infrastructure: local Supabase, seed, pgTAP roles, Playwright config
  What to do:
  - `supabase/config.toml`: local Supabase config. `supabase start` to initialize local stack. Document `supabase stop` for teardown. Local DB URL: `postgresql://postgres:postgres@localhost:54322/postgres` (default).
  - `supabase/seed.sql`: insert test data — 2 brands, 3 categories, 5 products (3 approved+validated, 1 approved=false, 1 validated=false), 8 variants, 2 news, 1 catalog. Use fixed UUIDs from `supabase/tests/fixtures.sql` (constants block at top) for deterministic tests.
  - `e2e/fixtures.ts`: Playwright fixtures for auth (test user email/pass), cart state.
  - `src/test/setup.ts`: Vitest setup (jest-dom, cleanup).
  - `supabase/tests/rls_test.sql`: pgTAP test skeleton — `BEGIN; SELECT plan(N); -- test anon cannot read carts, authenticated can read own, service role can read all; SELECT * FROM finish(); ROLLBACK;`
  - Document test roles: anon (no auth), authenticated (test user), service (service role key).
  Must NOT do: NO production data in seed. NO destructive tests on remote DB — use local Supabase or transactional pgTAP (BEGIN/ROLLBACK).
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: T18
  References: Playwright config from T1. Vitest config from T1. pgTAP available on Supabase. Test data must include approved=false and validated=false products for visibility filter tests.
  Acceptance criteria: `bunx vitest run` passes setup test. `bunx playwright test --list` shows test files. `supabase/tests/rls_test.sql` exists with pgTAP plan.
  QA scenarios: `bunx vitest run src/test/setup.test.ts` — passes. Evidence: .omo/evidence/task-8-nanohome-ecommerce.txt
  Commit: Y | feat(test): add test infra — seed data, pgTAP RLS skeleton, Playwright fixtures

- [x] 9. i18n middleware + route smoke test
  What to do:
  - Verify `src/middleware.ts` (from T1) uses `createIntlMiddleware` with `localePrefix:'always'` and matcher config excluding `/_next`, `/auth`, `/api`, static files.
  - Add `hasLocale` validation in `src/i18n/request.ts` — throw if requested locale not in `['vi','en']`.
  - Create `e2e/smoke-i18n.spec.ts`: test `/vi` returns 200 + `html lang="vi"`, `/en` returns 200 + `html lang="en"`, `/de` redirects to `/vi` or 404, `/vi/products` returns 200, `/en/products` returns 200.
  - Verify middleware does not strip auth cookies (prep for T15 auth middleware addition).
  Must NOT do: NO auth middleware yet (added in T15). NO locale prefix stripping for default locale (always prefix).
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: T10-T14
  References: next-intl createIntlMiddleware, localePrefix 'always'. Matcher pattern: `/((?!_next|auth|api|.*\\..*).*)` or similar. hasLocale validation from next-intl.
  Acceptance criteria: `bunx playwright test e2e/smoke-i18n.spec.ts` all pass. `curl -I localhost:3000/vi` shows 200 + locale header. `curl -I localhost:3000/de` shows redirect or 404.
  QA scenarios: Playwright i18n smoke test (happy + failure). Evidence: .omo/evidence/task-9-nanohome-ecommerce.txt
  Commit: Y | feat(i18n): verify middleware + locale validation + smoke test

- [ ] 10. C3 — Homepage code structure (route, data fetching, sections)
  What to do:
  - `src/app/[locale]/page.tsx`: server component. `setRequestLocale(locale)`. `getTranslations('Home')`.
  - Fetch data via `lib/queries`: hero products (priority products, limit 5), stylist picks (priority variants with packshot_url, limit 8), design trends (categories or curated products by product_line, 8 styles: Mid-Century/Japandi/Scandinavian/Minimalism/Eclectic/Transitional/French Modern Farmhouse/Hollywood Glam), showrooms (static data — 3 locations: Thao Dien HCMC, Gallery Saigon Binh Thanh, Gallery Hanoi Dong Da).
  - Sections: hero carousel (keen-slider `useKeenSlider` in client component `src/components/home/hero-carousel.tsx`), product grid (server-rendered, shadcn Card), design trends grid, showrooms section.
  - `revalidate = 300` (5 min) for homepage data.
  - `generateMetadata()`: title from translations, description from translations.
  Must NOT do: NO custom visual styling. NO Figma layout. keen-slider for structure only, no visual config. NO client-side data fetching (all server-side).
  Parallelization: Wave 3 | Blocked by: T6,T7,T9 | Blocks: T21
  References: nanohome.vn homepage sections: hero carousel, Stylist's Picks, Design Trends 2024 (8 styles), 3 Showrooms. keen-slider 6.8.6 `useKeenSlider` from 'keen-slider/react'. Products: 1083, filter validated+approved. Variants: packshot_url for images. Showrooms: Thao Dien HCMC / Gallery Saigon Binh Thanh / Gallery Hanoi Dong Da. Contact: (+84) 33 948 7632, info@nanohome.vn.
  Acceptance criteria: `curl localhost:3000/vi` returns 200. `curl localhost:3000/en` returns 200. Page contains product data (at least 1 product name in HTML). `bun run build` succeeds.
  QA scenarios: Playwright — `/vi` renders with product names, `/en` renders with English labels. Failure: empty DB → page renders with empty states (no crash). Evidence: .omo/evidence/task-10-nanohome-ecommerce.txt
  Commit: Y | feat(home): homepage route with data fetching for hero/picks/trends/showrooms

- [ ] 11. C4 — Product List code structure (filter/sort/pagination via URL params)
  What to do:
  - `src/app/[locale]/products/page.tsx`: server component. Reads `searchParams` (category, brand, designer, sort, page). Calls `getProducts(opts)`. Renders product grid (shadcn Card per product).
  - `src/app/[locale]/products/category/[slug]/page.tsx`: server component. Calls `getCategoryBySlug(slug)` then `getProducts({category: slug, ...opts})`. 404 if category not found.
  - `src/app/[locale]/brands/[slug]/products/page.tsx`: `getProductsByBrandSlug(slug, opts)`. 404 if brand not found.
  - `src/app/[locale]/designers/[slug]/products/page.tsx`: `getProductsByDesignerSlug(slug, opts)`. 404 if designer not found.
  - `src/app/[locale]/clearance/page.tsx`: `getProducts({onSale: true, ...opts})`.
  - Filter/sort/pagination: URL search params canonical (`?sort=price_asc&page=2`). Client filter component (`src/components/products/filters.tsx` 'use client') uses `useSearchParams()` + `router.push`. TanStack Query for filter state keyed off `useSearchParams()`.
  - `revalidate = 300` for product list. `generateMetadata()` per route (category name, brand name in title).
  - `generateStaticParams()` for category slugs (15 categories) for static generation.
  Must NOT do: NO client-side data fetching (server reads URL params, fetches, renders). NO TanStack Query as independent cache source — keyed off URL params only. NO custom styling.
  Parallelization: Wave 3 | Blocked by: T6,T7,T9 | Blocks: T21
  References: Routes from nanohome.vn: /products, /products/category/{slug} (furniture/lighting/usm/accessories), /brands, /designers, /clearance. Products 1083, variants 2209. Categories 15. Brands 30. Designers 192. Visibility filter validated+approved. Sort: priority/price_asc/price_desc/newest. Pagination: 24 per page default.
  Acceptance criteria: `curl localhost:3000/vi/products` 200. `curl localhost:3000/vi/products/category/furniture` 200. `curl localhost:3000/vi/products?sort=price_asc&page=2` 200. `curl localhost:3000/vi/products/category/nonexistent` 404. `curl localhost:3000/vi/brands/nonexistent/products` 404.
  QA scenarios: Playwright — list renders products, filter change updates URL + content, pagination works. Failure: nonexistent category → 404. Evidence: .omo/evidence/task-11-nanohome-ecommerce.txt
  Commit: Y | feat(products): product list routes with URL-param filter/sort/pagination

- [ ] 12. C5 — PDP code structure (variant selector, gallery, price/stock, related, news)
  What to do:
  - `src/app/[locale]/products/[airtableId]/[slug]/page.tsx`: server component. Calls `getProductByAirtableId(airtableId)`. 404 if not found or not approved. `generateMetadata()` from product/variant meta_title/meta_description.
  - `generateStaticParams()`: top 100 products by priority for static generation.
  - Variant selector: client component `src/components/pdp/variant-selector.tsx` ('use client'). Reads `?variant={airtableId}` from URL. Updates URL via `router.replace`. Displays selected variant price/stock. Shows min-max price range badge from all variants.
  - Gallery: client component `src/components/pdp/gallery.tsx` using keen-slider. Images from variant.packshot_url + variant.gallery_urls[]. Use `next/image` with `cloudinaryUrl()` helper from T1. Null/empty URLs fall through to `placeholderUrl()` (from T1 lib/image.ts) — never render broken image.
  - Price/stock: from selected variant (price, compare_at_price, discount_percent, in_stock). Price in VND format (₫). If price null → "Contact Us" CTA.
  - Related products: server-rendered (from `getProductByAirtableId` response, same category, limit 4).
  - News cross-link: from `getProductByAirtableId` response (linked via news_products junction).
  - `revalidate = 60` (1 min, more frequent for stock freshness).
  Must NOT do: NO separate variant routes (variant via ?variant= query param). NO client-side data fetching. NO custom styling. NO Notion rendering.
  Parallelization: Wave 3 | Blocked by: T6,T7,T9 | Blocks: T21
  References: Route /products/{airtableId}/{slug}. Products have airtable_id, slug, slug_vi. Variants have airtable_id, slug, price, compare_at_price, discount_percent, in_stock, packshot_url, gallery_urls[], finish, finish_vi, size, sku. Price VND (₫). Some price-less → "Contact Us". Images: Cloudinary via cloudinaryUrl(). JSON-LD Product schema in T21.
  Acceptance criteria: `curl localhost:3000/vi/products/{airtableId}/{slug}` 200 for existing product. 404 for nonexistent. `?variant={variantAirtableId}` changes displayed price/stock. Page contains product name + at least 1 variant.
  QA scenarios: Playwright — PDP renders product, variant switch updates price, ?variant= deep link works. Failure: nonexistent airtableId → 404. Price-less variant → "Contact Us". Evidence: .omo/evidence/task-12-nanohome-ecommerce.txt
  Commit: Y | feat(pdp): product detail route with variant selector + gallery + related

- [ ] 13. C6 — News list + detail code structure
  What to do:
  - `src/app/[locale]/news/page.tsx`: server component. `getNewsList(page, pageSize)`. Paginated list with cover_url + title + description. `generateMetadata()`.
  - `src/app/[locale]/news/[airtableId]/page.tsx`: server component. `getNewsByAirtableId(airtableId)`. 404 if not found. Renders cover_url + title + description. `notion_url` is outbound "Read more" link (NOT rendered/embedded).
  - `generateStaticParams()`: all approved news (61).
  - `revalidate = 3600` (1 hour, news changes less frequently).
  Must NOT do: NO Notion content fetching/rendering. NO client-side data fetching. NO custom styling.
  Parallelization: Wave 3 | Blocked by: T6,T7,T9 | Blocks: T21
  References: News table: id, airtable_id, title, title_vi, slug, description, cover_url, notion_url, route, approved, validated. 61 news items. notion_url = outbound link only. JSON-LD Article schema in T21.
  Acceptance criteria: `curl localhost:3000/vi/news` 200. `curl localhost:3000/vi/news/{airtableId}` 200 for existing. 404 for nonexistent. Page contains news title + "Read more" link to notion_url.
  QA scenarios: Playwright — news list renders items, detail page renders + has outbound link. Failure: nonexistent → 404. Evidence: .omo/evidence/task-13-nanohome-ecommerce.txt
  Commit: Y | feat(news): news list + detail routes with outbound Notion links

- [ ] 14. C10 — Brands / Designers / Catalogs / Showrooms / static pages
  What to do:
  - `src/app/[locale]/brands/page.tsx`: `getBrands()`. Grid of brands with logo_url + name + origin.
  - `src/app/[locale]/designers/page.tsx`: `getDesigners()`. Grid with portrait_url + name.
  - `src/app/[locale]/catalogs/page.tsx`: `getCatalogs()`. List with brand_name + cover + download links (file_urls[]). NO PDF viewer — download links only.
  - `src/app/[locale]/about/page.tsx`: static content from translations.
  - `src/app/[locale]/policies/page.tsx`: static content from translations.
  - `src/app/[locale]/services/interior-decoration/page.tsx`: static content.
  - `src/app/[locale]/services/lighting-design/page.tsx`: static content.
  - `src/app/[locale]/beautifulliving/page.tsx`: static content + curated product grid (top 8 products ordered by `priority DESC, source_created_at DESC`).
  - All: `generateMetadata()`, `revalidate = 3600`. Dynamic rendering for all C10 routes (no `generateStaticParams()`). Brands/designers/catalogs change infrequently; ISR via `revalidate = 3600` handles staleness.
  Must NOT do: NO PDF viewer. NO custom styling. NO client-side data fetching.
  Parallelization: Wave 3 | Blocked by: T6,T7,T9 | Blocks: T21
  References: Brands 30 (logo_url, name, origin, origin_vi). Designers 192 (portrait_url, name). Catalogs 16 (brand_name, file_urls[], cloudinary_urls[]). Static routes: /about, /policies, /services/interior-decoration, /services/lighting-design, /beautifulliving.
  Acceptance criteria: `curl localhost:3000/vi/brands` 200. `curl localhost:3000/vi/designers` 200. `curl localhost:3000/vi/catalogs` 200. `curl localhost:3000/vi/about` 200. All static pages 200.
  QA scenarios: Playwright — brands page renders brand names, catalogs page has download links (not embed). Evidence: .omo/evidence/task-14-nanohome-ecommerce.txt
  Commit: Y | feat(static): brands/designers/catalogs/showrooms/static pages routes

- [x] 15. C8 — Auth: email/pass + Google + Facebook, middleware update, callback
  What to do:
  - `src/app/[locale]/login/page.tsx`: login form (react-hook-form + zod). Email/password fields. Google + Facebook OAuth buttons (Supabase Auth `signInWithOAuth`).
  - `src/app/[locale]/signup/page.tsx`: signup form. Email/password + optional full_name/phone (passed to `raw_user_meta_data` for trigger).
  - `src/app/auth/callback/route.ts`: OAuth callback handler (OUTSIDE `[locale]` segment). Exchanges code for session, reads `next` param, redirects to `/[locale]/next`. Supabase dashboard redirect URL configured to `https://domain/auth/callback`.
  - Manual setup docs (`docs/auth-setup.md`): one-time Supabase dashboard config — enable Google + Facebook providers, set Site URL to production domain, add redirect URLs: `https://{domain}/auth/callback` and `http://localhost:3000/auth/callback` for dev. OAuth won't work without this.
  - Update `src/middleware.ts`: chain `@supabase/ssr` `updateSession` AFTER i18n middleware. Session refresh on every request. Protected routes: `/account`, `/checkout` (redirect to login if no session).
  - Auth context: `src/components/auth/auth-provider.tsx` ('use client') — listens to `onAuthStateChange`, exposes user state. Profile auto-created by DB trigger (T4).
  - Logout: server action calling `supabase.auth.signOut()`.
  Must NOT do: NO app-code profile insertion (trigger handles). NO account/profile page (deferred to UI phase). NO Zalo login. NO custom session management (Supabase handles).
  Parallelization: Wave 4 | Blocked by: T4,T6,T9 | Blocks: T19,T20,T18
  References: Supabase Auth: signInWithPassword, signInWithOAuth({provider:'google'/'facebook'}). @supabase/ssr updateSession in middleware. OAuth callback at /auth/callback (outside [locale]). Profile trigger from T4. Middleware: i18n first, then auth session refresh. Protected routes redirect to /login.
  Acceptance criteria: `curl localhost:3000/vi/login` 200. `curl localhost:3000/vi/signup` 200. `curl localhost:3000/auth/callback` exists (not 404). Email signup creates user + profile (verify via Supabase dashboard). Login sets session cookie.
  QA scenarios: Playwright — signup with test email → verify profile created in Supabase. Login → session cookie set. Logout → cookie cleared. OAuth buttons render (mock click — full OAuth flow needs real credentials). Failure: wrong password → error message. Evidence: .omo/evidence/task-15-nanohome-ecommerce.txt
  Commit: Y | feat(auth): email/pass + Google + Facebook OAuth + middleware session refresh

- [x] 16. C12 — Search: pgroonga FTS, search bar, /search route, bilingual ranking
  What to do:
  - `src/components/search/search-bar.tsx` ('use client'): input with debounce, navigates to `/[locale]/search?q={query}` on submit.
  - `src/app/[locale]/search/page.tsx`: server component. Reads `q` from searchParams. Calls `searchProducts(q, locale, opts)`. Renders results grid (reuses product card from C4).
  - `searchProducts()` in `lib/queries/search.ts` (from T6): uses pgroonga `&@~` operator. Locale-boosted: if locale='vi', boost matches on name_vi/description_vi; if 'en', boost name/description. Cross-locale matches allowed but ranked lower.
  - `generateMetadata()`: title "Search: {q}".
  - `revalidate = 300`.
  Must NOT do: NO client-side search (all server-side via URL param). NO autocomplete suggestions (deferred). NO search on news (products + variants only).
  Parallelization: Wave 4 | Blocked by: T5,T6,T7,T9 | Blocks: —
  References: pgroonga `&@~` operator. Indexes from T5: products_pgroonga_idx (name, name_vi, description, description_vi), variants_pgroonga_idx (name, sku, finish, finish_vi). Search bar in header. Locale from [locale] segment.
  Acceptance criteria: `curl localhost:3000/vi/search?q=den` 200. Results contain products matching "den" (lamp in Vietnamese). `curl localhost:3000/en/search?q=lamp` 200. Empty query `?q=` renders empty state (no crash).
  QA scenarios: Playwright — search "den" on /vi/search → results render. Search "lamp" on /en/search → results. Empty search → empty state. Evidence: .omo/evidence/task-16-nanohome-ecommerce.txt
  Commit: Y | feat(search): pgroonga FTS search route with bilingual ranking

- [x] 17. C9 — AMIS sync: Vercel Cron + Next Route Handler, delta sync, batched
  What to do:
  - Step 1 — AMIS auth discovery: fetch AMIS OpenAPI docs (provider has them). Identify auth pattern: (a) HMAC signature (AMIS_API_KEY + AMIS_HMAC_SECRET), (b) OAuth2 client_credentials (CLIENT_ID/CLIENT_SECRET/TENANT), or (c) static API key header. Update T2 env schema if new vars needed (e.g. AMIS_HMAC_SECRET). If unknown, log warning and skip sync gracefully.
  - Step 2 — implement: `src/app/api/cron/amis-sync/route.ts`: POST handler. Auth via `CRON_SECRET` header (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`). `withAxiom` wrapper for logging. Sync logic: fetch from AMIS OpenAPI using auth pattern from step 1. Delta sync: watermark = `MAX(started_at)` of previous successful log row. Only advance watermark on `status IN ('success','partial')`. On `status='failed'`, leave watermark unchanged so next run retries. Batch 200 items per request. Update variants table (price, compare_at_price, in_stock, discount_percent, source_updated_at) via admin client.
  - `vercel.json`: add cron job `{ "path": "/api/cron/amis-sync", "schedule": "*/15 * * * *" }` (every 15 min).
  - If AMIS API is unavailable or credentials missing, route returns 200 with log entry status='failed' (don't 500 — Vercel Cron retries).
  Must NOT do: NO write-back to AMIS (one-way read-only). NO pg_cron (Vercel Cron only). NO sync of all 2209 variants in one request (batch). NO client-side sync trigger.
  Parallelization: Wave 4 | Blocked by: T5,T6 | Blocks: —
  References: AMIS OpenAPI credentials in env (AMIS_API_BASE_URL, AMIS_API_KEY, AMIS_CLIENT_ID, AMIS_CLIENT_SECRET, AMIS_TENANT). amis_sync_log from T5. Variants: sku, price, compare_at_price, discount_percent, in_stock, source_updated_at. Vercel Cron: CRON_SECRET auth, schedule in vercel.json. @axiomhq/nextjs withAxiom wrapper. Batch 200/run. Vercel function timeout: 60s pro — batching prevents timeout.
  Acceptance criteria: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/amis-sync` returns 200. `amis_sync_log` row created. If AMIS credentials missing → 200 with status='failed' in log. If AMIS returns 404 → items_failed logged, no 500.
  QA scenarios: Happy: invoke with valid CRON_SECRET → log row with items_processed>0. Failure: wrong CRON_SECRET → 401. AMIS 404 → log status='partial', items_failed>0, no 500. Evidence: .omo/evidence/task-17-nanohome-ecommerce.txt
  Commit: Y | feat(sync): AMIS one-way delta sync via Vercel Cron with batched updates

- [ ] 18. RLS policy tests (pgTAP) — all new tables
  What to do:
  - `supabase/tests/rls_commerce.sql`: pgTAP tests for carts, cart_items, orders, order_items, order_status_history. Assert: anon cannot SELECT/INSERT/UPDATE/DELETE carts. Authenticated user can only access own cart. Anon cannot read orders. Authenticated can read own orders.
  - `supabase/tests/rls_profiles.sql`: pgTAP tests for profiles. Assert: user can SELECT/UPDATE own profile only. Cannot read other users' profiles.
  - `supabase/tests/rls_amis_sync.sql`: pgTAP tests for amis_sync_log. Assert: anon and authenticated cannot read/write (service role only).
  - Run via local Supabase: `supabase db test` or `psql -f supabase/tests/rls_*.sql` with pgTAP extension.
  Must NOT do: NO tests on production DB (local Supabase only). NO destructive tests (use BEGIN/ROLLBACK).
  Parallelization: Wave 4 | Blocked by: T3,T4,T5,T15 | Blocks: —
  References: pgTAP available. Test roles: anon (no auth), authenticated (test user from T8 seed), service (service role). RLS policies from T3, T4, T5. pgTAP pattern: `BEGIN; SELECT plan(N); SELECT lives_ok(...); SELECT throws_ok(...); SELECT * FROM finish(); ROLLBACK;`
  Acceptance criteria: All pgTAP tests pass (`supabase db test` exits 0). Each table has at least 2 tests (positive + negative).
  QA scenarios: `supabase db test` — all pass. Failure: insert test that should fail → assert throws_ok. Evidence: .omo/evidence/task-18-nanohome-ecommerce.txt
  Commit: Y | test(rls): pgTAP RLS policy tests for all new tables

- [x] 19. C7a — Cart: hybrid guest localStorage + authed Supabase, merge on login
  What to do:
  - `src/lib/stores/cart-store.ts`: zustand store with `persist` middleware (localStorage). State: `items: {variant_id, quantity, product_name, variant_name, price, packshot_url}[]`. Actions: addItem, removeItem, updateQuantity, clearCart. `skipHydration: true` to prevent SSR hydration mismatch.
  - `src/components/cart/cart-provider.tsx` ('use client'): mounts after hydration (`useEffect` flag). If user logged in (from auth provider T15), loads cart from Supabase via `getCartItems()`. If guest, uses zustand persisted state.
  - `src/app/[locale]/cart/page.tsx`: server component shell + client cart view. Renders cart items from store (guest) or Supabase (authed). Shows subtotal in VND.
  - Cart merge: on `SIGNED_IN` auth event (from auth provider), call `mergeGuestCart(userId, guestItems)` server action. Merge: dedup by variant_id, sum quantities. Idempotent via `carts.merged_from_guest_id`. Uses admin client (service role) for merge. After merge, clear guest localStorage.
  - `src/components/cart/cart-icon.tsx` ('use client'): header cart count badge. Reads from zustand store (guest) or Supabase cart (authed).
  - Add to cart: `src/components/products/add-to-cart.tsx` ('use client') — button on PDP product card. Calls `addItem` (guest) or server action `addCartItem` (authed).
  Must NOT do: NO stock decrement on add to cart. NO cart expiration. NO client-side Supabase calls for authed cart (use server actions). NO service role in client code.
  Parallelization: Wave 5 | Blocked by: T3,T6,T15 | Blocks: T20
  References: zustand persist with skipHydration (prevent React 19 hydration mismatch). Cart tables from T3 (carts, cart_items). mergeGuestCart from T6 (admin client, idempotent). Auth provider from T15 (onAuthStateChange SIGNED_IN). Variants: id, price, packshot_url, name. VND format. React Compiler: verify zustand store works under compiler — if memoization breaks the store, opt out per-file with `"use no forget"` directive at top of `cart-store.ts` (verify exact directive name against React Compiler docs at implementation time).
  - Race condition: add-to-cart during in-flight merge. Mitigation: cart-provider tracks a `isMerging` boolean in state. While `isMerging === true`, guest `addItem` calls queue in an in-memory array. When merge completes, queued items are flushed to Supabase. If merge fails, items stay in localStorage and re-queue on next login attempt.
  Acceptance criteria: Guest adds item → item in localStorage. Authed adds item → item in Supabase cart. Login with guest cart → merge fires, items in Supabase cart with summed quantities. Login twice → no duplicate quantities (idempotency). Cart icon shows count.
  QA scenarios: Playwright — add guest item, login, assert merged cart in Supabase with correct qty. Login twice → no duplicates. Logout → guest cart empty (cleared). Evidence: .omo/evidence/task-19-nanohome-ecommerce.txt
  Commit: Y | feat(cart): hybrid guest localStorage + authed Supabase cart with login merge

- [ ] 20. C7b — Checkout form: order capture (no payment), react-hook-form + zod
  What to do:
  - `src/app/[locale]/checkout/page.tsx`: server component shell + client checkout form. Protected route (redirect to login if no session — but allow guest checkout with email).
  - `src/components/checkout/checkout-form.tsx` ('use client'): react-hook-form + zod. Fields: email (citext), full_name, phone, address, city, district, ward, note. Zod schema: email valid, phone Vietnamese format, required fields.
  - On submit: server action `createOrder` (from T6 `orders.ts`). Creates order with status='pending', order_number (pg_hashids format NH-YYMMDD-XXXXX), subtotal from cart items. Creates order_items from cart. Creates order_status_history entry (status='pending'). Clears cart after order.
  - Order confirmation: `src/app/[locale]/checkout/confirmation/page.tsx` — shows order_number + summary. No email sent (deferred).
  - If cart empty → redirect to /products.
  Must NOT do: NO ZaloPay payment. NO stock decrement at capture — oversell is an accepted v1 limitation (multiple users can order the last item; resolved by manual inventory review in Supabase Studio). Document in `README.md` under "Known limitations". NO email notification. NO admin order status change (deferred). NO payment gateway integration.
  Parallelization: Wave 5 | Blocked by: T3,T6,T19 | Blocks: —
  References: Orders/order_items/order_status_history from T3. createOrder from T6. Cart from T19. pg_hashids for order numbers (NH-YYMMDD-XXXXX). VND subtotal. Guest checkout allowed (user_id null in orders). Protected route but email-only checkout allowed.
  Acceptance criteria: `curl localhost:3000/vi/checkout` 200 (or redirect to login if no cart). Form submit creates order in DB with status='pending'. Order_number generated. Cart cleared after order. Empty cart → redirect.
  QA scenarios: Playwright — fill checkout form, submit, assert order created in Supabase (verify via list_tables or dashboard), cart cleared, confirmation page shows order_number. Failure: invalid email → zod validation error. Empty cart → redirect. Evidence: .omo/evidence/task-20-nanohome-ecommerce.txt
  Commit: Y | feat(checkout): order capture form with zod validation (no payment)

- [ ] 21. C11 — SEO + sitemap + robots + structured data + Vercel deploy config
  What to do:
  - `src/app/[locale]/sitemap.ts`: dynamic sitemap. Fetch all approved products (1083), categories (15), news (61), brands (30), designers (192). Generate URLs for both locales (vi + en). Filter validated=true AND approved=true. `revalidate = 3600`.
  - `src/app/robots.ts`: allow all, disallow `/api/`, sitemap URL.
  - `src/app/[locale]/products/[airtableId]/[slug]/page.tsx`: add JSON-LD `Product` structured data (name, image, description, brand, offers with price in VND, availability from in_stock).
  - `src/app/[locale]/news/[airtableId]/page.tsx`: add JSON-LD `Article` structured data (headline, image, datePublished).
  - Root layout: add `Organization` JSON-LD (name: nanoHome, url, logo, contactPoint: (+84) 33 948 7632).
  - BreadcrumbList JSON-LD on all nested routes (products > category > product).
  - `vercel.json`: cron job for AMIS sync (from T17), framework preset next, regions sin1 (ap-southeast-1 to match Supabase).
  - `next.config.ts`: verify `metadataBase` set to production URL for OpenGraph.
  - All `generateMetadata()` functions (from T10-T14): verify meta_title/meta_description from DB fields used, fallback to translations. Homepage (`/[locale]/page.tsx`) metadata reads from translations only (no DB fallback — no record to read from). PDP/news/PLP/category/brand/designer pages read from DB fields with translation fallback.
  Must NOT do: NO OpenGraph images generation (deferred). NO canonical URL tags for alternate locales (next-intl handles via alternateLinks). NO Google Search Console verification (user adds later).
  Parallelization: Wave 6 | Blocked by: T10,T11,T12,T13,T14 | Blocks: —
  References: Products 1083, variants 2209, categories 15, news 61, brands 30, designers 192. JSON-LD: schema.org Product, Article, Organization, BreadcrumbList. Vercel cron: vercel.json `{ "crons": [{ "path": "/api/cron/amis-sync", "schedule": "*/15 * * * *" }] }`. Region sin1 for ap-southeast-1. meta_title/meta_description fields on products, variants, news, categories, brands.
  Acceptance criteria: `curl localhost:3000/sitemap.xml` returns valid XML with product URLs. `curl localhost:3000/robots.txt` returns robots with sitemap link. PDP page HTML contains JSON-LD Product script. `bun run build` succeeds with sitemap generation.
  QA scenarios: `curl localhost:3000/sitemap.xml` — assert contains product URLs for both locales. `curl localhost:3000/robots.txt` — assert disallows /api/. Playwright — PDP page has `script[type="application/ld+json"]` with Product schema. Evidence: .omo/evidence/task-21-nanohome-ecommerce.txt
  Commit: Y | feat(seo): sitemap + robots + JSON-LD structured data + Vercel deploy config

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — verify all 21 todos implemented, all Must-NOT-Have constraints respected, no scope creep (no Figma UI, no ZaloPay, no Korean, no admin, no email)
- [ ] F2. Code quality review — `bun run build` zero errors, `bunx tsc --noEmit` passes, ESLint passes, no `any` types, no console.log in production code
- [ ] F3. Real manual QA — Playwright full suite: all routes resolve (vi + en), auth flow works, cart merge works, checkout creates order, search returns results, AMIS sync runs
- [ ] F4. Scope fidelity — verify no shadcn components beyond allowed list, no next-cloudinary, no Million.js, no Sentry, no pg_cron, no service role in client code

## Commit strategy
- Conventional commits, one commit per todo (or per wave if todos are small)
- Format: `feat(scope): summary` / `fix(scope): summary` / `test(scope): summary`
- Scopes: scaffold, env, schema, data, routes, i18n, home, products, pdp, news, static, auth, search, sync, cart, checkout, seo, test, rls
- Branch: main (greenfield, single-developer) or feature branch if preferred

## Success criteria
- All 21 todos completed with agent-executed QA evidence in .omo/evidence/
- All 4 final verification checks APPROVE
- `bun run build` succeeds with zero errors
- `bunx tsc --noEmit` passes
- All Playwright tests pass
- All pgTAP RLS tests pass
- All routes resolve in both vi and en locales
- AMIS sync route handler returns 200 with CRON_SECRET
- Cart merge is idempotent (verified by double-login test)
- Search returns results for Vietnamese and English queries
- Sitemap.xml contains product URLs for both locales
- JSON-LD structured data present on PDP and news pages
- No Must-NOT-Have items present in codebase (verified by F4 scope fidelity)
