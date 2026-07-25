# Plan 04 — Account Center and Firebase Authentication Migration

Status: implementation-ready after the Phase 0 identity spikes pass
Baseline: `origin/codex/ai-commerce-staging@b4d28a3`
Reference reviewed: `https://new.nanohome.vn/account` and its visible account/auth navigation on 2026-07-25

## 1. Outcome

Build a production Account Center that matches the current nanoHome visual language and supports:

- personal profile;
- order list and order detail;
- wishlist;
- cart;
- customer offers;
- personalization settings;
- login/security method management.

Replace Supabase Auth with Firebase Authentication while keeping Supabase Postgres, Storage, and the existing commerce data. Supported sign-in methods are exactly:

1. passwordless email magic link;
2. email and password;
3. Google;
4. Kakao Login, covering the requested KakaoTalk method and using Kakao-approved button copy/assets;
5. phone number only through SMS OTP.

“Passwordless” in this plan means a Firebase email sign-in link. It does not mean passkeys or a custom six-digit email OTP.

The migration is complete only when existing customers keep the same carts, orders, conversations, personalization links, and profile data, including customers whose new Firebase UID is not a UUID.

## 2. Current truth

### 2.1 Live reference audit

The authenticated desktop reference currently shows:

- an off-white account background;
- a left account navigation column and a large white content card;
- “Tài khoản”, “Thông tin cá nhân”, “Quản lý đơn hàng”, “Sản phẩm yêu thích”, “Giỏ hàng”, “Ưu đãi dành cho bạn”, and “Đăng xuất”;
- a help/contact block below the navigation;
- a “Thông Tin Cá Nhân” form with name, phone, read-only provider email, birthday, nationality, and gender;
- two warm-beige notification blocks with a dark left border;
- a black “Lưu thông tin” primary action;
- two-column fields on desktop and a single-column form on mobile.

The mobile reference changes the account navigation into a compact selector-like block and keeps the content as a single white card. The form remains usable in one column, and the help block moves below the main navigation.

The unauthenticated reference uses a right-side auth drawer:

- approximately `392px` wide on desktop and full width on small screens;
- white surface, dark overlay, close button, and keyboard-scrollable content;
- underlined inputs;
- black primary CTA;
- warm-brown text actions;
- bordered social-provider actions;
- login, forgot-password, and registration states without leaving the current storefront page.

Observed limitations in the reference must not be copied as requirements:

- an incomplete Google profile disabled most account navigation;
- an unauthenticated direct visit to `/account` rendered storefront content instead of a clear auth redirect;
- the visible profile guidance assumed that every account must have an email.

The new implementation keeps the reference design, but:

- order history and security remain accessible even when optional profile fields are incomplete;
- a valid phone-only account is not forced to add an email;
- direct unauthenticated account access has an explicit, testable redirect/login behavior.

### 2.2 Staging code audit

The staging baseline has no account route tree under `src/app/[locale]/account`.
An existing registration test redirects to `/vi/account`, so the documented post-registration destination currently resolves to a missing page.

Existing reusable foundations include:

- a query-string-driven auth drawer in `src/components/auth`;
- focus return, Escape handling, overlay close, and an initial focus trap;
- nanoHome color tokens and shared CTA styling;
- localStorage cart/wishlist UI contexts, canonical product cards, and partial cart/order/profile/personalization database foundations;
- no durable wishlist table, while the old commerce-cart API is explicitly retired and the visible cart is not yet converged with database cart rows;
- Vietnamese, English, and Korean locales;
- Vitest, Playwright, and Percy test infrastructure.

Current authentication is Supabase-specific:

- `/auth/sign-in` uses `signInWithPassword`;
- `/auth/sign-up` uses `signUp`;
- forgot/reset routes call Supabase Auth directly;
- `/auth/sign-out` signs out a Supabase session;
- the locale layout reads a Supabase session;
- that layout derives authentication UI from `getSession()`, while the current middleware does not perform the session refresh its server helper comments assume;
- checkout and customer-context APIs call `supabase.auth.getUser()` or `getSession()`;
- the authenticated header replaces the account action with a logout icon instead of linking to an account center.
- reset-password UI requires eight characters, but the shared server credential schema currently accepts a one-character non-empty password.

Current data ownership is also Supabase-Auth-specific:

- `profiles.id` references `auth.users(id)`;
- carts, orders, conversations, vision records, and AMIS customer links contain UUID user/owner columns;
- multiple RLS policies and RPCs compare ownership with `auth.uid()`;
- `handle_new_user` provisions profiles from an `auth.users` trigger.

The audited migrations contain at least ten tables and eleven ownership columns with direct `auth.users` coupling, in addition to checkout RPC, storage-folder, and identity-binding assumptions.

Firebase users do not create Supabase `auth.users` rows, and a Firebase UID is an arbitrary string. Replacing only the frontend SDK would break profile provisioning, foreign keys, and RLS.

### 2.3 Baseline audit anchors

| Surface | Baseline evidence |
| --- | --- |
| Authenticated header has logout but no account link | `src/components/header.tsx:350–388` |
| Existing reusable drawer | `src/components/auth/auth-panel.tsx:95–147` |
| Supabase session bootstrap | `src/app/[locale]/layout.tsx:45–53` |
| i18n/CA middleware without account protection | `src/middleware.ts:9–26` |
| Supabase auth handlers | `src/app/auth/*/route.ts` |
| Commerce `auth.users` ownership | `supabase/migrations/20260628000000_add_commerce_tables.sql` |
| Profile trigger and `auth.uid()` RLS | `supabase/migrations/202606280004_add_profiles_and_trigger.sql` |
| AMIS/customer ownership | `supabase/migrations/20260721020000_plan01_customer_data_foundation.sql` and `20260721040000_plan03_amis_customer_memory.sql` |
| Chat ownership | `supabase/migrations/20260721050000_plan04_grounded_chat_persistence.sql` |
| Vision/storage ownership | `supabase/migrations/20260721070000_plan06_vision_persistence.sql` |
| Checkout RPC reads `auth.uid()` | `supabase/migrations/20260710000000_capture_order_from_cart.sql` |

## 3. Decisions and non-goals

### 3.1 Decisions

- Use Firebase Authentication upgraded with Google Cloud Identity Platform.
- Use Kakao's standards-based OpenID Connect integration as `oidc.kakao`.
- Keep Supabase as the application database and storage platform.
- Introduce an internal UUID account key independent of every auth provider.
- Keep account data access server-owned; retain RLS as defense in depth and for approved Firebase-ID-token browser flows.
- Use Firebase HttpOnly session cookies for Next.js server authorization.
- Keep a Firebase client session only where a fresh Firebase ID token is required.
- Remove the global personalization consent gate, but retain specific privacy disclosures, account controls, and data lifecycle rules.
- Preserve the current account/drawer visual language and extend it with the required auth methods.

### 3.2 Non-goals

- Do not migrate commerce data out of Supabase.
- Do not use an email or phone number as an authorization key.
- Do not auto-merge two accounts because their email strings match.
- Do not treat Kakao email as Kakao identity; Kakao's stable OIDC `sub` is the identity.
- Do not require an email for phone-only accounts.
- Do not expose the Supabase service-role key to the browser.
- Do not let a client-provided account ID select profile, order, cart, or CRM data.
- Do not build custom email OTP, passkeys, Facebook, Apple, or additional providers in this scope.
- Do not use Firebase session cookies as bearer tokens for the Supabase Data API.

Removing the personalization consent banner does not remove an approved Terms/Privacy acknowledgement for account creation or the phone-auth privacy disclosure.

## 4. Target route and page map

The staging application is locale-prefixed. Canonical routes are therefore `/{locale}/account/**`, with `vi`, `en`, and `ko`. A non-prefixed `/account/**` request should resolve the locale once and redirect to the canonical path.

| Route | Purpose | Main functions |
| --- | --- | --- |
| `/{locale}/account` | Personal information | View/edit profile, verification states, completeness guidance |
| `/{locale}/account/orders` | Order history | Filter, paginate, view approved purchases and quote/interest records truthfully |
| `/{locale}/account/orders/[orderId]` | Order detail | Items, totals, status timeline, payment/refund state, shipping, advisor contact |
| `/{locale}/account/wishlist` | Saved products | Reuse canonical product cards, remove, move/add to cart, stock-aware empty states |
| `/{locale}/account/cart` | Account cart view | Quantity, remove, totals, quote-only handling, continue to checkout |
| `/{locale}/account/offers` | Customer offers | Eligible offers, expiry, terms, apply/copy action |
| `/{locale}/account/preferences` | Personalization | Enable/disable product personalization, AMIS history, browsing history, reset/disconnect |
| `/{locale}/account/security` | Login and sessions | Linked providers, add/unlink method, password, verified contacts, logout all, delete account |

