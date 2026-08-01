# Staging browser run — checkout/email-link recovery

- Date: 2026-07-31
- Target: `https://staging.nanohome.vn`
- Local branch: `codex/ai-commerce-five-worktree-integration`
- Local HEAD: `f4b37bc`
- Secrets/PII recorded: no

## EL-001 — missing recovery state

- Status: **FAIL**
- Severity: **P1**
- Repro rate: 1/1
- Locale: `vi`
- Action: opened `/vi/auth/email-link` without query parameters.
- Final URL: `https://staging.nanohome.vn/vi/auth/email-link`
- Expected: invalid-link state, no verified/success claim, local sign-in fallback.
- Actual: UI claimed that email had been verified and instructed the shopper to return to the original checkout tab.
- Console: 0 errors, 0 warnings.
- URL scrub: pass; no sensitive query remained.
- Side effects: none.
- Suspected surface: the staging deployment is older than the current local recovery implementation. The current local component initializes missing state as `invalid`, while the deployed bundle renders the old return-to-original-tab success wording.

## Run blocker

The staging deployment does not match the branch under test, so the remaining staging acceptance cases would evaluate the wrong implementation. Deploy the current integration branch to staging before resuming Phase F.

## Follow-up run — local and staging browser checks

- Browser surface: Codex in-app browser.
- Local target: `http://127.0.0.1:3000`.
- Staging target: `https://staging.nanohome.vn`.
- Secrets/PII recorded: no.

### Local recovery matrix

- Status: **PASS** for the negative/recovery-state matrix.
- Cases exercised: missing state, hostile `returnTo`, fake Firebase `mode/oobCode`, short state, invalid state characters, `/en`, and `/ko`.
- Expected local result: localized invalid-link state; no success claim; no external redirect.
- Actual: all cases rendered the invalid-link state; URLs stayed on nanoHome; console 0 errors/warnings across the matrix.

### Local checkout fixture

- Status: **PASS** for the public fixture surface.
- Fixture: `STG-AMIS-LWLFL00026-10K`, displayed price `10,000 VND`, status `Đang có hàng`.
- Add-to-cart control was present and clickable; cart control became active.
- No browser console errors/warnings.
- Authentication/payment completion was not claimed from local because no test identity or payment transaction was submitted.

### Staging checkout entry

- Status: **PASS** up to authentication handoff.
- Fixture product was visible with the expected SKU, price, and stock.
- Cart drawer showed the fixture and `Hoàn tất giỏ hàng`.
- Following it navigated to `/vi/account/sign-in?returnTo=%2Fvi%2Fcheckout&intent=checkout`.
- Phone and email sign-in modes were available; Google button was present and enabled.
- Empty email submission returned the generic `Email hoặc mật khẩu không đúng.` validation message; no console errors/warnings.
- Real Google/Firebase login, cross-tab email-link handoff, checkout submit, and SePay Test Mode payment were not completed because they require a configured test identity/inbox and an authorized payment transaction.

### Staging invalid-link regression

- Status: **FAIL**, severity **P1**, reproduced 2/2 (missing state and `state=abc`).
- Actual: staging rendered the verified-email success message and `Quay lại checkout` instead of invalid-link recovery.
- English and Korean staging pages rendered the same old verified-email success state.
- Console: 0 errors, 0 warnings.

## Automated gates in this follow-up

- `npm test`: **PASS**, 259 files / 1,512 tests.
- `npx tsc --noEmit`: **PASS**.
- `PAYMENT_MODE=off npm run build`: **PASS**, 110 routes generated.
- `supabase/plan00-local/run-clean-reset.sh --full` (via the available `npx supabase` binary): **PASS**, 28 files / 927 tests plus Instagram lane 1 file / 8 tests; disposable local stack cleaned by the harness.
- Source lint (`src`, `messages`, `scripts`, `e2e`, excluding generated reports): **PASS**.
- Default `npm run lint`: **FAIL** only because ESLint scans generated `playwright-report` and `test-results` assets; source lint has no errors.
- `git diff --check`: **PASS**.
- `npm run test:e2e`: **BLOCKED**, 22/22 failed at browser launch because WSL lacks `libnspr4.so`; no application assertions were reached.

