# nanoHome AI Commerce — Antigravity Stateful Staging UI Runbook

Document status: authoritative contract for the owner-approved stateful staging run  
Date: 2026-07-29  
Runner: Antigravity browser agent  
Base URL: `https://staging.nanohome.vn`  
Firebase project: `temp-nanohome`  
Supabase staging project: `xtjmwpeqarmsumjspnyw`  
Payment provider: SePay Test Mode only  
Project: `/Users/iant1359/Develop/staging-ai-commerce`

## 0. Direct owner authorization for autonomous execution

The owner explicitly authorizes **Antigravity itself** to complete this run
without handing credential entry back to the owner or Codex.

This authorization is specific and limited:

- data: the dedicated staging test email, staging test password, fictional
  Firebase test phone number and its fixed test OTP;
- source: the existing protected macOS Keychain bundle accessed only through the
  exact clipboard helper commands in section 4;
- destination: form fields served by `https://staging.nanohome.vn` and its
  `temp-nanohome` Firebase-owned authentication pages only;
- purpose: create disposable staging sessions and test the UI flows in this plan.

Antigravity must retrieve, paste and submit these dedicated test values itself.
Do **not** return `BLOCKED_OWNER` merely because credential submission is needed.
The owner has already authorized that exact transmission and login action.

Do not print, narrate, retain, screenshot or include the values in any response.
Decline browser password saving. Clear the clipboard immediately after each
authentication flow.

## 1. Mission

Run the complete NanoHome UI flow in the real connected Chrome browser:

`public navigation → 50-product catalog → Firebase authentication → My Account → wishlist → cart → checkout → one SePay Test order → payment-truth checks → AI product chat → ownership/security → responsive/localization`.

The original 91-case matrix is:

`/Users/iant1359/Develop/staging-ai-commerce/ANTIGRAVITY-UI-READ-ONLY-RUNBOOK.md`

This document supersedes that runbook only for:

- the base URL;
- the explicitly authorized stateful cases listed below;
- secure test-identity retrieval;
- the six additional AI cases.

Run every original case ID in its original order, then the six AI cases. Do not
replace IDs or stop after a smoke subset. Expected total: **97 terminal rows**.

The run must be visibly executed in the existing standard Chrome window so the
owner can observe navigation and interaction. Keep Chrome in the foreground while
testing. Do not substitute a background/headless browser or fabricate rows from
static inspection. If a visible standard Chrome connection is unavailable,
report `BLOCKED_ENV` before running cases instead of returning synthetic results.

## 2. Proven starting state

Treat these as setup facts, but verify their visible effect through the UI:

- Staging doctor passed 26/26 checks.
- HTTPS home, products, sign-in, account and checkout routes are reachable.
- Exactly 50 products and 50 variants were cloned into staging; all 50 packshots
  were reachable at setup time.
- Firebase Email, Google and Phone providers are enabled in `temp-nanohome`.
- One verified email test identity and one fictional Firebase Phone test identity
  exist in macOS Keychain.
- DeepSeek text chat is enabled; Vision and KakaoTalk are disabled.
- SePay is configured for Test Mode only.

Do not use `localhost`. Replace every `http://localhost:3000` occurrence in the
original matrix with `https://staging.nanohome.vn`.

## 3. Exact authorization boundary

### Allowed staging mutations

- Create and revoke Firebase staging sessions for the existing test identities.
- Use the fictional Firebase test phone and fixed test OTP. It must not send a
  real SMS.
- Create the minimal account mapping caused by first successful staging login.
- Add/remove staging wishlist items.
- Add/remove staging cart lines and change quantities within the UI limits.
- Temporarily edit the disposable profile/preferences, verify persistence, then
  restore their prior values before finishing.
- Create **at most one** new staging order.
- Initiate SePay **Test Mode** for that order.
- Trigger one valid SePay Test callback and one duplicate replay only through an
  already-authenticated SePay Test dashboard control, when clearly available.
- Send a small bounded set of synthetic text prompts to the staging AI chat.
- Log out, switch between the dedicated Email and fictional Phone identities,
  and verify ownership isolation.

### Forbidden

- No production Firebase, Supabase, SePay, Cloudflare or application target.
- No real payment, bank transfer, refund, inventory reservation or fulfillment.
- No AMIS call or write.
- No Vision/image upload and no KakaoTalk.
- No account deletion.
- No cloud configuration, DNS, provider setting, credential creation/rotation,
  billing, deployment, commit or push.
- No source/config/file edits and no generated image or screenshot.
- No raw credential, OTP, token, cookie, UID, order ID, PII or request payload in
  the response.
