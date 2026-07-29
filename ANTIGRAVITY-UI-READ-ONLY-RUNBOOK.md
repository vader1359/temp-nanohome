# nanoHome AI Commerce — Antigravity Read-Only UI Test Runbook

Document status: authoritative execution contract for this Antigravity run  
Date: 2026-07-29  
Application under test: `http://localhost:3000`  
Full source scenario: `/Users/iant1359/Develop/temp-nanohome/docs/testing/ai-commerce-ui-e2e-scenario.vi.md`  
Runner: Antigravity browser agent  
Execution owner: Antigravity, not Codex

## 1. Mission

Use the real Chrome UI to inspect every nanoHome AI Commerce flow:

`public navigation → catalog → authentication entry → account → cart → checkout → SePay Test payment state → security/accessibility/responsive/localization`.

This run is strictly read-only. Do not modify source files, runtime configuration,
cloud configuration, browser storage, accounts, catalog data, carts, wishlists,
profiles, orders, payments, DNS, secrets, or test ledgers.

The run is complete only when every case ID in section 7 has exactly one final
status. Do not replace the case IDs with invented `TC-*` IDs. Do not stop after a
smoke subset.

## 2. Non-negotiable safety boundary

### Allowed

- Read this runbook.
- Use the existing Chrome connection and the existing local app.
- Navigate by URL.
- Click links, tabs, menus, backdrops, close buttons, Back, Forward, and Cancel.
- Type obviously invalid synthetic values only for client-side validation cases.
- Open a Google provider chooser and cancel it without selecting an account.
- Inspect the accessibility tree, DOM snapshot, console messages, and sanitized
  network metadata.
- Resize the browser to the required viewports.
- Report only HTTP method, path, and status. Redact query values when they could
  identify a person or contain a token.

### Forbidden

- Do not use a terminal or shell.
- Do not edit or create any project file, report artifact, ledger, screenshot, or
  generated image.
- Do not call `take_screenshot`.
- Do not use `evaluate_script` when it creates an output artifact.
- Do not submit a valid login, OTP, registration, reset, profile, cart, wishlist,
  checkout, payment, delete, disconnect, notification, or preference mutation.
- Do not select a Google account.
- Do not send SMS, email, OTP, invitation, reset, or notification.
- Do not create, update, or delete Firebase, Supabase, AMIS, SePay, Cloudflare, or
  product data.
- Do not call AMIS directly.
- Do not commit, push, deploy, install, change DNS, change billing, or reveal a
  secret, cookie, token, UID, OTP, phone number, email address, or raw payload.
- Do not access production Firebase or production SePay.
- Do not enable Vision or KakaoTalk.

If an action would cross this boundary, do not perform it. Record
`BLOCKED_BY_NO_WRITE` for that case and continue to the next independent case.

## 3. Browser tools

Use browser UI tooling only:

- `navigate_page`
- `take_snapshot`
- `resize_page`
- `list_console_messages`
- `list_network_requests`
- safe `click` for navigation, tabs, menus, backdrops, close, Back, and Cancel
- safe `type` only for obviously invalid client-side validation inputs

Do not use screenshot generation, image generation, terminal commands, source
editing tools, or file-writing tools.

## 4. Required viewports

- Desktop: `1440 × 900`
- Mobile: `390 × 844`

Keep the browser at desktop size unless a case explicitly requires mobile.

## 5. Result vocabulary

Use exactly one of these statuses:

| Status | Meaning |
|---|---|
| `PASS` | The permitted UI actions were performed and the visible result matched the expectation. |
| `FAIL_PRODUCT` | The live UI violated the expected contract. |
| `BLOCKED_BY_NO_WRITE` | Completing the case requires a forbidden mutation or valid identity submission. |
| `BLOCKED_OWNER` | CAPTCHA, account choice, OTP, or owner-controlled identity is required before any safe observation can continue. |
| `BLOCKED_ENV` | The local runtime, browser connection, tunnel, or external dependency is unavailable. |
| `BLOCKED_DATA` | The required pre-existing safe fixture or entity is absent. |

Never use `SKIPPED`, `NOT_RUN`, or a new status.

## 6. Evidence format

For every case, report one compact row:

```text
CASE_ID | STATUS | viewport | start URL -> end URL | visible assertion | safe network/console note
```

Rules:

- Text-only evidence in the Antigravity response.
- No screenshots and no evidence files.
- Never quote PII, secrets, cookies, tokens, OTPs, raw request bodies, or raw
  provider responses.
- For a failure, include the first safe console error and only
  `HTTP method + path + status`.
