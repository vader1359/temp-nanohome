# Checkout identity release and Firebase email-link follow-up

Date: 2026-07-30  
Target: `staging.nanohome.vn` only  
Branch: `codex/ai-commerce-five-worktree-integration`

## Authoritative product contract

- Checkout is authenticated; guest checkout is not supported.
- The order form must collect both:
  - a normalized email address; and
  - a structured, normalized E.164 phone number (`+84` is the default country).
- One verified factor is sufficient for checkout and payment readiness:
  - verified email **or**
  - verified E.164 phone.
- The unverified contact is still mandatory order-contact data. It must not be
  promoted to a verified identity.
- If a submitted value contradicts the corresponding verified server identity,
  checkout must reject it rather than silently replacing the verified value.
- CRM precreation may be claimed with one verified factor. AMIS Customers is the
  only CRM source; AMIS Contacts semantics must not be reintroduced.

## Work included in this release

### Identity and session readiness

- `src/lib/auth/checkout-identity.ts`
  - `CheckoutIdentity` permits either verified factor to be absent.
  - `authCompletionState` is complete when verified email or verified phone is
    present.
- `src/lib/auth/firebase-session-exchange.server.ts`
  - Checkout session exchange uses the same one-factor completion rule.
- `src/lib/account/account-identity-resolver.server.ts`
  - A resolved account is incomplete only when both verified factors are absent.
- `src/lib/account/require-account.server.ts`
  - Server-side checkout authorization delegates to the canonical checkout
    identity resolver instead of duplicating an old two-factor rule.
- `src/lib/amis/customer-precreation.server.ts`
  - CRM assurance parsing requires `checkoutReady` to equal
    `phoneVerified || emailVerified`.

### Required order contacts

- `src/lib/checkout/checkout-identity.ts`
  - `resolveCheckoutOrderContact` normalizes the submitted email and structured
    phone, requires both values, and detects contradictions with verified
    server-side identity factors.
- `src/app/api/checkout/route.ts`
  - Returns `400` for missing or invalid order-contact data.
  - Returns `409` with `verified_contact_mismatch` when submitted data conflicts
    with a verified identity.
  - Persists only normalized order-contact values.
- `src/components/checkout/checkout-page.tsx`
  - Prefills and locks a verified factor.
  - Requires the other contact as editable order data.
  - Uses `InternationalPhoneField` with Vietnam as the default.
  - Posts both values under `delivery`.
- English, Vietnamese, and Korean messages describe this exact contract.

### Database compatibility migration

`supabase/migrations/20260730040000_checkout_one_verified_contact.sql`:

- preserves the historical claim implementation as an internal function;
- revokes direct browser/public access to that internal function;
- exposes the existing service-role claim RPC signature with
  `checkout_ready = phone_verified OR email_verified`;
- updates the read-only assurance RPC to the same rule;
- preserves audit history and stores only factors that were actually verified;
- does not weaken grants beyond the existing service-role boundary.

Migration order must remain:

1. `20260730000000_ai_commerce_sepay_test.sql`
2. `20260730010000_co_crm_account_precreation.sql`
3. `20260730020000_co_auth_identity_accounts.sql`
4. `20260730030000_staging_firebase_phone_test_mode.sql`
5. `20260730040000_checkout_one_verified_contact.sql`

## Deferred defect: email verification link opens another tab

This release intentionally does **not** fix the Firebase email-link/session
handoff. The user requested that this bounded follow-up be documented for Claude.

### Reproduction

1. Start an identity flow that calls `verifyEmailBeforeUpdate`.
2. Open the Firebase verification email; the hosted action opens the configured
   callback in another tab.
3. The action lands on `/{locale}/auth/email-link?returnTo=...`.
4. Press Continue to the checkout destination.
5. Checkout has no valid HttpOnly Firebase session and sends the shopper back to
   sign-in. In affected flows, retrying from the new tab can surface the generic
   `unknown` error or prompt an unnecessary phone OTP.

### Confirmed root cause

- `src/lib/auth/firebase-browser-auth.ts`
  - Calls `verifyBeforeUpdateEmail` with `handleCodeInApp: false`.
  - The action URL carries only `returnTo`; it does not carry a durable,
    server-bound checkout intent or recovery transaction.
- `src/app/[locale]/auth/email-link/page.tsx`
  - Is a server-only informational page.
  - It sanitizes the destination and renders a plain link.
  - It does not consume an action code, reload a Firebase user, fetch an ID
    token, or call `/api/auth/session`.
- `src/components/account/account-auth-flow.tsx`
  - Stores the linking Firebase `User` in component state (`identityUser`).
  - `checkEmailVerification` can complete only while that in-memory user remains
    available in the original tab.
- `src/lib/auth/firebase-browser-auth.ts#createServerSession`
  - The correct session path already exists: obtain the CSRF token, obtain a
    Firebase ID token, POST intent/locale/safe return path to
    `/api/auth/session`, receive the HttpOnly session cookie, then sign out the
    browser-side Firebase session.
  - The current email callback never invokes it.

### Required outcome for the follow-up

After successful email verification, a shopper with checkout-ready identity must
obtain a valid server session and return to the sanitized checkout intent without
repeating phone OTP solely because the email link opened in a second tab.

