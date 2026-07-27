# Plan 04 Account Handoff

## Scope delivered locally

- Account-owned localized completion surfaces at `/{locale}/auth/email-link` and `/{locale}/auth/action`.
- Both surfaces reject unsupported locales and normalize `returnTo` with `safeAccountReturnTo`; they render neutral localized copy and a local continuation link only.
- Stable `Account` message namespace parity in `messages/vi.json`, `messages/en.json`, and `messages/ko.json`.
- Local Account sign-in flow remains a fake-bound implementation. It is not a provider, session, or migration implementation.

## Exact Foundation deltas required

Foundation owns the following changes. This lane does not supply them.

1. **Auth/session adapter contract:** expose a server-owned, provider-neutral session boundary that resolves a verified internal account or an anonymous state. It must support account-route protection, recent-auth evidence, session revocation, and safe redirect construction without exposing raw provider tokens to UI code.
2. **Customer identity and migration:** add an internal UUID `customer_accounts` identity and map arbitrary Firebase UID strings to it. Backfill legacy Supabase-auth ownership as additive forward migrations. Update profile, cart, order, conversation, vision/Storage, AMIS-link, and personalization ownership/RLS/RPC assumptions that currently depend on `auth.users` or `auth.uid()`.
3. **Durable wishlist and cart:** create account-scoped persistence plus one-time, idempotent guest merge receipts. The receipt must record the merge key/result so retries and multiple tabs cannot duplicate or resurrect items. Browser state remains intent only until the server returns the canonical set/cart.
4. **Trusted catalog presentation:** publish one server catalog eligibility/presentation boundary for Account wishlist, cart, offers, and orders. It must resolve current public identity, visibility, price/stock state, images, and retired products from canonical data; UI must not trust local snapshots.
5. **Offers persistence and eligibility:** add `offers`, account eligibility, reservation/redemption, rule/version, expiry, and order-adjustment contracts. The server evaluates eligibility and revalidates/snapshots a selected offer at checkout; no CRM segment or explanation reaches the browser.
6. **AMIS preferences and recent auth:** persist Account personalization settings, gate AMIS-history effects on a verified AMIS link and feature flag, and require recent authentication for reset/disconnect/delete effects. Invalidate account-private recommendation caches immediately after destructive preference changes.
7. **Security Firebase operations:** establish Firebase/Identity Platform session-cookie verification and revocation, verified identity linking/unlinking, password/contact changes, logout-all, and audited deletion. Kakao unlink requires its separate server-side callback/administrative cleanup contract; visible UI removal is insufficient.

## Fake replacement boundaries

| Local boundary | Current behavior | Foundation/integration replacement |
| --- | --- | --- |
| `src/lib/account/auth-port.ts` | Deterministic fake responses only; no session persistence or provider calls | Provider-neutral auth/session adapter backed by Firebase session cookies and verified identity mapping |
| `src/app/api/account/auth-flow/route.ts` | Parses a local Account request and uses the fake port | Server actions/routes for the real five-method flow, CSRF/state handling, session issuance, and neutral errors |
| `src/components/account/account-auth-flow.tsx` | Collects UI input and calls the local fake route | Wire exactly email link, email/password, Google, Kakao OIDC, and phone SMS OTP after provider, callback, and emulator/production proofs |
| `src/app/[locale]/auth/email-link/page.tsx` and `action/page.tsx` | Locale/return-path-safe presentation landing surfaces | Keep these safe local surfaces; attach only the verified adapter outcome needed for neutral status/continuation copy |

## Migrations, environment, and ports

### Forward migrations only

- Create provider-neutral account and identity tables, then backfill legacy user references without changing existing migration history.
- Convert or replace direct Supabase-auth foreign keys, triggers, RLS policies, RPC ownership checks, storage-folder checks, and UUID-only assumptions with the internal account UUID mapping.
- Add durable wishlist/cart/guest-merge receipt, Account preferences, offer eligibility/reservation, and required audit/revocation records as additive migrations.
- Rehearse rollback and non-UUID Firebase UID access with representative redacted data before any customer cutover. No migration runs in this Account lane.

### Environment and activation