- If a route times out but later renders, record both the timeout and the final
  visible state. Do not silently convert it to a clean pass.

## 7. Mandatory case matrix

### B0 — Environment preflight

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-ENV-001` | `RUN` | Open `/vi`, then reload once. | Complete nanoHome home page; no blank page, Next error overlay, or reload loop. |
| `UI-ENV-002` | `RUN` | Open `/vi/products`, `/vi/account/sign-in`, and `/vi/checkout` directly. | Valid UI or valid auth redirect; no contract-breaking 404. |
| `UI-ENV-003` | `RUN` | Inspect sanitized network metadata while reloading sign-in. | Only local/staging and expected sandbox-provider hosts; no Vision, KakaoTalk, production Firebase, or production SePay requests. |
| `UI-ENV-004` | `RUN` | Inspect visible errors, DOM snapshot, and console after reload. | No secret, token, cookie, server stack trace, or raw provider response. |
| `UI-ENV-005` | `RUN` | Repeat home-page smoke at desktop and mobile sizes. | No horizontal overflow; primary CTA remains visible and usable. |

### B1 — Public navigation

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-NAV-001` | `RUN` | Use the header to visit Home, Products, Brands, Designers, Catalog, News, and About when present. | Each item opens a valid route; header/footer remain intact; no dead link. |
| `UI-NAV-002` | `RUN` | At mobile size, open/close the menu, choose one navigation item, then use Back. | Menu focus and overlay behave; route and Back work. |
| `UI-NAV-003` | `RUN` | Switch the same page from Vietnamese to English to Korean. | Locale and URL change without 404 or loss of page context. |
| `UI-NAV-004` | `RUN` | Open one brand, one designer, and one news card if present; return to each list. | Detail content renders and Back returns to a usable list context. |
| `UI-NAV-005` | `RUN` | Open a nonexistent path under `/vi`. | Styled 404 with a safe route back. |

### B1 — Catalog, search, filters, and product detail

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-CAT-001` | `RUN` | Open `/vi/products`. | At least one product card; no incorrect empty catalog. |
| `UI-CAT-002` | `RUN` | Inspect initial cards and scroll to the end. | Image, title, brand, price, and stock UI do not break; pagination/load-more works if present. |
| `UI-CAT-003` | `RUN` | Search using a visible product/brand term already present on the page. | URL reflects the query; relevant results open a detail page. |
| `UI-CAT-004` | `RUN` | Search for `zzzz-no-nanohome-result-20260729`. | Clear empty state with a way to clear or return. |
| `UI-CAT-005` | `RUN` | Select a visible brand other than `moooi`, then clear it. | Results match the filter; clearing restores the list. |
| `UI-CAT-006` | `RUN` | Select visible category and room filters, then combine them with a brand. | Filter state is stable and count/list do not contradict each other. |
| `UI-CAT-007` | `RUN` | Remove filters one by one; use Back and Forward. | URL and controls stay synchronized; catalog remains usable. |
| `UI-CAT-008` | `RUN` | Inspect default results and search/filter for `moooi` only if the UI exposes it. | `moooi` is absent from the public catalog while unrelated products are not wrongly removed. |
| `UI-CAT-009` | `RUN` | Open a product card. | Detail image, name, variant, price, and stock agree with the card. |
| `UI-CAT-010` | `RUN` | Change a variant or image selector when available. | Visible image, price, stock, and CTA update without stale state. |
| `UI-CAT-011` | `BLOCKED_BY_NO_WRITE` | Do not click Add to Cart. Inspect only whether the CTA is visible. | Adding to cart would mutate browser/app state and is forbidden in this run. |
| `UI-CAT-012` | `RUN` | Open an already-visible unavailable/out-of-stock product if one can be found without changing data. | Purchase CTA is disabled or availability is clearly explained. Use `BLOCKED_DATA` if no such product is visible. |

### B2 — Authentication entry and Phone OTP

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-AUTH-001` | `RUN` | Open `/vi/account/orders` while unauthenticated. | Redirect to `/vi/account/sign-in?returnTo=%2Fvi%2Faccount%2Forders`; no 404. |
| `UI-AUTH-002` | `RUN` | Open account panel from the header; close with Escape; reopen and close with backdrop. | NanoHome-styled panel opens/closes and returns focus to its trigger. |
| `UI-AUTH-003` | `RUN` | Open the sign-in page. | Phone is the primary/default method; Google and email/password are secondary options. |
| `UI-AUTH-004` | `RUN` | Enter the synthetic invalid phone `123` and trigger client validation. | Vietnamese validation appears; no OTP step, SMS, or successful write request. Stop and fail if a write-capable request unexpectedly starts. |
| `UI-AUTH-005` | `BLOCKED_BY_NO_WRITE` | Do not submit a valid test phone. | A valid OTP request could send or mutate provider state. |
| `UI-AUTH-006` | `BLOCKED_BY_NO_WRITE` | Do not enter or verify an OTP. | OTP verification requires a prior provider mutation. |
| `UI-AUTH-007` | `BLOCKED_BY_NO_WRITE` | Do not request or resend an OTP. | Resend and phone switching depend on an OTP session. |
| `UI-AUTH-008` | `BLOCKED_BY_NO_WRITE` | Do not submit a valid OTP. | Creating a server session is outside this read-only run. |