Route rules:

- unauthenticated direct navigation redirects to `/{locale}?auth=login&returnTo=<validated-account-path>`; the existing storefront shell then opens the login drawer;
- after successful login, return only to a same-origin, locale-valid allowlisted path;
- `/account/orders/[orderId]` returns `404` for both nonexistent and not-owned orders;
- profile completeness never gates orders, security, or privacy controls;
- cart and wishlist counts use the same canonical state as the header/drawers;
- account pages are never statically cached across users.

## 5. Account design specification

### 5.1 Shared shell

Create:

- `src/app/[locale]/account/layout.tsx`
- `src/components/account/account-shell.tsx`
- `src/components/account/account-navigation.tsx`
- `src/components/account/account-mobile-navigation.tsx`
- `src/components/account/account-help-card.tsx`

Desktop behavior:

- reuse `--nh-surface-warm` for the page background;
- use a constrained storefront container aligned with the existing header/footer;
- navigation column around `240–280px`;
- remaining width is a white content card;
- use existing `--nh-ink`, `--nh-muted`, `--nh-border`, `--nh-accent`, and `--nh-highlight`;
- active navigation uses text weight/color and a visible marker, not color alone;
- counts are server-derived and update after cart/wishlist mutations;
- the help phone number is a configured content value, not duplicated in components.

Mobile behavior:

- switch to a compact, labeled account navigation control;
- keep a visible page title and current-section label;
- single-column content;
- minimum `44px` interactive targets;
- account for safe-area and virtual-keyboard insets;
- no horizontal form scrolling;
- sticky action bars are allowed only when they do not cover validation or keyboard content.

Shared states:

- skeleton shape matching the final layout;
- section-specific empty state;
- recoverable inline error with retry;
- `not-found` for inaccessible records;
- a generic account error boundary without leaking provider/database details.

Header behavior:

- unauthenticated account icon opens the auth drawer;
- authenticated account icon links to `/{locale}/account`;
- logout remains an explicit Account Center action and must not replace the account icon.

### 5.2 Personal profile

Create:

- `src/app/[locale]/account/page.tsx`
- `src/components/account/profile-form.tsx`
- `src/components/account/profile-notice.tsx`
- `src/lib/account/profile-schema.ts`

Fields:

- full name;
- verified primary email when one exists;
- verified primary phone when one exists;
- date of birth;
- nationality;
- gender/preferred form of address;
- locale preference.

Rules:

- verified provider identifiers are read-only in the profile form and changed through Security;
- a Kakao-returned email is provider metadata, not a verified primary contact, until Phase 0 proves an `email_verified` mapping or nanoHome verifies it by email link;
- phone-only users see “Chưa thêm email”, not a validation error;
- email-only users may add and verify a phone from Security;
- date of birth, nationality, and gender are optional until nanoHome documents a concrete business purpose;
- minimum usable profile is a display/full name plus at least one verified login/contact method;
- checkout can ask for delivery name, delivery phone, and address without making those global account requirements;
- patch only changed fields;
- normalize Unicode, phone, dates, and empty values server-side;
- return field errors without discarding user input;
- audit changed field names, actor, and timestamp, never raw before/after PII in normal logs.

The two reference notice blocks become data-driven:

1. provider/verification information;
2. missing recommended fields.

They disappear or change copy when no longer relevant.

### 5.3 Orders

Create:

- `src/app/[locale]/account/orders/page.tsx`
- `src/app/[locale]/account/orders/[orderId]/page.tsx`
- `src/components/account/order-list.tsx`
- `src/components/account/order-card.tsx`
- `src/components/account/order-status-timeline.tsx`
- `src/lib/account/orders.server.ts`

List functions:

- tabs or filters for “Tất cả”, “Đã mua”, “Báo giá/đang quan tâm”, “Đang xử lý”, and “Hoàn tất” only when the underlying status mapping is reliable;
- cursor pagination ordered by effective order date and stable ID;
- code, date, item preview, total, payment status, fulfillment status, and source;
- clear distinction between an AMIS approved purchase and a non-approved quote/interest record;
- no invented total or status when AMIS fields are missing.

Detail functions:

- line items linked to canonical products when still available;
- historical name, SKU, image, quantity, and price snapshot preserved when a product changes;
- subtotal, discount, shipping, tax, and final total when available;
- SePay payment/reconciliation state from Plan 02;
- refund status described truthfully as manual/provider-specific;
- delivery address shown only to the authenticated owner;
- status history and Customer Advisor action;
- invoice/download action only when a real document exists.

Ownership:

- the server derives `accountId` from the verified session;
- no API accepts `accountId`, email, or phone as an ownership selector;
- not-owned and missing orders share the same response behavior;
- raw AMIS notes, debt, margin, and internal comments never enter this page.

### 5.4 Wishlist

Create:

- `src/app/[locale]/account/wishlist/page.tsx`
- `src/components/account/account-wishlist.tsx`
- `src/lib/account/wishlist-repository.server.ts`
- account-scoped wishlist mutation handlers;

Rules:

- reuse the storefront product-card component rather than creating a divergent account card;
- support remove and add/move-to-cart with optimistic UI plus server rollback;
- show current stock/price from the canonical catalog, not a stale wishlist snapshot;
- keep the item saved if add-to-cart fails;
- unavailable products remain identifiable and removable;
- empty state links back to products;
- unauthenticated wishlist remains a versioned local draft;
- authenticated wishlist is durable in Supabase and is the source of truth across devices;
- login posts canonical variant IDs to one merge endpoint and merges exactly once using an idempotency key;
- the server validates every variant, upserts by `(account_id, variant_id)`, returns the canonical set, and only then allows the browser to clear merged local state.

### 5.5 Cart

Create:

- `src/app/[locale]/account/cart/page.tsx`
- `src/components/account/account-cart.tsx`
- `src/lib/account/cart-repository.server.ts`
- a new account-scoped cart API/server-action contract; do not silently revive the retired `/api/commerce/cart`;

Rules:

- converge the localStorage cart context, account page, header drawer, database cart, and checkout onto one canonical authenticated cart service;
- support quantity, removal, totals, quote-only items, and mixed-cart explanations;
- a refresh must not resurrect removed lines;
- login merges guest and account carts idempotently;
- duplicate variants combine according to canonical cart rules;
- guest localStorage contains product/variant intent only and never authoritative price, discount, or stock;
- merge validates variants, applies quantity limits, records an idempotency key, returns a versioned canonical cart, and clears guest state only after acknowledgement;
- authenticated mutations use optimistic version checks so concurrent tabs do not resurrect old quantities;
- current AMIS stock is revalidated at checkout, not trusted from the account render;
- SePay starts only from the durable checkout flow in Plan 02.

Phone-only checkout contract:

- add a forward migration that makes transactional order email optional while keeping delivery phone required;
- update `checkoutDeliverySchema` and every order DTO/test accordingly;
- never fill order email from unverified Kakao/provider metadata;
- when email is absent, show receipts/status in Account Center and use the approved phone/advisor notification path;
- verify that SePay `BANK_TRANSFER` and the actual AMIS tenant contract do not require email before enabling this path.

### 5.6 Offers

Create:

- `src/app/[locale]/account/offers/page.tsx`
- `src/components/account/customer-offer-card.tsx`
- `src/lib/account/offers.server.ts`

Rules:

- show only offers whose audience evaluation includes the current account;
- show validity, eligible products/categories, minimum amount, combination rules, and remaining use count;
- applying an offer never changes the order total until the server validates it;
- do not expose segmentation labels, CRM fields, or why another customer has a different offer;
- expired/used offers move to a secondary state or disappear according to the business rule;
- empty state does not imply that the customer lacks an AMIS record.

Phase 1 source of truth is nanoHome Postgres, not an invented AMIS promotion API.

Add:

`offers`

- code, localized title/terms;
- adjustment type/value and maximum;
- eligible product/category scope;
- minimum order amount;
- start/end/status/version;
- total/per-account limits and combination policy.

`customer_offer_eligibility`

- `offer_id`, `account_id`;
- approved source/rule version;
- eligibility start/end;
- no raw CRM segment or reason exposed to the browser.

`offer_reservations`