- Foundation must add conditional, typed configuration owned by the environment matrix: `AUTH_PROVIDER`, `ACCOUNT_CENTER_ENABLED`, rollout percentage, legacy-login overlap, Firebase browser configuration, Firebase Admin credential mode, session-cookie TTL/name, and optional development emulator values.
- Enable Firebase/Identity Platform, authorized domains, email templates, SMS regions/budget, Google, Kakao OIDC, and Kakao callback/unlink configuration outside this codebase lane. Keep credentials and migration keys out of source, logs, tests, and browser bundles.
- Account UI remains disabled or fake-backed until the adapter can prove the configured provider mode. Missing live credentials must not break the existing provider-disabled build.

### Ports and ownership

- The Account UI consumes only a verified Account session/context, Account repositories, canonical catalog presentation, offer eligibility, preference, and recent-auth ports.
- Foundation owns session, identity, migration, RLS, Firebase Admin, provider callback, and security operation contracts. Commerce owns authoritative cart/order checkout state; AMIS owns source CRM records; catalog owns visibility/price/stock presentation.
- Do not edit shared auth, Firebase, Supabase, environment, database-type, migration, or root-layout contracts from this lane.

## Header cutoff

- Preserve the existing header behavior until Foundation exposes the verified session adapter.
- At integration, unauthenticated account affordance opens the existing sign-in entry; authenticated affordance links to `/{locale}/account`; explicit logout belongs in Account Center and does not replace the account affordance.
- Do not merge a header/root-layout/session cutover with these local landing surfaces. That change belongs to Foundation/integration after the adapter contract and rollout controls exist.

## Test and QA handoff

- Keep direct tests for both landing pages: supported locale normalizes a local `returnTo`, external/cross-locale input falls back to locale home, and unsupported locale returns `notFound`.
- Keep an exact-key parity test for the `Account` namespace across `vi`, `en`, and `ko`; every delivered Account UI key must exist in all three catalogs before use.
- Foundation must add unit, integration, SQL/RLS, and authenticated browser coverage for all five methods, session issue/revoke, provider collision/link/unlink, non-UUID Firebase UID mapping, guest merges, private-cache invalidation, phone-only account access, and neutral error handling.
- Before canary: test desktop/mobile route protection and return-path safety, keyboard/focus behavior, provider callback failures, logout/account-switch cache isolation, migration rehearsal, accessibility, locale rendering, and rollback. Run visual QA after the real Account shell/header integration, not against these neutral placeholders alone.

## Local Account completion delta (2026-07-27)

- Localized Account shell, profile, orders/detail, wishlist, cart, offers, preferences, security, sign-in, and completion UX in Vietnamese, English, and Korean. Date/currency presentation now follows active locale.
- Kept fake auth boundary unchanged: all five method selectors and local OTP/error/completion states are presentation-only until Foundation supplies verified provider/session contracts.
- Automated evidence:
  - `npx vitest run messages/account-parity.test.ts src/components/account/*.test.tsx src/lib/account/account-ports.server.test.ts --reporter=default` — exit 0; 35 tests passed.
  - `npx tsc --noEmit --pretty false` — exit 0.
  - `npx eslint "src/app/[locale]/account/**/*.tsx" "src/components/account/*.tsx" "messages/account-parity.test.ts"` — exit 0.
  - `npm run build` (`next build --webpack`) — exit 0.
- Browser/accessibility evidence on local Next server (`127.0.0.1:3107`): Playwright found one localized sign-in heading and one localized completion heading for each `vi`, `en`, and `ko`; first Tab focus landed on a button; accessibility snapshot exposed named Account navigation, method buttons, email textbox, and continue button. Screenshot: `account-complete-ko.png` in Playwright artifacts. Dev-only HMR WebSocket handshake errors were observed; HTTP pages returned 200 and rendered successfully.
- Rollback: revert the bounded Account localization commits. No migrations, environment schema, generated types, lockfiles, cloud configuration, credentials, deployment, or live data changed.

## Remaining external blockers

- Real Firebase/provider sessions, identity mapping, route protection, durable cart/wishlist and guest merge, persisted offers/preferences/security effects, cross-account RLS, phone-only authenticated accounts, and live provider callback QA remain blocked on Foundation contracts and cloud configuration listed above.

## No hidden completion work

This handoff does not claim Firebase setup, provider console configuration, secrets, migration execution, RLS replacement, real session wiring, durable commerce state, offer activation, AMIS activation, header cutover, deployment, or customer migration. Those items remain explicit Foundation/integration work.