### B2 — Email, password, registration, and reset entry

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-AUTH-009` | `RUN` | Select email/password and submit empty fields for client validation only. | Accessible validation appears; no successful session request. |
| `UI-AUTH-010` | `RUN` | Type synthetic password `not-a-real-password`, toggle Show/Hide, then clear it. | Input type changes without losing the value; no submit. |
| `UI-AUTH-011` | `BLOCKED_BY_NO_WRITE` | Do not submit credentials, even invalid ones. | Credential submission is forbidden for this run. |
| `UI-AUTH-012` | `BLOCKED_BY_NO_WRITE` | Do not sign in with a valid account. | Server-session creation is a write. |
| `UI-AUTH-013` | `RUN` | Open Forgot Password with email empty and trigger client validation. | Accessible validation appears; no email is sent. |
| `UI-AUTH-014` | `BLOCKED_BY_NO_WRITE` | Do not request a reset email. | Notification/provider mutation is forbidden. |
| `UI-AUTH-015` | `CANCEL_ONLY` | Open account creation, inspect fields/terms and invalid client validation, then cancel or navigate back. | NanoHome-styled form and validations work; no user is created. |
| `UI-AUTH-016` | `BLOCKED_BY_NO_WRITE` | Do not register or verify an account. | User creation and verification are writes. |

### B2 — Google and session lifecycle

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-AUTH-017` | `CANCEL_ONLY` | Click Continue with Google, observe whether chooser/popup/redirect opens, then cancel without selecting an account. | Loading ends; cancel returns safely; any compatibility error is actionable. |
| `UI-AUTH-018` | `CANCEL_ONLY` | Repeat the Google chooser-open/cancel check through the connected standard Chrome instance. | Google-owned UI may open; cancel returns safely. Never choose an account. |
| `UI-AUTH-019` | `BLOCKED_BY_NO_WRITE` | Do not select a Google account. | Firebase/server-session creation is forbidden. |
| `UI-AUTH-020` | `RUN` | Open sign-in URLs with `returnTo=https://example.com`, `returnTo=//example.com`, and a different-locale local path; inspect/cancel only. | UI never offers an unsafe external redirect and retains only an allowlisted local destination. |
| `UI-AUTH-021` | `BLOCKED_BY_NO_WRITE` | Do not log out an existing session. | Session revocation/state change is forbidden. |
| `UI-AUTH-022` | `BLOCKED_BY_NO_WRITE` | Do not perform cross-tab logout/revoke. | Session mutation is forbidden. |

### B3 — My Account