- `offer_id`, `account_id`, `order_id`;
- validated adjustment snapshot;
- `reserved | redeemed | released | expired`;
- idempotency and expiry.

Eligibility may later consume Plan 03's safe AMIS projection, but an approved server rule or staff import produces the explicit account eligibility row. Checkout revalidates and snapshots the offer; SePay success/IPN redeems it, while expiry/cancel releases it. Plan 02 must include the corresponding order-adjustment and reservation contract before offers are enabled.

### 5.7 Personalization settings

Create:

- `src/app/[locale]/account/preferences/page.tsx`
- `src/components/account/personalization-settings.tsx`

Settings:

- “Cá nhân hóa sản phẩm”;
- “Dùng lịch sử AMIS” when a verified AMIS link exists;
- “Dùng lịch sử duyệt”;
- “Xóa dữ liệu gợi ý”;
- “Ngắt liên kết AMIS”.

These are account settings, not a global consent wall. Defaults and retention follow Plan 03.
The page and persistence can ship with Account Center, but AMIS-history controls and recommendation effects stay feature-flagged until Plan 03's sync/link/projection acceptance passes.

Rules:

- turning a setting off takes effect on the next request;
- reset/disconnect requires confirmation and recent authentication for destructive effects;
- private recommendation caches are invalidated immediately;
- UI never shows raw AMIS identifiers or records;
- analytics/marketing consent, if legally required, remains a separate concern and is not inferred from personalization settings.

### 5.8 Security

Create:

- `src/app/[locale]/account/security/page.tsx`
- `src/components/account/login-methods.tsx`
- `src/components/account/session-actions.tsx`

Functions:

- show verified identities and capabilities: email with magic-link/password capabilities, Google, Kakao, and phone;
- show masked verified identifiers;
- add/link a new method after recent reauthentication;
- add/change password;
- do not offer “remove password but keep email link” unless a Firebase proof shows the shared email provider remains usable;
- verify/change email;
- verify/change phone;
- unlink a provider only when another usable login method remains;
- logout current session;
- revoke all Firebase refresh tokens and clear the current cookie;
- request account deletion with a confirmation/re-authentication flow.

Kakao deletion/unlink contract:

- Firebase logout, Kakao access-token logout, and Kakao unlink are separate operations;
- because nanoHome does not retain Kakao access tokens, server-side unlink uses the Kakao Service App Admin Key and the numeric Kakao `sub`;
- keep that Admin Key in the server secret manager only;
- expose a dedicated Kakao unlink callback URL;
- verify the callback `Authorization: KakaoAK …` header;
- acknowledge valid callbacks quickly with `200`, enqueue idempotent processing, and store a non-sensitive event ID/digest;
- reconcile Firebase provider state, the domain identity row, and retention/deletion state;
- removing the visible provider row without Kakao-side unlink or recorded cleanup is not sufficient.

## 6. Authentication UX and method contracts

### 6.1 Drawer state machine

Extend the existing drawer rather than replacing its shell:

```text
closed
  -> choose_method
      -> email_options
          -> email_password_sign_in
          -> email_magic_link_sent
          -> email_registration
          -> forgot_password_sent
      -> phone_entry
          -> phone_challenge
          -> phone_otp
      -> google_redirect
      -> kakao_redirect
  -> collision_reauthentication
  -> success
  -> recoverable_error
```

UX requirements:

- keep close, Escape, backdrop, scroll lock, focus trap, and focus return;
- restore the initiating element after close;
- preserve a validated `returnTo`;
- use neutral error copy to avoid account enumeration;
- show provider-specific progress and allow safe retry;
- never disable closing while an external provider page is open;
- announce errors/status with appropriate live regions;
- password show/hide retains focus and accessible label;
- loading states prevent double-submit without hiding recovery options;
- use redirect for mobile Google/Kakao flows and allow popup only where reliable;
- do not silently discover or select login method from an email address.

### 6.2 Method matrix

| UI method | Firebase implementation | Required setup | Important behavior |
| --- | --- | --- | --- |
| Passwordless | Email sign-in link | Enable Email/Password and Email link; authorized domains | Store email locally or ask again across devices; never put raw email in redirect URL |
| Email + password | Native email/password | Email templates, verification and reset domains | Keep enumeration protection enabled |
| Google | `GoogleAuthProvider` | Google provider and authorized domains | Redirect on mobile; handle collision by explicit linking |
| Kakao Login | `OAuthProvider("oidc.kakao")` | Identity Platform custom OIDC provider | Kakao `sub` is stable identity; email is optional metadata |
| Phone only | SMS OTP | Billing, SMS region policy, reCAPTCHA, authorized domains | E.164 normalization, resend cooldown, abuse controls, test numbers |

Firebase email magic-link and password sign-in share the email provider identity. Store/display the enabled sign-in capability separately instead of inventing two unrelated provider subjects for the same email account.

### 6.3 Passwordless email

Flow:

1. User enters email and explicitly chooses “Gửi liên kết đăng nhập”.
2. Client calls Firebase email-link send with `handleCodeInApp: true`, the current environment's Hosting/custom `linkDomain`, and an allowlisted `continueUrl`.
3. UI returns the same neutral sent state whether or not product policy reveals account creation.
4. Same-device completion retrieves the locally stored email.
5. Cross-device completion asks the user to re-enter the email.
6. Client completes `signInWithEmailLink`.
7. Client creates the server session, provisions the account mapping, merges guest state once, and follows `returnTo`.

The email-link callback validates origin, locale, mode, and `returnTo`. The raw email is never embedded in a URL.
Do not configure the retired Firebase Dynamic Links `dynamicLinkDomain`. Test magic-link, verification, and reset templates on every environment domain.

Firebase documents a special case for an unverified email/password account: completing email-link sign-in can remove the previous unverified password mechanism and invalidate its sessions. Phase 0 must test migrated `emailVerified=false` users, approve the behavior, and provide support copy before enabling magic links for that cohort.

### 6.4 Email and password

- registration validates password policy client- and server-side;
- verification status is visible in Account Security;
- reset/change flows use Firebase actions;
- recent reauthentication is required for sensitive changes;
- migrated bcrypt users must log in with their existing password in the Phase 0 proof;
- generic error copy is used for unknown email and wrong password.
- with email-enumeration protection enabled, adding an email/password credential to an authenticated user must use the supported Identity Toolkit `signUp` flow with the current ID token; do not assume `linkWithCredential(EmailAuthCredential)` works;
- email changes use `verifyBeforeUpdateEmail`, not an immediate unverified `updateEmail`;
- Phase 0 and E2E cover add-password, add-email, and change-email flows under enumeration protection.

### 6.5 Google

- use Firebase's Google provider;
- prefer redirect on mobile and embedded browsers;
- retain locale and validated `returnTo` in signed/state-bound storage;
- when Firebase reports an existing account with another credential, require login with the existing method and then call explicit credential linking;
- do not merge commerce data solely because Google returns the same email.

### 6.6 Kakao Login

Primary design:

- upgrade Firebase Authentication with Identity Platform;
- configure custom provider ID `oidc.kakao`;
- issuer: `https://kauth.kakao.com`;
- client ID: Kakao REST API key;
- client secret: Kakao Client secret;
- authorization code flow;
- register Firebase's hosted callback URL in the Kakao developer console;
- request only necessary Kakao consent items;
- use `OAuthProvider("oidc.kakao")`.
- use Kakao-approved login assets/copy, such as “Tiếp tục với Kakao”; “KakaoTalk” is the messaging-app/auto-login context, not a separate Firebase identity provider.

Phase 0 must prove:

- discovery/JWKS compatibility;
- authorization code callback;
- state/nonce validation handled by the provider flow;
- login for a Kakao account with no email;
- logout and unlink;
- provider identity import or first-login mapping;
- mobile KakaoTalk/in-app-browser return behavior.
- whether Identity Platform surfaces Kakao userinfo `email_verified`; until proven, Kakao email is not a verified nanoHome contact or account-linking key.

Fallback only if direct OIDC fails:

- a server-owned Kakao authorization-code flow;
- strict state, nonce, issuer, audience, expiry, and JWKS verification;
- mapping by `(issuer, sub)`;
- persistent Firebase custom claims including `role: "authenticated"` before custom-token minting;
- forced ID-token refresh and a Supabase RLS proof, because Identity Platform blocking functions do not run for custom authentication.

The fallback requires a separate threat model and extra unlink/revocation work. It is not the default implementation.

### 6.7 Phone-number only

Flow:

1. Normalize display input to E.164.
2. Render Firebase `RecaptchaVerifier`.
3. Request SMS challenge.
4. Show masked phone, resend timer, change-number action, and OTP input.
5. Confirm OTP.
6. Create server session and provision the account with no required email.

Controls:

- treat Firebase/Identity Platform region policy, native reCAPTCHA/Enterprise defenses, per-IP/per-number throttles, and project quotas as the authoritative SMS-send controls;
- allowlist real sales regions, initially Vietnam plus explicitly approved markets;
- UI cooldown and bounded attempts improve UX but are not claimed as a server-enforced SMS rate limit;
- nanoHome may rate-limit its own session/provisioning APIs by verified Firebase UID, IP, and App Check, but this does not replace Firebase's SMS controls;
- quota and spend alerts;
- prove delivery, sender behavior, quota, and cost with an authorized HTTPS staging domain; do not use localhost for real phone auth;
- use the Auth Emulator or Firebase test numbers in automated/staging tests;
- no real SMS in CI;
- privacy disclosure beside the phone field because phone numbers are processed for authentication/abuse prevention;
- phone-only is allowed but the UI may recommend linking a stronger recovery method.

Firebase Authentication App Check enforcement is currently a Preview capability and is not an unconditional launch dependency. Run metrics/audit first. App Check verification on nanoHome-owned APIs may be enforced independently; phone launch still depends on native reCAPTCHA/Identity Platform defenses, region policy, throttling, and quotas.

## 7. Target identity and data architecture

### 7.1 Domain account model

Add a forward-only migration. Do not rewrite existing migrations.

`customer_accounts`

- `id uuid primary key default gen_random_uuid()`;
- `legacy_supabase_user_id uuid unique null`;
- `status`;
- `created_at`, `updated_at`, `last_login_at`;
- no provider access/refresh tokens.

`customer_firebase_principals`

- `firebase_uid text primary key`;
- `account_id uuid references customer_accounts(id)`;
- `status`: `active | merged | disabled | deleted`;
- `merged_into_firebase_uid text null`;
- `created_at`, `updated_at`, `disabled_at`;
- one active Firebase principal per account through a partial unique constraint;
- tombstones retained through the support/rollback window so a losing UID cannot silently provision a duplicate account.

`customer_auth_identities`

- `id uuid primary key`;
- `account_id uuid references customer_accounts(id)`;
- `provider_id` such as `password`, `phone`, `google.com`, `oidc.kakao`;
- optional `sign_in_method`/capability such as `password` or `emailLink` when the UI must distinguish email flows;
- `issuer`;
- `provider_subject`;
- normalized masked/lookup-safe metadata only where required;
- verification timestamps;
- `linked_at`, `unlinked_at`;
- unique active `(issuer, provider_subject)`.

`profiles`

- retain a UUID domain key equal to `customer_accounts.id`;
- remove the long-term dependency on `auth.users`;
- add nullable `date_of_birth date`, normalized `nationality_code`, and approved gender/form-of-address value;
- keep `full_name`, verified-contact projections, preferred locale, and row version/timestamps;
- store profile data, not authentication secrets or provider tokens.

Profile migration is forward-only, regenerates `src/types/database.types.ts`, and allows customers to clear optional values. Do not derive/store age permanently; validate date ranges and country/value allowlists server-side. Define retention/deletion behavior for each new PII field before release.

For migrated users:

- create `customer_accounts.id = legacy Supabase user UUID`;
- import Firebase user with that UUID as Firebase UID when safe;
- insert the active Firebase principal mapping;
- store the old UUID in `legacy_supabase_user_id`;
- keep all business ownership IDs unchanged.

For new users:

- Firebase may assign an arbitrary string UID;
- create a new internal UUID account ID;
- insert one active principal mapping from the Firebase UID to that UUID.

### 7.2 Business-table migration

The baseline migration manifest is:

| Object | Legacy ownership surface |
| --- | --- |
| `profiles` | `id` primary key/FK and `handle_new_user` trigger |
| `carts` | `user_id`, owner check, unique index, RLS |
| `orders` | `user_id`, RLS, and currently required `email` |
| `order_status_history` | `changed_by` actor semantics |
| `customer_identity_ledger` | `user_id` |
| `customer_amis_links` | `user_id`, `actor_id` |
| `customer_memory_projections` | `user_id` and RLS |
| `conversations` | `owner_id`, `owner_scope` checks, dependent message/feedback RLS |
| `vision_analysis_requests` | required `owner_id`, unique/path checks, RLS |
| `room_scenes` | required `owner_id`, composite FK, RLS |
| `vision_object_crops` | required `owner_id`, composite FK/path check, RLS |
| `storage.objects` room-photo policies | first folder segment derived from `auth.uid()` |
| `capture_order_from_cart()` | local UUID from `auth.uid()` and authenticated grants |
| `bind_verified_customer_identity()` | direct `auth.users` existence check and `verified_supabase_auth` source |
| generated `src/types/database.types.ts` | legacy column/function shapes |

Also include new advisor handoffs and every ownership object added by Plans 01–03 before implementation begins. Regenerate the manifest with a static migration/schema search at A1 start; zero unclassified `auth.users`, `auth.uid()`, Supabase-session, or user-actor references may remain.

For each table:

1. Add nullable `account_id uuid`.
2. Backfill from the legacy user/owner UUID.
3. Add the `customer_accounts` foreign key and indexes.
4. Relax legacy ownership constraints where a new Firebase-only row cannot satisfy an `auth.users` foreign key.
5. Dual-write legacy and new ownership only for migrated legacy users.
6. New Firebase users write `account_id` only; legacy owner columns are nullable and never receive an invented UUID.
7. Add new account-based read/write policies.
8. Verify row counts and orphan report.
9. Make `account_id` required where authenticated ownership is required.
10. Switch code reads to `account_id`.
11. Stop legacy writes.
12. Remove the legacy foreign key/column only in a later cleanup migration after rollback expiry.

Guest-owned rows keep their guest owner token/cookie model until an idempotent claim after login.

`profiles` is a special cutover: create/backfill `customer_accounts`, repoint the profile key/foreign key, and replace the `auth.users` trigger before any public Firebase signup. The canary must not create a new Firebase account while profile provisioning still requires an `auth.users` row.

Per-surface canary prerequisites:

- `carts`: owner check becomes `account_id is not null OR guest_id is not null`; legacy `user_id` is nullable;
- `orders`: `account_id` is authoritative, legacy `user_id` is nullable, and transactional email follows the phone-only contract;
- AMIS links/memory: add required account ownership after backfill, then relax/remove required legacy user FKs before Firebase-only writes;
- conversations: use `owner_account_id` for `owner_scope='auth'` and rewrite every dependent RLS lookup;
- vision tables: add/backfill account ownership, rebuild composite keys/path checks, and rewrite Storage policies before allowing new uploads;
- actor fields such as `actor_id`/`changed_by`: migrate to domain account or a separately defined staff principal; do not overload a Firebase customer UID.

### 7.3 RLS compatibility

For residual Supabase browser access:

- configure Supabase Third-Party Auth for the exact Firebase project;
- every Firebase ID token contains the custom claim `role: "authenticated"`;
- use a Firebase blocking function for the claim when available;
- backfill claims for imported users;
- refresh the client ID token after claim changes.

Add a security-definer helper with a fixed `search_path`. The Firebase branch must require all of:

- `iss = https://securetoken.google.com/<environment-project-id>`;
- `aud = <environment-project-id>`;
- `role = authenticated`;
- mapped, active `sub`.

Only then resolve:

```sql
current_customer_account_id()
  = select id
    from customer_firebase_principals p
    join customer_accounts a on a.id = p.account_id
    where p.firebase_uid = auth.jwt()->>'sub'
      and p.status = 'active'
      and a.status = 'active'
```

During the short overlap, the helper also supports the exact trusted legacy Supabase issuer and UUID subject.
The legacy branch allowlists its exact issuer/role/audience combination; it does not accept any issuer merely because `sub` happens to match.

Rules:

- never cast every `sub` to UUID;
- never trust an `account_id` claim written by the browser;
- reject missing, wrong-project, wrong-role, disabled, or unmapped identities;
- replace direct `auth.uid()` ownership checks with the helper;
- storage paths use the internal account UUID returned by the helper, not raw Firebase UID;
- SQL tests include a random non-UUID Firebase UID and cross-account denial.

### 7.4 Server data-access lane

Account pages use a server-only DAL:

1. Verify Firebase session cookie with revocation checking.
2. Resolve the active `customer_firebase_principals.firebase_uid -> customer_accounts.id`.
3. Construct an immutable `AuthenticatedAccount` context.
4. Pass that context to narrow repository functions.
5. Every repository query filters by the context account ID.

Requirements:

- route/page code cannot construct `AuthenticatedAccount` directly;
- repositories do not accept account ID from search params, form data, or JSON;
- service-role access, where necessary, stays in server-only modules;
- the current `createAdminClient()` remains read-only through `supabaseReadOnlyFetch`; do not weaken that global safeguard;
- account writes use a separate `server-only` client that allowlists exact security-definer RPC names/paths and denies generic table, Auth, and Storage mutation;
- each write RPC rechecks the server-supplied authenticated account context, allowlisted fields, row version, and invariants;
- mutations use allowlisted fields and optimistic concurrency/version checks;
- critical operations have cross-account negative tests;
- browser responses receive safe DTOs, never raw Supabase/AMIS rows.

RLS remains defense in depth and protects any approved direct browser access through a Firebase ID token.

### 7.5 Durable cart and wishlist convergence

Add:

`wishlist_items`

- `account_id uuid references customer_accounts(id)`;
- canonical `variant_id`;
- `created_at`, `source`;
- unique `(account_id, variant_id)`;
- account-scoped RLS/indexes.

Migrate existing `carts`/`cart_items` to internal `account_id` ownership and define one active authenticated cart per account. Keep the current localStorage shape only as a versioned guest draft.

`guest_state_merge_receipts`

- `account_id`;
- opaque merge idempotency key;
- safe payload digest and schema version;
- resulting cart/wishlist version;
- `created_at`, `completed_at`;
- unique `(account_id, idempotency_key)`.

Canonical contracts:

- `GET /api/account/cart`;
- `PATCH /api/account/cart`;
- `GET /api/account/wishlist`;
- `POST /api/account/wishlist/items`;
- `DELETE /api/account/wishlist/items/[variantId]`;
- `POST /api/account/merge-guest-state`.

All mutations derive account identity from the verified session, validate current catalog variants, and return the complete canonical version. The header drawers and account pages consume this same contract. The retired `/api/commerce/cart` remains retired unless a separate migration explicitly replaces and tests it.

### 7.6 Existing authenticated-consumer migration

Assign every current Supabase-session consumer to A1/A2:

- `src/app/api/checkout/route.ts`;
- `src/app/api/customer/context/route.ts`;
- `src/app/api/customer/personalization/route.ts`;
- `src/app/api/customer/events/route.ts`;
- removal/replacement of `src/app/api/customer/consent/route.ts`;
- `src/lib/queries/cart.ts`;
- `src/lib/queries/orders.ts`;
- `src/lib/supabase/server.ts`;
- `src/lib/supabase/checkout.ts`;
- `src/lib/supabase/route-handler.ts`;
- AMIS customer-memory access-token forwarding.

Rules:

- replace `supabase.auth.getUser()`/`getSession()` ownership with `AuthenticatedAccount`;
- personalization must not forward a Firebase session cookie as a Supabase bearer;
- use the server DAL for account/CRM projections, or an actual Firebase ID token through the configured Supabase third-party-auth client;
- split anonymous catalog reads, Firebase-token RLS reads, and narrow privileged writes into explicit clients;
- remove all assumptions that Supabase auth cookies are refreshed by middleware;
- keep legacy adapters reachable only through the bounded overlap flag.

Exit check: outside the named legacy adapter/tests, no protected runtime route derives identity from Supabase Auth.

## 8. Firebase session architecture

### 8.1 Components

Create:

- `src/lib/firebase/client.ts`
- `src/lib/firebase/admin.ts`
- `src/lib/firebase/auth-errors.ts`
- `src/lib/auth/firebase-session.server.ts`
- `src/lib/auth/authenticated-account.server.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/auth/session/revoke-all/route.ts`
- `src/app/api/auth/kakao/unlink/route.ts` when required

Use singleton initialization safe for Next.js development reloads. Keep Firebase Admin credentials server-only and prefer workload identity/managed credentials in hosted environments where available.

### 8.2 Session creation

1. Client completes Firebase sign-in.
2. Client obtains a fresh Firebase ID token.
3. Client POSTs it to `/api/auth/session` with CSRF protection and App Check signal when enabled.
4. Server verifies ID token, expected Firebase project, disabled state, and recent `auth_time`.
5. Server idempotently provisions/resolves the domain account.
6. If current Terms/Privacy evidence is required and missing, server returns `needsPolicyAcceptance` and does not issue the full session cookie.
7. After the versioned acknowledgement, server creates a Firebase session cookie.
8. Server sets a cookie such as `__Host-nh_session`:
   - `HttpOnly`;
   - `Secure`;
   - `SameSite=Lax` unless a tested flow requires stricter behavior;
   - `Path=/`;
   - no `Domain`;
   - proposed five-day TTL, within Firebase's supported bounds.
9. Client refreshes account state and performs the idempotent guest cart/wishlist merge.

### 8.3 Request authorization

- every account page, route handler, and mutation calls `verifySessionCookie(cookie, true)` server-side;
- revocation checking is required for all protected Account Center requests so “logout all devices” blocks ordinary pages as well as sensitive mutations;
- a Next.js route guard/proxy may perform a fast UX redirect, but it is never the authorization boundary;
- implement against the installed Next.js `16.2.7` documentation in `node_modules/next/dist/docs/`;
- use `no-store`/private cache semantics for account data;
- invalidate account-specific cache tags after every mutation;
- logout clears the cookie and signs out the Firebase client;
- logout-all revokes Firebase refresh tokens and then clears the cookie.

### 8.4 Firebase token versus session cookie

These credentials have different jobs:

| Credential | Job | Accepted by |
| --- | --- | --- |
| Firebase ID token | Firebase/Supabase third-party bearer and client identity | Supabase Data API after configured Firebase trust |
| Firebase session cookie | Server-rendered Next.js session | Firebase Admin `verifySessionCookie` |

Do not send a Firebase session cookie as a Supabase access token.

If a browser component must access Supabase directly:

- keep the Firebase client session;
- supply `getIdToken()` through the Supabase client's `accessToken` callback;
- rely on updated RLS;
- never fall back to the service-role key.

Prefer the server DAL for Account Center data.

### 8.5 Legacy auth surface replacement

Every Supabase-auth entry point gets an explicit disposition:

| Current surface | Firebase replacement |
| --- | --- |
| `/auth/sign-in` | Firebase client method, then `POST /api/auth/session` |
| `/auth/sign-up` | Firebase email/password or selected provider, then session/provisioning |
| `/auth/forgot-password` | Firebase password-reset email |
| `/auth/reset-password` | localized Firebase action-code handler |
| `/auth/callback` | email-link/action-code completion or provider redirect-result handler |
| `/auth/sign-out` | Firebase client `signOut` plus `DELETE /api/auth/session` |
| localized `check-email`/`reset-password` pages | Firebase-aware sent/action/result pages |
| Supabase boolean-only `AuthProvider` | Firebase auth state plus verified server-session bootstrap |

Create explicit landing surfaces:

- `src/app/[locale]/auth/email-link/page.tsx` for `isSignInWithEmailLink`/`signInWithEmailLink`;
- `src/app/[locale]/auth/action/page.tsx` for verify-email, reset-password, and recover-email action codes;
- a client redirect-result bridge that calls `getRedirectResult` for Google/Kakao and completes server session creation;
- neutral expired/invalid/success states in all locales.

Cutover also updates:

- `src/components/header.tsx`;
- the existing auth drawer/provider/forms/tests;
- `src/middleware.ts` or the installed Next.js 16 route-guard equivalent;
- locale layout session bootstrap;
- all current auth route and cookie-contract tests.

Old Supabase auth routes remain only behind the bounded migration flag and are deleted after rollback acceptance.

## 9. Provisioning, linking, and collision rules

### 9.1 Idempotent provisioning

Session creation provisions the account in a transaction or narrow RPC:

- look up exact Firebase UID;
- if an active principal is mapped, update safe login metadata;
- if the UID is tombstoned/merged/disabled, deny automatic provisioning and enter recovery;
- if a verified migration mapping exists, attach to that internal account;
- otherwise create one account, one active Firebase principal, and one profile;
- insert/update provider identity from verified Firebase provider data;
- never promote Kakao email to verified contact unless the approved verification proof passes;
- return the internal account ID;
- make retries safe through unique constraints.