## E2E/lint remediation follow-up

- ESLint flat-config ignores now include `playwright-report/**`, `test-results/**`, and `blob-report/**`.
- Playwright `webServer` now uses `npm run dev -- --hostname 0.0.0.0`; it no longer depends on Bun being installed in WSL.
- WSL runtime packages `libnspr4`, `libnss3`, and the Chromium GTK/graphics/audio dependencies were installed in the Ubuntu distro.
- `npm run lint`: **PASS** after the config fix.
- `npm run test:e2e`: browser launch **PASS**; 17 tests passed, 1 flaky, 4 failed.
- The remaining 4 failures are application/data-contract findings, not browser launch failures: catalog currently exposes zero `categoryOptions`, the `kaleido` search fixture returns zero products, and one product navigation has dev-router timing instability.

## Final local/current-branch acceptance run

- Date: 2026-07-31.
- Browser surface: Codex in-app browser plus the repository Playwright suite.
- Target: current worktree at `http://localhost:3000`; staging Supabase/AMIS/SePay sandbox integrations.
- Secrets/PII recorded: no.
- Production writes or real-money payment: none.

### Catalog source and import evidence

- Production public catalog variants fetched: 2,173.
- AMIS source products fetched: 28,193.
- Staging variants after additive import: 2,182.
- API pagination audit: fetched 2,182 / total 2,182; unique 2,182; duplicates 0; complete true.
- Eligibility counts: category 2,107; rooms 1,023; storefront/cart/payment 900.
- Payment fixture status: line present, stock 100, storefront/cart/payment eligible, environment `staging-preview/sepay-sandbox`.

### Browser flow evidence

- Catalog filter `category=furniture&room=living-room`: 24 visible cards; category mismatch 0; room mismatch 0.
- Pagination page 1/page 2: 24 cards per page; product-link overlap 0.
- Aggregate search `Series 7`: six product previews and one brand result; measured navigation about 1.4 seconds after the bounded-preview fix; no console warnings/errors.
- Fixture PDP: dynamic title and canonical matched the fixture slug; empty image sources 0; all above-fold duplicate image instances were eager; no console warnings/errors on a fresh tab.
- Cart: add changed header count to 1; English drawer exposed `Clear all`, `Decrease quantity`, and `/en/checkout`; cleanup returned `Your cart is empty`.
- Guest checkout: redirected to `/vi/account/sign-in?returnTo=%2Fvi%2Fcheckout&intent=checkout`.
- Locale/i18n: `vi`, `en`, `ko` routes, invalid locale behavior, English cart, and locale-preserving product filters passed.

### Integrated checkout and SePay sandbox evidence

- Fixture: `STG-AMIS-LWLFL00026-10K`, amount 10,000 VND.
- Guest redirect: true.
- Session exchange: true.
- Guest-state auto merge: true.
- Checkout API status: 201.
- Payment API status: 201.
- Payment environment: sandbox.
- QR image status: 200.
- Cleanup completed: true.
- Sensitive values printed: false.

### Final automated gates

- `npm run lint`: PASS.
- `npx tsc --noEmit`: PASS.
- `npx vitest run`: PASS, 261 files / 1,526 tests.
- Supabase clean reset and pgTAP: PASS, 28 files / 927 tests; Instagram lane 1 file / 8 tests.
- Playwright full suite with retries disabled: PASS, 25/25.
- Cart stress with retries disabled: PASS, 5/5.
- Previously flaky cart/search regression stress: PASS, 21/21.
- `git diff --check`: PASS.
- `PAYMENT_MODE=sepay_sandbox SEPAY_ENV=sandbox npm run build`: PASS, 110/110 pages generated.

## Remaining deployment boundary

`https://staging.nanohome.vn` is still an older deployment and does not contain the current worktree fixes. No commit, push, or deployment was performed in this run. The stale staging invalid-link result above remains a deployment mismatch, not a failure of the final local/current-branch acceptance run; rerun staging-domain acceptance after the current branch is deployed.