If an authenticated sandbox session already exists before this run, inspect its
read-only pages. Do not create a session. If no session exists, record
`BLOCKED_OWNER` for read-only account cases and continue.

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-ACC-001` | `RUN_IF_SESSION_EXISTS` | Open `/vi/account`. | Profile page renders without 404/503 and does not expose another user. |
| `UI-ACC-002` | `RUN_IF_SESSION_EXISTS` | Inspect masked verification and AMIS status. | Contact details stay in the profile; AMIS is coarse status only, never a raw record. |
| `UI-ACC-003` | `BLOCKED_BY_NO_WRITE` | Do not edit or save profile data. | Profile mutation is forbidden. |
| `UI-ACC-004` | `RUN_IF_SESSION_EXISTS` | Type an obviously invalid synthetic value only if validation can be triggered without saving; otherwise block. | Inline accessible validation; no old value is overwritten. |
| `UI-ACC-005` | `RUN_IF_SESSION_EXISTS` | Navigate Profile, Orders, Wishlist, Cart, Offers, Preferences, and Security. | All seven routes render and navigation works at desktop/mobile sizes. |
| `UI-ACC-006` | `RUN_IF_SAFE_ORDER_EXISTS` | Open existing order list/detail without changing it. | Snapshot items, totals, and payment status are internally consistent. Use `BLOCKED_DATA` if absent. |
| `UI-ACC-007` | `RUN_IF_SESSION_EXISTS` | Open a clearly nonexistent synthetic order ID only. Do not guess another user's ID. | Safe not-found response with no existence disclosure. |
| `UI-ACC-008` | `BLOCKED_BY_NO_WRITE` | Inspect wishlist only; do not add or remove. | Add/remove requires mutation. |
| `UI-ACC-009` | `RUN_IF_SESSION_EXISTS` | Inspect Offers and Preferences without toggling anything. | Clear empty/list state and visible controls. |
| `UI-ACC-010` | `CANCEL_ONLY` | Open dangerous-action confirmation dialogs and click Cancel only. | Confirmation appears; cancel leaves state unchanged. |
| `UI-ACC-011` | `RUN_IF_SESSION_EXISTS` | Inspect Security. | Providers are masked; no raw token or UID. |
| `UI-ACC-012` | `BLOCKED_BY_NO_WRITE` | Do not type the delete confirmation phrase or confirm deletion. | Account-deletion interaction is forbidden. |

### B4 — Cart and guest merge

Inspect only the pre-existing cart state. Do not add, remove, merge, or change
quantity.

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-CART-001` | `BLOCKED_BY_NO_WRITE` | Do not add variants. | Cart mutation is forbidden. |
| `UI-CART-002` | `BLOCKED_BY_NO_WRITE` | Do not add the same variant again. | Cart mutation is forbidden. |
| `UI-CART-003` | `BLOCKED_BY_NO_WRITE` | Do not change quantity or browser storage. | Cart mutation is forbidden. |
| `UI-CART-004` | `BLOCKED_BY_NO_WRITE` | Do not remove cart lines. | Cart mutation is forbidden. |
| `UI-CART-005` | `BLOCKED_BY_NO_WRITE` | Do not create or merge a guest cart. | Cart/session mutation is forbidden. |
| `UI-CART-006` | `BLOCKED_BY_NO_WRITE` | Do not retry a merge. | Cart mutation is forbidden. |
| `UI-CART-007` | `RUN_IF_PREEXISTING_STATE` | Inspect any already-visible unavailable/stock-change warning without changing quantity. | Warning blocks checkout for unavailable items. Otherwise `BLOCKED_DATA`. |
| `UI-CART-008` | `BLOCKED_BY_NO_WRITE` | Do not switch identities or create cross-user cart state. | Session/cart mutation is forbidden. |

### B5 — Checkout

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-CHK-001` | `RUN` | Open `/vi/checkout` while unauthenticated; do not submit. | Safe sign-in requirement with local `returnTo`; no order is created. |
| `UI-CHK-002` | `RUN_IF_SESSION_EXISTS` | Open checkout with the current pre-existing empty account cart. | Empty state and Continue Shopping; no payment request. |
| `UI-CHK-003` | `RUN_IF_PREEXISTING_STATE` | Inspect an already-prepared checkout without editing it. | Summary, price, quantity, delivery UI, and SePay Test label are coherent. Otherwise `BLOCKED_DATA`. |
| `UI-CHK-004` | `RUN_IF_PREEXISTING_STATE` | Navigate existing checkout steps at mobile size without changing fields or submitting. | Back/Next presentation is usable and fields remain visible. Otherwise `BLOCKED_DATA`. |
| `UI-CHK-005` | `RUN_IF_NO_WRITE` | Trigger empty/invalid client validation only when no network request is sent. | Accessible validation; no order is created. |
| `UI-CHK-006` | `RUN_IF_NO_WRITE` | Toggle VAT presentation only if it does not persist; do not enter real data. | Fields show/hide without breaking delivery UI. |
| `UI-CHK-007` | `RUN_IF_PREEXISTING_STATE` | Inspect coupon control only. | Disabled and marked coming soon; no fake discount. |
| `UI-CHK-008` | `BLOCKED_BY_NO_WRITE` | Do not submit checkout. | Order creation is forbidden. |
| `UI-CHK-009` | `BLOCKED_BY_NO_WRITE` | Do not submit, double-click, retry, or create an order. | Idempotency requires a write-capable test. |
| `UI-CHK-010` | `BLOCKED_BY_NO_WRITE` | Do not modify price/stock fixtures or submit. | Server-truth mutation test is forbidden. |

### B6 — SePay Test and payment truth

Never initiate a payment or provider event in this run.

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-PAY-001` | `BLOCKED_BY_NO_WRITE` | Do not initiate checkout/payment. | Payment initiation is forbidden. |
| `UI-PAY-002` | `RUN_IF_SAFE_PENDING_ORDER_EXISTS` | Open an existing sanitized pending-order return/status route without provider action. | Browser return alone does not show Paid. Otherwise `BLOCKED_DATA`. |
| `UI-PAY-003` | `RUN_IF_SAFE_ROUTE_EXISTS` | Open cancel/error UI routes without a real payment reference. | Safe message and path back; no paid state. |
| `UI-PAY-004` | `BLOCKED_BY_NO_WRITE` | Do not send or request a Test webhook. | Provider/server mutation is forbidden. |
| `UI-PAY-005` | `BLOCKED_BY_NO_WRITE` | Do not replay a Test webhook. | Provider/server mutation is forbidden. |
| `UI-PAY-006` | `BLOCKED_BY_NO_WRITE` | Do not send a wrong-amount or invalid event. | Provider/server mutation is forbidden. |
| `UI-PAY-007` | `RUN` | Open `https://staging.nanohome.vn` only for a read-only home/catalog/auth-entry smoke if reachable. | HTTPS reaches staging UI and exposes no tunnel token. Record `BLOCKED_ENV` if unreachable. |