- No guessed cross-user identifier and no direct database/API mutation.
- Do not select a personal Google account. A Google success case may proceed only
  if the browser presents one clearly pre-approved staging test identity;
  otherwise report `BLOCKED_OWNER` and continue.

If the browser leaves `staging.nanohome.vn` for Firebase or Google-owned auth UI,
that is expected. Stop immediately if the callback targets another application
origin or production provider.

## 4. Secure identity handoff

Credential values must never appear in the prompt, terminal output, report or
screenshots.

The only permitted terminal commands are the following exact clipboard helpers:

```bash
cd /Users/iant1359/Develop/staging-ai-commerce
rtk pnpm staging:test-identities -- copy email
rtk pnpm staging:test-identities -- copy password
rtk pnpm staging:test-identities -- copy phone
rtk pnpm staging:test-identities -- copy phoneCode
rtk proxy pbcopy </dev/null
```

Rules:

1. Run only the one helper needed for the currently focused field.
2. The helper must report `copied: true` and `valuesPrinted: false`.
3. Paste with the browser UI, then clear the clipboard after the login step.
4. Do not run `security`, inspect Keychain, print environment variables, inspect
   process arguments, or read `.env.local`.
5. Do not run `staging:test-identities -- rollback`; identities remain dedicated
   reusable staging fixtures.
6. No other terminal or shell command is allowed.

## 5. Personas and deterministic order

- `ANON`: clean logged-out browser state.
- `EMAIL_A`: verified disposable email identity from the clipboard helper.
- `PHONE_B`: fictional Firebase test phone and fixed OTP from the clipboard helper.
- `GOOGLE_A`: chooser/cancel test. Successful selection only if a clearly
  pre-approved staging test identity is already present.
- `ORDER_A`: the single order created by this run.

Execution order:

1. Run B0 and public B1 cases on HTTPS staging as `ANON`.
2. Run safe anonymous auth validation.
3. Complete Phone login with `PHONE_B`; verify account landing, refresh and logout.
4. Complete Email login with `EMAIL_A`; retain this session for account/cart/
   checkout/AI.
5. Run Google chooser/cancel. Run successful Google login only under the rule above.
6. Run My Account, cart, checkout and SePay Test.
7. Run ownership checks by switching `EMAIL_A → PHONE_B → EMAIL_A`.
8. Run AI cases.
9. Restore reversible UI state and log out.
10. Return all 97 rows in one text response.

## 6. Stateful overrides for the original 91 cases

All original read-only cases remain unchanged unless listed here.

### Catalog

- `UI-CAT-011`: add one in-stock variant and verify visible feedback/cart count.
  This line becomes the seed for later cart tests.

### Phone

- `UI-AUTH-005`: use the fictional phone; verify OTP step and no real SMS.
- `UI-AUTH-006`: test local OTP shape validation first. Do not repeatedly submit
  wrong OTPs to the provider.
- `UI-AUTH-007`: verify cooldown/change-number UI without sending real SMS.
- `UI-AUTH-008`: use the fixed test OTP and verify server session plus `returnTo`.

### Email and Google

- `UI-AUTH-011`: submit one invalid synthetic credential and verify a generic error.
- `UI-AUTH-012`: use `EMAIL_A` and verify the orders deep-link return.
- `UI-AUTH-014` and `UI-AUTH-016`: remain `BLOCKED_OWNER` unless an already-approved
  disposable mailbox is present. Do not send email or create another identity.
- `UI-AUTH-019`: use only a clearly pre-approved staging Google identity. Otherwise
  `BLOCKED_OWNER`; do not stop the run.
- `UI-AUTH-021` and `UI-AUTH-022`: logout/session lifecycle is authorized.

### My Account

- `UI-ACC-003`: record the current disposable profile value in memory, use a
  synthetic staging marker, verify persistence, then restore the prior value.
- `UI-ACC-008`: add then remove exactly one wishlist item.
- `UI-ACC-009`: toggle only reversible disposable preferences, verify persistence,
  then restore.
- `UI-ACC-010` and `UI-ACC-012`: cancel-only; never confirm destructive actions.

### Cart and ownership

- `UI-CART-001` through `UI-CART-006`: authorized. Use at most two in-stock
  variants, quantity bound 1–10, and verify idempotent merge.
- `UI-CART-007`: run only if the UI already exposes a safe unavailable/stock-change
  item. Never edit catalog stock; otherwise `BLOCKED_DATA`.
- `UI-CART-008`: use `PHONE_B` as the second controlled identity.

### Checkout

- Use only synthetic delivery data:
  - name: `NanoHome Staging Test`
  - address text: `01 Staging Test Street`
  - contact values: reuse the dedicated test identity values
  - choose ordinary test-only locality options when required