Do not depend on the old `auth.users` trigger.

### 9.2 Account linking

- one Firebase user may link several login providers;
- linking starts only from an authenticated account or from a collision recovery flow;
- require recent reauthentication;
- preserve pending credential only for the minimum in-memory/session-bound time;
- explicit user confirmation precedes data merge;
- provider credential already owned by another Firebase user enters a controlled merge/review path;
- commerce records merge by internal account IDs in a transaction, never by email string;
- email/password additions under enumeration protection use the supported Identity Toolkit flow, not a generic `linkWithCredential(EmailAuthCredential)` assumption;
- record an audit event without provider tokens.

### 9.3 Collisions

When Firebase returns `account-exists-with-different-credential`:

1. Explain that the identifier is already attached to another method without revealing unnecessary account data.
2. Ask the customer to authenticate with the existing method.
3. Reconfirm the pending provider.
4. Link the credential.
5. Reconcile identities and guest state once.

If the credential already belongs to a different Firebase UID, the merge workflow must:

1. reauthenticate both sides as required;
2. select one canonical Firebase UID/account;
3. merge domain-owned rows transactionally;
4. relink the provider only through a supported Firebase provider flow;
5. revoke and disable/delete the losing Firebase user according to policy;
6. mark its principal mapping `merged` with the canonical UID;
7. deny all future sessions from the losing UID.

Kakao-specific:

- `sub` is authoritative;
- email may be missing, unverified, or changed;
- no automatic Kakao-to-existing-account merge by email.

### 9.4 Removing methods

- never unlink the last usable login method;
- phone-only users can remain phone-only;
- do not offer per-user password removal until a proof shows it will not unlink Firebase's shared email provider and break magic-link access;
- changing primary email/phone requires verification and recent auth;
- unlinking Kakao also triggers/records Kakao-side unlink where required;
- account deletion has a separate retention/deletion workflow.

### 9.5 First-account policy acknowledgement

Terms/Privacy acknowledgement is versioned evidence, not the removed personalization consent.

Add `account_policy_acceptances`:

- `account_id`;
- `document_type`;
- approved document `version`;
- locale;
- `accepted_at`;
- verified Firebase principal and safe request-evidence digest;
- unique `(account_id, document_type, version)`.

Flow:

1. Firebase authentication completes.
2. Session endpoint resolves an existing account or creates a bounded `pending_policy` account/principal.
3. Existing accepted versions proceed normally.
4. A first-time account receives `needsPolicyAcceptance` without full Account Center access.
5. UI presents the exact linked Terms/Privacy versions.
6. A fresh ID token plus CSRF-protected acknowledgement activates the account and creates the session cookie.
7. Declined/abandoned pending accounts are signed out and cleaned up by an idempotent expiry job according to policy.

Phase 0 decides how to treat migrated customers when historical acceptance evidence is missing. Do not silently manufacture an acceptance row.

### 9.6 Account deletion

The existing visitor deletion queue is not an account deletion workflow. Add `customer_account_deletion_requests` plus an idempotent worker/outbox:

- request ID, account ID, verified principal;
- policy/version and requested/execution timestamps;
- state: `requested | identity_unlinking | data_cleanup | retained_records_detached | completed | failed`;
- provider-unlink attempts and safe event IDs;
- retry/dead-letter metadata;
- no raw provider token.

Flow:

1. Require recent reauthentication and explicit confirmation.
2. Create one idempotent request and mark the account `deletion_pending`.
3. Revoke Firebase sessions and block new Account Center access.
4. Kakao-unlink and other provider cleanup run before deleting the Firebase principal.
5. Delete/anonymize profile optional PII, wishlist, cart, personalization/memory, AMIS link, chat content, and vision/storage objects according to their policies.
6. Retain orders, payments, refunds, invoices, fraud/security evidence, and accounting records only for the approved legal/business period; detach or pseudonymize the customer relationship where allowed.
7. Delete/disable the Firebase user, tombstone principal mappings, and complete reconciliation.
8. Notify through a still-valid approved channel only when policy allows.

Expose:

- `POST /api/account/deletion`;
- `GET /api/account/deletion/status` for an authorized pending flow;
- an internal retry/reconciliation operation.

Account deletion, provider unlink failure, worker retry, retained-order behavior, Storage cleanup, and idempotent replay are mandatory tests and runbook cases.

## 10. Existing-user migration

### 10.1 Phase 0 proof cohort

Before building the full importer, create a staging-only cohort of at least:

- password user with verified email;
- password user with unverified email;
- email-link-only user;
- Google user;
- phone user;
- user with both password and Google;
- disabled/banned user;
- user with cart and orders;
- user with AMIS link and personalization;
- Kakao identity if one exists.

Required proofs:

- import ten real-format bcrypt hashes and successfully log in with known passwords;
- import Google provider identity and sign in without creating a duplicate account;
- test `oidc.kakao` provider-data import or document first-login mapping;
- use a non-UUID Firebase UID through Supabase third-party Auth and the new RLS helper;
- preserve cart/order ownership;
- produce exact before/after counts and zero unexplained orphans.

Failure of any proof blocks cutover and selects a documented fallback.

### 10.2 Export and transform

Build a restricted migration CLI:

- export required `auth.users` and `auth.identities` fields through an approved privileged environment;
- never print password hashes, tokens, phone, or full email to console;
- encrypt temporary exports;
- write a manifest with row counts and non-sensitive checksums;
- validate unique UID, email, phone, and provider subject before import;
- map `email_confirmed_at` and phone confirmation correctly;
- map disabled/banned/deleted users to a safe disabled state;
- keep profile/commerce data in Postgres;
- keep custom claims small and authorization-only.

Firebase Admin import:

- import at most `1,000` users per batch;
- use BCRYPT for Supabase password hashes after the proof succeeds;
- preserve the legacy UUID as Firebase UID where safe;
- import Google `providerData`;
- test custom OIDC provider data before relying on it;
- reconcile per-batch success/failure;
- never retry a batch blindly because duplicate UID behavior can overwrite.

### 10.3 Fallbacks

Password hash proof fails:

- import the account without password;
- send a neutral password-setup/reset flow on next login;
- do not downgrade hashing or expose the old hash.

Kakao provider import fails:

- retain a verified legacy `(issuer, sub) -> internal account` map;
- attach on first successful Kakao OIDC login after explicit proof;
- do not fall back to email matching.

Seamless session migration is not available:

- require one re-login at cutover;
- preserve a validated `returnTo`;
- keep guest cart/wishlist merge idempotent;
- communicate the re-login window in advance.

### 10.4 Cutover sequence

1. Pre-copy users and identity mappings.
2. Run full domain-account backfill and ownership reconciliation.
3. Enable dual-issuer RLS for a bounded overlap.
4. Deploy Firebase auth behind `ACCOUNT_CENTER_ENABLED` plus sticky account/cohort provider routing; do not rely on one reversible global boolean.
5. Canary migrated staff/test accounts only; public new signup remains closed during the reversible canary.
6. Freeze legacy sign-up and identity changes for a short announced window.
7. Export/import delta users.
8. Reconcile users, principals, identities, profiles, carts, wishlist, orders, customer ledger, AMIS/memory, conversations, vision rows, and Storage objects.
9. Switch login entry points to Firebase.
10. Require re-login once.
11. Roll out migrated eligible accounts at `5%`, `25%`, then `100%` with sticky routing.
12. Enable public Firebase-only signup only after the forward-recovery lane is tested; mark those accounts permanently Firebase-routed.
13. Monitor auth success, duplicates, RLS denials, SMS spend, and account support cases.
14. Close the legacy overlap after the rollback window.
15. Remove old Supabase-auth UI/routes and narrow policies to Firebase.
16. Remove only obsolete Supabase Auth provider/SMTP/session integration secrets. Keep Supabase project keys/JWT/service-role material still required by Postgres, Storage, Realtime, and the server DAL, and rotate them only through their own runbook.

Supabase Auth may remain technically present in the Supabase project; the application stops creating or accepting its sessions after the bounded migration window.

### 10.5 Rollback

Rollback triggers:

- migrated password success falls below the approved threshold;
- duplicate-account rate exceeds the threshold;
- cross-account/RLS failure;
- unexplained ownership mismatch;
- Kakao or phone provider outage without safe fallback;
- material login-success regression.

Rollback actions:

- route only eligible migrated accounts back to Supabase while the legacy issuer remains valid;
- keep new domain account mappings and audit rows;
- stop new Firebase provisioning;
- reopen legacy login only while legacy issuer policies remain valid;
- never route a Firebase-only user to Supabase Auth, because that user has no Supabase credential;
- keep Firebase-only users on a sticky Firebase recovery/maintenance lane and fix forward;
- do not delete Firebase users or mapping data during incident response;
- reconcile users created during the canary before another attempt.

## 11. Implementation work packages

### A0 — Contract and integration spikes

Estimated effort: 2–4 engineering days.

- three separate Firebase/Identity Platform projects for development, staging, and production;
- Identity Platform upgrade and budget alerts;
- Kakao OIDC proof;
- bcrypt import proof;
- Google/Kakao identity import proof;
- Supabase Firebase third-party JWT/RLS proof;
- unverified-password email-link behavior and enumeration-protected add/change-email proof;
- authorized HTTPS phone delivery/quota/cost proof;
- offer source/rule and Terms/Privacy version contract;
- live account desktop/mobile reference captures;
- final route and copy contract.

Exit: every blocking proof has evidence and an owner-approved decision.

### A1 — Identity schema and RLS

Estimated effort: 7–12 engineering days.

- domain account and identity tables;
- legacy backfill;
- per-table ownership constraint migration and legacy-only dual write;
- profile PII fields and phone-only order contact;
- durable cart/wishlist and merge receipts;
- offer eligibility/reservation/adjustment foundation;
- policy-acceptance and deletion workflow foundation;
- `current_customer_account_id()` helper;
- policies and storage ownership;
- idempotent provisioning RPC/repository;
- SQL security and reconciliation tests.

Exit: legacy and random non-UUID Firebase users access only their own rows.

### A2 — Firebase foundation and sessions

Estimated effort: 4–6 engineering days.

- client/admin adapters;
- environment validation;
- provider configuration;
- authenticated role claim;
- session create/delete/revoke;
- versioned policy-acceptance gate;
- server account context;
- App Check audit without making Preview Auth enforcement a launch dependency;
- auth observability.

Exit: server pages authorize from Firebase cookie and revocation works.

### A3 — Login drawer and all five methods

Estimated effort: 6–10 engineering days.

- drawer state machine;
- passwordless email;
- email/password/register/reset/verify;
- one Firebase/Identity Platform password policy shared by UI/server tests; retire the current reset `min(1)` mismatch;
- Google;
- Kakao;
- phone OTP plus native reCAPTCHA/region/quota controls and authorized-domain proof;
- collision/linking flow;
- locale and return-path handling;
- cart/wishlist merge.

Exit: full auth matrix passes desktop/mobile E2E.

### A4 — Account Center parity

Estimated effort: 8–14 engineering days.

- shared account shell;
- profile;
- orders/detail;
- wishlist;
- cart;
- offers;
- preferences;
- responsive and visual regression coverage.

Exit: every account page has data, empty, loading, error, and mobile states.

### A5 — Security and migration tooling

Estimated effort: 6–10 engineering days.

- login method management;
- recent reauthentication;
- logout all and idempotent account-deletion worker/outbox;
- Kakao unlink/callback;
- restricted export/import CLI;
- dry-run, manifest, reconciliation, fallback;
- support runbook.

Exit: migration rehearsal passes with no unexplained ownership mismatch.

### A6 — Canary, cutover, and cleanup

Estimated effort: 3–5 engineering days plus observation window.

- overlap issuer policies;
- sticky provider/cohort routing including a Firebase-only recovery lane;
- delta import/freeze;
- forced re-login communication;
- dashboards/alerts;
- rollback drill;
- remove old auth routes after acceptance.

With two full-stack/backend engineers, one frontend engineer, and QA support, the likely calendar range is approximately seven to ten weeks after Phase 0. This is a planning range, not a delivery commitment.

## 12. Suggested file map

```text
src/
  app/
    [locale]/
      account/
        layout.tsx
        loading.tsx
        error.tsx
        not-found.tsx
        page.tsx
        orders/page.tsx
        orders/[orderId]/page.tsx
        wishlist/page.tsx
        cart/page.tsx
        offers/page.tsx
        preferences/page.tsx
        security/page.tsx
      auth/
        email-link/page.tsx
        action/page.tsx
    api/
      auth/
        session/route.ts
        session/revoke-all/route.ts
        policy-acceptance/route.ts
        kakao/unlink/route.ts
        kakao/unlink-callback/route.ts
      account/
        profile/route.ts
        cart/route.ts
        wishlist/route.ts
        merge-guest-state/route.ts
        preferences/route.ts
        deletion/route.ts
  components/
    account/
    auth/
  lib/
    account/
      profile-actions.server.ts
      orders.server.ts
      cart-repository.server.ts
      wishlist-repository.server.ts
      offers.server.ts
      preferences.server.ts
      deletion.server.ts
    auth/
    firebase/
    supabase/
      account-mutations.server.ts
supabase/
  migrations/
    <new>_customer_account_identity_foundation.sql
    <new>_customer_account_ownership_backfill.sql
    <new>_profile_account_fields.sql
    <new>_durable_cart_wishlist.sql
    <new>_customer_offers_and_adjustments.sql
    <new>_account_policy_acceptance_and_deletion.sql
    <new>_phone_only_order_contact.sql
    <new>_firebase_account_rls.sql
scripts/
  auth-migration/
    export-supabase-users.ts
    transform-firebase-import.ts
    import-firebase-users.ts
    reconcile-auth-migration.ts
```

Explicitly modify or retire:

- `src/components/header.tsx`;
- `src/components/auth/*`;
- `src/app/[locale]/layout.tsx`;
- localized `check-email` and `reset-password` pages;
- all six current `src/app/auth/*/route.ts` handlers;
- `src/middleware.ts` or its Next.js 16 replacement;
- `src/app/api/checkout/route.ts`;
- customer context/events/personalization/consent routes;
- `src/lib/queries/cart.ts` and `src/lib/queries/orders.ts`;
- Supabase server/checkout/route-handler adapters;
- `src/lib/remote-read-only.ts` tests without weakening its generic deny policy;
- `src/types/database.types.ts`;
- `e2e/fixtures.ts` with a real Firebase emulator/staging authenticated fixture;
- existing auth route/cookie/form/panel tests.

File rules:

- use new forward migrations only;
- keep migration tooling out of public runtime bundles;
- mark Admin/service-role modules `server-only`;
- every mutation handler verifies allowed Origin/CSRF token, content type, `verifySessionCookie(cookie, true)`, account context, payload schema, and idempotency/version where applicable;
- validate all environment variables at startup;
- do not place Firebase Admin private keys or Kakao client secret in `NEXT_PUBLIC_*`;
- follow the installed Next.js documentation before implementing route guards, cookies, caching, and request APIs.

## 13. Configuration checklist

Per environment:

- separate Firebase/Identity Platform project for development, staging, and production;
- `NEXT_PUBLIC_FIREBASE_API_KEY`;
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`;
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`;
- `NEXT_PUBLIC_FIREBASE_APP_ID`;
- server Firebase project/credential configuration;
- allowed production/staging domains;
- email verification, magic-link, and password-reset templates;
- current Firebase Hosting/custom `linkDomain`; no deprecated `dynamicLinkDomain`;
- Google OAuth settings;
- Identity Platform `oidc.kakao` settings;
- Kakao app redirect URI and consent items;
- server-only Kakao Service App Admin Key and verified unlink-callback URL;
- phone SMS region allowlist;
- billing/quota/budget alerts;
- reCAPTCHA/App Check keys and rollout mode, with Firebase Auth enforcement treated as Preview/audit-first;
- Supabase third-party Firebase Auth project trust;
- Firebase custom claim `role=authenticated`;
- cookie name, TTL, secure flags;
- current Terms/Privacy document versions and pending-account expiry;
- feature flags and legacy-overlap deadline.

Secret handling:

- credentials live in the deployment secret manager;
- `.env.example` contains names and safe descriptions only;
- no private key in Git;
- no Kakao client secret or Service App Admin Key in browser code;
- migration export storage is encrypted and deleted after reconciliation/rollback expiry;
- logs redact email, phone, tokens, credential errors, and provider payloads.

## 14. Test plan

### 14.1 Unit and contract tests

- profile schemas and patch allowlist;
- phone E.164 normalization;
- validated same-origin `returnTo`;
- auth error normalization and enumeration-safe messages;
- provider-to-identity mapping;
- shared email-provider versus password/email-link capability modeling;
- account completeness for email-only and phone-only users;
- optional-email/required-phone checkout schema;
- versioned Terms/Privacy acknowledgement;
- profile DOB/nationality/gender validation and clearing;
- order/quote classification;
- offer eligibility/reservation/adjustment;
- cart/wishlist idempotent merge;
- account-deletion state transitions;
- session cookie options;
- locale message parity across `vi`, `en`, and `ko`.