### B7 — Ownership, security, accessibility, responsive, and localization

| ID | Execution | Browser action | Expected visible result |
|---|---|---|---|
| `UI-SEC-001` | `BLOCKED_BY_NO_WRITE` | Do not switch identities or probe guessed user IDs. | Cross-user test requires controlled sessions. |
| `UI-SEC-002` | `BLOCKED_BY_NO_WRITE` | Do not log out or revoke a session. | Session mutation is forbidden. |
| `UI-SEC-003` | `RUN` | Navigate to sign-in with malicious external `returnTo` values and to harmless synthetic payment-return paths without a real order ID. | No open redirect and no automatic Paid state. |
| `UI-SEC-004` | `RUN` | Inspect URLs, banners, DOM snapshots, console, and sanitized request names. | No UID, token, cookie, OTP, raw AMIS record, or secret. |
| `UI-A11Y-001` | `RUN` | Use keyboard only to open/close account auth UI, switch methods, focus fields, and cancel. | Logical focus order, dialog focus containment, Escape close, and focus return. |
| `UI-A11Y-002` | `RUN` | Trigger safe empty/invalid auth validation and inspect the accessibility tree. | Inputs have labels; errors use alert/live semantics; loading is not color-only. |
| `UI-A11Y-003` | `RUN_IF_UI_AVAILABLE` | At 200% browser zoom, inspect auth and any already-accessible account/cart/checkout pages. | No lost/overlapping content; CTA remains reachable; no severe horizontal overflow. |
| `UI-RWD-001` | `RUN` | At `390 × 844`, smoke catalog, auth entry, account route guard, cart view, and checkout route guard. | No off-screen controls; sticky UI does not cover fields or CTA. |
| `UI-RWD-002` | `RUN` | Repeat the smoke at `1440 × 900`. | Correct desktop layout; no stale mobile-only state. |
| `UI-LOC-001` | `RUN` | Repeat basic route, auth validation, and route-guard smoke in English and Korean. | No raw/missing translation key; redirects and account routes retain locale. |

## 8. Execution order

Run sequentially:

1. B0 environment preflight.
2. B1 public navigation.
3. B1 catalog/search/filter/detail.
4. B2 authentication entry, safe validation, and Google cancel-only checks.
5. B3 account read-only inspection if a session already exists.
6. B4 cart read-only inspection.
7. B5 checkout route guards and read-only presentation.
8. B6 SePay Test read-only route/status inspection.
9. B7 security, accessibility, responsive, and localization.

Continue past `BLOCKED_BY_NO_WRITE`, `BLOCKED_OWNER`, and `BLOCKED_DATA` cases when
later cases remain independently testable. Stop only for:

- loss of the Chrome connection;
- an unexpected write or side effect;
- visible secret/PII exposure;
- a permission dialog requesting a forbidden tool.

If stopped, report the first stopping case and keep all completed rows.

## 9. Final report contract

Return one text response containing:

```text
Run ID:
Runner: Antigravity
Started:
Finished:
Base URL:
Browser connection:
Desktop viewport:
Mobile viewport:

PASS count:
FAIL_PRODUCT count:
BLOCKED_BY_NO_WRITE count:
BLOCKED_OWNER count:
BLOCKED_ENV count:
BLOCKED_DATA count:
Total rows: 91

First failing case:
First environment blocker:
Known defects reproduced:
New defects:
Unexpected side effects: none / details
Files or data changed: none
Screenshots or generated images created: none
```

Then list all 91 case rows in original order. Confirm that the totals add to 91.
Do not claim completion if any case ID is absent.