### Recommended bounded implementation

Use the existing session exchange as the only authority for creating the
HttpOnly application session.

1. Before sending the verification email, create a short-lived recovery
   transaction on a same-origin server endpoint.
   - Store only an opaque nonce and server-side/signed metadata.
   - Bind it to the expected Firebase UID, locale, `checkout` intent, and the
     result of `safeAccountReturnTo`.
   - Use a short TTL, one-time consumption, `HttpOnly`, `Secure`, and an
     appropriate `SameSite` policy.
   - Do not put raw email, phone, ID tokens, refresh tokens, or credentials in a
     URL, local storage, logs, or analytics.
2. Make the callback a small client-capable handler.
   - Validate the recovery transaction before trusting intent or destination.
   - If using a custom Firebase action handler, validate the Firebase mode and
     action code, apply the action, reload the authenticated user, and require
     the UID to match the recovery transaction.
   - When an authenticated matching Firebase user is available, call the
     existing `createServerSession(user, locale, returnTo, "checkout")`, consume
     the transaction, and use replace-navigation to the safe destination.
3. Handle a missing Firebase user in the new tab explicitly.
   - Do not mint an application session from an action code alone.
   - Notify the original tab with a non-authoritative `BroadcastChannel` event
     and let that tab reload its existing Firebase user and perform the normal
     CSRF + ID-token session exchange.
   - If the original tab is unavailable, render a useful recovery state such as
     “Email verified; return to the original checkout tab” or a safe
     re-authentication path. Do not fall through to `unknown`.
4. Keep redirect safety centralized.
   - Continue using `safeAccountReturnTo`.
   - Accept only known values from `AUTH_SESSION_INTENTS`.
   - Never trust raw query parameters as session authority.
5. Preserve configuration boundaries.
   - Do not change Firebase providers, rules, authorized domains, service
     accounts, or staging test-mode configuration for this fix.
   - Do not add a production alias or use production Firebase/SePay resources.

The exact Firebase action-handler API must be confirmed against the installed
Firebase SDK before implementation. In particular, verify the supported mode
and application method for `verifyBeforeUpdateEmail`; do not assume that an
email action code by itself represents an authenticated Firebase session.

### Required regression and integration coverage

- Email verification callback with a matching authenticated Firebase user:
  action completion -> CSRF GET -> session POST with `intent=checkout` -> safe
  checkout navigation.
- Separate-tab callback with no current Firebase user:
  explicit recovery state; original tab can reload and exchange its token
  without a second phone OTP.
- A malicious/external `returnTo` is reduced to the locale root.
- `auth` drawer query noise is removed by `safeAccountReturnTo`.
- Missing, expired, malformed, and replayed recovery state fails closed.
- Invalid, expired, and already-used Firebase action codes have specific,
  translated UI states.
- `auth/requires-recent-login` has a specific recovery message.
- Already-verified/idempotent replay does not create duplicate account claims or
  multiple sessions.
- UID mismatch between the recovery transaction and browser user fails closed.
- No raw PII or Firebase token appears in URLs, browser storage, logs, or test
  snapshots.
- Existing one-factor checkout session tests remain intact: verified email-only
  and verified phone-only both pass; zero verified factors fails.
- Existing order-contact tests remain intact: both normalized fields are
  required and verified-factor contradictions return `409`.

## Staging checkout fixture

- Test SKU: `STG-AMIS-LWLFL00026-10K`
- Price: `10,000 VND`
- Staging inventory baseline: `100`
- The source AMIS product was read only. The staging duplicate is separately
  marked and reversible.

Do not mutate the AMIS source or production data when exercising this fixture.
Use SePay Test Mode only.

## Current handoff verification status

Verified on the integration worktree before handoff:

- Focused Vitest: 10 files / 73 tests passed.
- Full Vitest: process exited 0; the token-filtered runner did not retain the
  aggregate count in its final output.
- TypeScript `--noEmit`: passed.
- Scoped ESLint: 0 errors, 2 existing `@next/next/no-img-element` warnings in
  `src/components/checkout/checkout-page.tsx`.
- `git diff --check`: passed.
- Batch state validator: passed.
- SePay Test bank-account discovery: sandbox endpoint returned HTTP 520 twice.
  No token, account ID, or response body was printed or written.
- Production build: webpack compilation completed successfully; the follow-up
  TypeScript phase was manually interrupted after it stopped producing output.
  Treat the build gate as pending, not passed.
- Disposable Supabase reset/pgTAP: pending in this handoff continuation.

The intended commit excludes `.env.local`, `.agents/`, and `supabase/.temp/`.
The staged release contains only the checkout/auth contract, its tests and
migration, translations, and this handoff document. No email-link recovery code
has been implemented in this release.

## Suggested verification commands

Run the repository's focused auth/checkout tests first, then:

- strict TypeScript/no-emit;
- scoped ESLint;
- full Vitest;
- disposable Supabase reset, lint, and pgTAP;
- production build with sandbox-only SePay Test configuration supplied in
  process memory;
- `git diff --check`;
- a staging browser smoke test confirming the fixture can reach SePay Test.

Never print `.env.local`, Firebase credentials, SePay tokens, callback secrets,
or resolved bank-account identifiers.