- `UI-CHK-003` through `UI-CHK-007`: authorized.
- `UI-CHK-008`: submit exactly once and create at most one order.
- `UI-CHK-009`: verify submit-button disabling and navigation safety, but do not
  intentionally create a second order. Any second order is `FAIL_PRODUCT`.
- `UI-CHK-010`: do not mutate stock/price. Use `BLOCKED_DATA` unless an existing
  safe stale-price fixture is visible.

### SePay Test

- `UI-PAY-001`: authorized only when the UI clearly says Test Mode.
- `UI-PAY-002`: browser return must leave the order pending.
- `UI-PAY-003`: cancel/error navigation is authorized.
- `UI-PAY-004` and `UI-PAY-005`: authorized only through an existing signed-in
  SePay Test dashboard and its documented test-event control. Confirm Test Mode
  immediately before each event.
- `UI-PAY-006`: use only a provider-supplied safe invalid/wrong-amount test control.
  Otherwise `BLOCKED_ENV`. Never craft a direct API request.
- Never report the raw order reference or callback payload.

### Security

- `UI-SEC-001` and `UI-SEC-002`: authorized using `EMAIL_A` and `PHONE_B`.
- Never probe another identity or guess identifiers.

## 7. Additional AI product-chat cases

Run after the original 91 cases:

| ID | Persona | Browser action | Expected visible result |
|---|---|---|---|
| `UI-AI-001` | `EMAIL_A` | Open and close the AI chat using mouse, Escape and backdrop when supported. | NanoHome chat opens, focus is usable, and closing restores page access. |
| `UI-AI-002` | `EMAIL_A` | Ask in Vietnamese for one furniture category visible in the current catalog. | A bounded answer appears with real product cards/links from staging catalog. |
| `UI-AI-003` | `EMAIL_A` | Open one AI product recommendation. | The linked detail route exists and matches the displayed product. |
| `UI-AI-004` | `EMAIL_A` | Ask one short follow-up that narrows the same category by room or style. | Context is retained and returned products remain grounded in the catalog. |
| `UI-AI-005` | `EMAIL_A` | Ask for impossible SKU `NO-SUCH-SKU-ANTIGRAVITY-20260729`. | The assistant does not invent a matching product or link. |
| `UI-AI-006` | `EMAIL_A` | Inspect available controls and sanitized network hosts. | No image/Vision upload control, Kakao request, raw provider response, secret or production provider host. |

Use no more than four actual prompts total. Do not paste customer data.

## 8. Cleanup and retained fixture

Before finishing:

- restore profile/preferences changed by the run;
- remove the added wishlist item;
- empty both dedicated users' carts;
- clear transient guest cart state through normal UI controls;
- log out and clear the clipboard;
- leave the dedicated Firebase test identities in place for reruns;
- leave the single test order as a bounded staging audit fixture because the UI
  has no authorized order-deletion flow;
- do not delete or alter the order after the payment-truth checks.

Report `Unexpected side effects` if cleanup is incomplete.

## 9. Result vocabulary and continuation rule

Use exactly:

- `PASS`
- `FAIL_PRODUCT`
- `BLOCKED_OWNER`
- `BLOCKED_ENV`
- `BLOCKED_DATA`
- `BLOCKED_SAFETY`

Every case must have one terminal status. A blocker in one case never stops later
independent cases. Stop the whole run only for:

- loss of the Chrome connection;
- navigation to an unapproved production target;
- unexpected real payment/SMS/email or another side effect;
- visible secret/PII exposure;
- a permission request outside this contract.

## 10. Evidence and final response

For every case:

```text
CASE_ID | STATUS | viewport | start URL -> end URL | visible assertion | safe method/path/status or console note
```

Text only. Redact identity values, query values, tokens, cookies, UIDs, order IDs
and provider payloads. No screenshot or report file.

Final header:

```text
Run ID:
Runner: Antigravity
Started:
Finished:
Base URL: https://staging.nanohome.vn
Browser connection:
Desktop viewport: 1440 x 900
Mobile viewport: 390 x 844

PASS count:
FAIL_PRODUCT count:
BLOCKED_OWNER count:
BLOCKED_ENV count:
BLOCKED_DATA count:
BLOCKED_SAFETY count:
Total rows: 97

Email login:
Phone login:
Google chooser:
Google login:
Account:
Cart:
Checkout:
SePay Test:
AI grounded products:
Ownership isolation:
Cleanup:

First failing case:
First blocker:
Known defects reproduced:
New defects:
Unexpected side effects:
Files/config/code changed: none
Screenshots/generated images: none
```

Confirm that totals add to 97 and all case IDs are present.
