---
slug: nanohome-ecommerce
status: approved (generating plan)
intent: clear
pending-action: append todos + fill TL;DR in .omo/plans/nanohome-ecommerce.md
approach: 12-component code-structure plan (C1-C12) for nanoHome e-commerce. Next.js 16 + Supabase + Tailwind v4 + next-intl (vi/en) + React Compiler. No Figma UI, no ZaloPay payment, no Korean, no Rooms in v1.
---

# Draft: nanohome-ecommerce

## Environment + Supabase (verified)
- Working dir: /Users/iant1359/Develop/temp-nanohome — empty git repo. Greenfield. macOS darwin.
- Supabase project `temp-nanohome`, id `ithwvxvaomqbtlxbubtj`, region ap-southeast-1, ACTIVE_HEALTHY, Postgres 17.
  - URL: https://ithwvxvaomqbtlxbubtj.supabase.co
  - Publishable key: sb_publishable_G8R20MBpTRjY1Z0Jrwe3tQ_28K2ZhHV (legacy anon also available).
  - Org: iant1359 (id htoxccflkxuodayomuoh).
  - Raw SQL execute BLOCKED for MCP token; list_tables/list_migrations/get_advisors/apply_migration work.
- Only migration: 20260617120000_add_categories_parent_id_self_fk.
- Advisor: 1 WARN — `public.touch_updatedat` mutable search_path (fixable later).

## Supabase schema (verified, all RLS-enabled)
brands(30), designers(192), categories(15, parent_id self-FK), products(1083, FKs→brands/designers/categories), variants(2209, FK→products, price/compare_at_price/discount_percent/in_stock/on_sale/sku/finish/gallery_urls), news(61), catalogs(16, FK→brands), product_designers(junction), news_products(junction), news_variants(junction).
MISSING tables (need migrations): carts, cart_items, orders, order_items, order_status_history, profiles, amis_sync_log.

## Extensions available
pg_cron(1.6.4), pg_net(0.20.3), http(1.6), supabase_vault(0.3.1 INSTALLED), citext, pg_hashids, pg_trgm, pgroonga(3.2.5 Vietnamese FTS), pg_graphql(1.5.11), index_advisor, pgtap, vector, wrappers.

## nanohome.vn routes (verified)
Bilingual /en-US + /vi. Routes: /products, /products/category/{slug}, /products/{airtableId}/{slug} PDP, /news, /news/{airtableId}, /brands, /designers, /catalogs, /clearance, /about, /policies, /services/interior-decoration, /services/lighting-design, /beautifulliving. Images: Cloudinary (res.cloudinary.com/nanohome-web) + ImageKit. Contact: (+84) 33 948 7632, info@nanohome.vn.

## Components (topology ledger) — 12 components
| id | outcome | status | evidence |
| C1 | Scaffold + Next 16 + Tailwind v4 + i18n (vi/en) + Supabase wiring + types + next/image remotePatterns | active | greenfield repo |
| C2 | Supabase schema extension (carts/cart_items/orders/order_items/order_status_history/profiles/amis_sync_log) + RLS + vault + pg_cron | active | schema verified via MCP |
| C3 | Homepage code structure (hero/stylist picks/design trends/showrooms data fetch) | active | nanohome.vn |
| C4 | Product List code structure (category/brand/designer/sale/filter/sort/pagination) | active | nanohome.vn routes |
| C5 | PDP code structure (variant selector, gallery, price/stock, related, news cross-link) | active | nanohome.vn routes |
| C6 | News list + detail code structure | active | nanohome.vn routes |
| C7 | Hybrid cart (guest localStorage + authed Supabase, merge on login) + checkout FORM (no payment) | active | user decision F5/F6 |
| C8 | Auth (email/pass + Google + Facebook via Supabase Auth) | active | user decision F7 |
| C9 | AMIS one-way sync (AMIS→Supabase, Vercel Cron + Next Route Handler, sync log + delta) | active | user decision F3 |
| C10 | Brands/Designers/Catalogs/Showrooms/static pages code structure | active | nanohome.vn routes |
| C11 | SEO + sitemap + robots + structured data + Vercel deploy config | active | user decision F8 |
| C12 | Search (pgroonga Vietnamese FTS, search bar + /search route + results grid) | active | user approved m0027 |

## Decisions (with rationale)
- F1 Figma: DEFERRED — UI is separate later plan. Code structure only.
- F4 i18n: vi + en in v1. Korean deferred. i18n infra locale-agnostic (next-intl [locale] segment).
- F5 Cart: Hybrid — guest localStorage + authed Supabase carts/cart_items, merge on login (dedup by variant_id, sum quantities).
- F6 Checkout: DEFERRED ZaloPay — v1 = cart + checkout FORM (order capture, no payment). Orders saved pending/quote.
- F7 Auth: email/password + Google + Facebook (Supabase Auth).
- F8 Hosting: Vercel.
- F9 Rooms: DEFERRED (no rooms table/data).
- F10 Korean: DEFERRED (vi+en only in v1).
- F3 AMIS: User HAS AMIS OpenAPI credentials. One-way AMIS→Supabase (read-only).
- F11 Million.js: DROP — use React Compiler only (Next 16 stable).
- AMIS sync runner: Vercel Cron + Next Route Handler (adopted default, reversible).
- Admin order viewer: DEFERRED — Supabase Studio for v1 (adopted default).
- Sentry: DEFERRED — Axiom only for v1 (adopted default).
- Image optimization: next/image only with remotePatterns for Cloudinary + ImageKit (user chose over next-cloudinary).

## Final stack (all latest, verified June 2026)
- next 16.2.7 (React 19.2, Turbopack, React Compiler stable)
- tailwindcss v4.3.1 (CSS-first @theme, OKLCH)
- shadcn/ui 4.12.0 (new-york, tw-animate-css, sonner, data-slot)
- @tanstack/react-query 5.101.0 + devtools
- next-intl (latest, [locale] segment, createNextIntlPlugin, setRequestLocale, NextIntlClientProvider, hasLocale)
- keen-slider 6.8.6
- @supabase/ssr + supabase-js v2
- zustand (cart client state)
- react-hook-form + zod (checkout form)
- @axiomhq/nextjs 0.2.0 + @axiomhq/js (NOT next-axiom — that's maintenance-only)
- @microsoft/clarity (latest)
- Tests: Vitest + RTL + Playwright + pgTAP
- React Compiler (built-in, no Million.js)

## Scope IN
Code structure for: scaffold, schema extension, homepage, product list, PDP, news, cart, checkout form, auth, AMIS sync, brands/designers/catalogs/showrooms/static pages, SEO, search. All with routes, data layers, server/client component boundaries, types, RLS policies, tests.

## Scope OUT (Must NOT have)
- NO Figma UI implementation (deferred to separate plan)
- NO ZaloPay payment processing (deferred — checkout form captures orders only)
- NO Korean locale (deferred — vi+en only)
- NO Rooms feature (deferred — no schema data)
- NO AMIS write-back (one-way AMIS→Supabase only)
- NO Million.js (React Compiler instead)
- NO next-cloudinary loader (next/image with remotePatterns only)
- NO Sentry (deferred — Axiom only)
- NO admin order viewer UI (Supabase Studio for v1)
- NO raw SQL execute via MCP (token lacks scope — use apply_migration)

## Approval gate
status: APPROVED (user said "OK" m0029). Generating plan now.