### 14.2 SQL/RLS tests

- legacy Supabase UUID owner can read during overlap;
- non-UUID Firebase UID maps to internal account UUID;
- exact Firebase issuer, audience, and role are required;
- account A cannot read/write account B profile, cart, wishlist, order, customer ledger, chat, image, AMIS link/memory, offer, or preferences;
- new Firebase-only accounts can write every migrated surface without an `auth.users` row;
- merged/tombstoned/disabled Firebase principals cannot resolve an account;
- unmapped Firebase user gets no private rows;
- wrong/missing role is denied;
- guest policies remain scoped;
- storage object paths cannot cross accounts;
- service/helper functions have fixed `search_path` and minimum grants;
- narrow account mutation RPC client cannot call arbitrary table/Auth/Storage writes;
- old `auth.uid()` policies are fully inventoried before legacy shutdown.

### 14.3 Auth integration tests

- passwordless same-device and cross-device completion;
- expired/used/invalid email link;
- migrated unverified-password user completes email link with the documented password/session effect;
- existing migrated password works without reset;
- email verification, password reset, enumeration-protected add-password/add-email, and `verifyBeforeUpdateEmail`;
- Google redirect success/cancel/error;
- Kakao login with no email;
- Kakao email is not promoted without verified proof;
- Kakao admin-key unlink, callback authorization, idempotent acknowledgement, and retry;
- custom-token Kakao fallback includes `role=authenticated` and passes Supabase RLS when that fallback is enabled;
- phone-only registration/login with test number;
- native SMS region/reCAPTCHA/throttle/quota behavior and UI resend cooldown;
- collision requires existing-method reauthentication;
- linking/unlinking never leaves zero methods;
- revoked session is rejected by every protected Account Center route/API;
- first-time policy acknowledgement gates full session creation;
- disabled account is rejected;
- open redirect is rejected;
- CSRF/App Check failures are safe.

### 14.4 Account E2E

Replace the stub authenticated Playwright fixture with Firebase Auth Emulator or an approved staging-auth fixture first. Then, for desktop and mobile:

- unauthenticated direct account route;
- post-registration `/vi/account` resolves and authenticated header links to Account Center;
- first-time Terms/Privacy acknowledgement;
- profile read/save/validation;
- phone-only profile with no email;
- phone-only checkout succeeds without transactional email when the tenant/provider proof allows it;
- order list/filter/pagination;
- owned order detail and cross-account `404`;
- wishlist add/remove/add-to-cart, reload, cross-device persistence, and one-time guest merge;
- cart quantity/remove/checkout, reload, concurrent-tab versioning, and one-time guest merge;
- offer eligibility, reservation, checkout total, redeem/release, and forged-code denial;
- personalization disable/reset/disconnect;
- current logout and logout-all;
- account deletion, Kakao unlink failure/retry, retained-order behavior, and Storage cleanup;
- navigation and counts update without stale private cache.

### 14.5 Visual and accessibility

- Percy snapshots at representative mobile, tablet, desktop, and wide desktop widths;
- compare shell, spacing, typography, fields, notices, active nav, drawer, and buttons to the reviewed reference;
- keyboard-only drawer and account navigation;
- focus trap and focus return;
- Escape/backdrop close;
- headings and landmarks;
- field labels/errors/descriptions;
- screen-reader live status for email/SMS flows;
- `prefers-reduced-motion`;
- 200% zoom and long Vietnamese/English/Korean copy;
- contrast and non-color active/error indicators.

### 14.6 Migration rehearsal

- pre/post counts by provider and status;
- password login sample;
- principal/identity uniqueness and tombstones;
- zero unexplained profiles, carts, wishlists, orders, customer ledger, AMIS/memory, conversations, vision rows, or Storage objects without account mapping;
- no duplicate customer accounts;
- exact AMIS links retained;
- generated database types match the migrated schema;
- dual-issuer rollback for migrated accounts;
- Firebase-only sticky recovery lane;
- forced re-login support script;
- rollback drill before production.

## 15. Observability and operations

Dashboards:

- login attempt/success/error by method and environment;
- magic-link send/complete ratio;
- password migration success;
- Google/Kakao callback errors;
- phone challenge/complete, throttles, and SMS spend;
- session creation/revocation failures;
- provisioning conflicts;
- duplicate-account and collision flow;
- account-page latency/error rate;
- RLS denials and cross-account test sentinel;
- cart/wishlist merge retries;
- migration reconciliation deltas.

Alerts:

- authentication success regression;
- spike in `account-exists-with-different-credential`;
- Firebase/Kakao callback failure;
- SMS quota/spend threshold;
- session verification failure;
- unmapped authenticated UID;
- nonzero ownership orphan count;
- any cross-account security-test failure.

Runbooks:

- provider outage;
- Kakao callback/config rotation;
- SMS abuse/quota incident;
- session revocation;
- duplicate account remediation;
- password migration fallback;
- auth cutover rollback;
- customer account deletion/unlink request.

## 16. Definition of done

- the Account Center matches the reviewed desktop/mobile visual language;
- every specified account route has functional loading, empty, error, and success states;
- direct unauthenticated access has a deterministic login/return flow;
- passwordless email, email/password, Google, Kakao, and phone-only login pass E2E;
- a phone-only customer can use Account Center without adding email;
- an approved phone-only checkout can create an order without transactional email;
- Kakao works for a user with no Kakao email;
- unverified Kakao email never becomes verified contact/link evidence;
- versioned Terms/Privacy acknowledgement is recorded for first account creation;
- existing bcrypt password users pass the approved no-reset migration proof or use the documented fallback;
- existing profile, cart, order, customer ledger, chat, image/Storage, AMIS/memory, and personalization ownership is preserved;
- durable wishlist and canonical cart survive reload, account switch, and one-time guest merge;
- offers are eligible, reserved, adjusted, redeemed/released, and reconciled server-side;
- a new non-UUID Firebase UID works through the internal UUID account map;
- a merged/tombstoned losing Firebase UID is revoked and cannot provision a duplicate account;
- RLS and server DAL cross-account tests pass;
- profile incompleteness never hides order/security/privacy access;
- Firebase session revocation blocks protected server routes;
- no browser receives a service credential, migration hash, raw AMIS row, or provider secret;
- account collision/linking never auto-merges by email;
- account deletion unlinks providers, cleans eligible data/Storage, and retains only approved order/payment records;
- Firebase-only canary users remain on a tested forward-recovery lane during rollback;
- global personalization consent is absent while settings and privacy disclosures remain;
- old Supabase-auth entry points are removed only after canary, reconciliation, and rollback acceptance;
- build, lint, typecheck, unit, SQL/RLS, integration, Playwright, Percy, locale, and accessibility checks pass.

## 17. Official references

Firebase and Google Cloud:

- [Firebase email-link authentication](https://firebase.google.com/docs/auth/web/email-link-auth)
- [Firebase email/password authentication](https://firebase.google.com/docs/auth/web/start)
- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase phone authentication](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Authentication limits](https://firebase.google.com/docs/auth/limits)
- [Firebase OpenID Connect](https://firebase.google.com/docs/auth/web/openid-connect)
- [Identity Platform OIDC setup](https://cloud.google.com/identity-platform/docs/web/oidc)
- [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase user import](https://firebase.google.com/docs/auth/admin/import-users)
- [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking)
- [Identity Platform account linking](https://cloud.google.com/identity-platform/docs/link-accounts)
- [Email enumeration protection](https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection)
- [Firebase App Check](https://firebase.google.com/docs/app-check)

Kakao:

- [Kakao Login REST API and OIDC](https://developers.kakao.com/docs/en/kakaologin/rest-api)
- [Kakao Login concepts and identity cautions](https://developers.kakao.com/docs/en/kakaologin/common)
- [Kakao Login prerequisites](https://developers.kakao.com/docs/en/kakaologin/prerequisite)
- [Kakao unlink callback](https://developers.kakao.com/docs/en/kakaologin/callback)

Supabase:

- [Supabase Firebase third-party authentication](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
- [Supabase third-party authentication overview](https://supabase.com/docs/guides/auth/third-party/overview)
- [Supabase password security and bcrypt](https://supabase.com/docs/guides/auth/password-security)
