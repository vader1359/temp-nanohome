# Integration Readiness Handoff — Local Staging Merge

## Scope and boundary

This record covers the user-authorized local-only integration of the five v3
lanes into `codex/ai-commerce-staging` in the isolated worktree
`/home/iant1359/develop/temp-nanohome-ulw-staging-integration`.

- Remote reviewed baseline: `origin/codex/ai-commerce-staging@b4d28a37cd77d895f8fea3ad72edc6f5fededd44`
- Local staging start: `b1afa51df3e290431c4a20736827fb4fbaee6810`
- Final local staging head before this handoff commit:
  `1a44d45f8c2562ee58eb88c3f4c44a1f6cbcae45`
- No fetch, push, deploy, billing action, live provider activation, remote
  database operation, or production migration was performed.
- Existing dirty files in the original Integration worktree were never staged,
  copied into commits, or modified. Local Playwright artifacts created in this
  isolated worktree were removed before this record.

All verification commands used these explicit offline-safe overrides:

```text
AUTH_PROVIDER=supabase PAYMENT_MODE=off CHAT_ENABLED=false VISION_PROVIDER=off
```

A mode-`0600` local `.env.local` was copied through the local bridge only to
satisfy build-time required-variable validation. Its values were never printed,
recorded, staged, or committed.

## Merge record

| Order | Lane source | Merge commit | Result |
| --- | --- | --- | --- |
| 1 | `bb7668a3a7bbc37e40e4c8c39a964ee813a70ad8` Foundation | `34ddc78d2ca682ffedc14836abba32faf442a3d3` | Clean merge; no conflicts. |
| 2 | `6e003c70fe834dcbbc520fd40a3df8be60bd0310` Account | `2118a375cfd656aedc753d447eca253173daace5` | Clean merge; no conflicts. |
| 3 | `5523bf467c33b325e512bf6938241db318defd2e` Chat | `cb217330d824c5cee2615882e5c702c9febd657f` | One scoped conflict; resolved below. |
| 4 | `17f93284de758fd19eca439aa83c72c5e436e46d` Checkout | `7c6161b508ff85d2e7964c1ef15699fcd5e50c58` | Clean merge; no conflicts. |
| 5 | `235e4d233aa26e16ae6f9194ee0e3fd28c816ca8` Personalization | `8897b9d18cb155225cd2689234e5e0e94dc7639c` | Clean merge; no conflicts. |

### Chat conflict resolution

`src/components/chat/public-chat-widget.tsx` conflicted. Resolution kept the
existing footer-safe launcher position state and scroll/resize behavior while
taking Chat lane's approved removal of the global consent gate: no
`aiProcessingAllowed`, no `/api/customer/context` fetch, and direct assistant
opening. This matches the master-plan decision to remove the global consent
banner without removing privacy or access controls.

## Integration-only repair commits

No merge commit was amended. The following bounded follow-ups keep merged code
buildable and its tests aligned with the integrated contracts:

| Commit | Purpose |
| --- | --- |
| `9b457f2` | Account server-translation test harness. |
| `178509b` | Account page translation-provider test harness. |
| `caef698` | Remove obsolete Chat consent-fetch assertion. |
| `78784fe` | Derive SePay success-page missing-order error state without synchronous effect update; add regression test. |
| `4576dd0` | Widen Account auth-flow fixture values for all locales. |
| `1a44d45` | Align Account offer translator value type with `next-intl`. |

## Verification evidence

### Targeted lane tests

| Lane | Command form | Result |
| --- | --- | --- |
| Foundation | Local-only `supabase/plan00-local/run-clean-reset.sh --target foundation` | Command completed successfully during Foundation merge; no captured count. |
| Account | Direct Vitest account/API/account-page/parity target | PASS — 44 files, 143 tests, 52.46s. |
| Chat | Direct Vitest capabilities/API/widget target | PASS — 3 files, 36 tests, 4.71s. |
| Checkout | Direct Vitest SePay/payment target | PASS — 10 files, 49 tests. |
| Personalization | Direct Vitest AMIS/projection/settings target | PASS — 13 files, 121 tests. |
| Checkout regression | Direct Vitest success-page test | PASS — 1 file, 1 test. |
| Account type repairs | Direct Vitest auth-flow and offer-list targets | PASS — 2 files, 6 tests. |

### Full local application gates

| Command | Result |
| --- | --- |
| Direct Vitest full suite | PASS — 219 files, 1,171 tests, 270.25s. Vite CJS Node API deprecation notice only. |
| Direct ESLint | PASS — 0 errors, 30 warnings. Warnings retained without unrelated cleanup. |
| Direct `tsc --noEmit` | PASS — 0 errors. |
| Direct `next build --webpack` | Build artifacts produced after TypeScript completed; `.next/BUILD_ID` and `.next/server/app-paths-manifest.json` present. Tool output did not retain a final route-count line, so this is artifact-based completion evidence. |
| `git diff --check` | PASS before this documentation change. |

### Disposable local SQL gate

`timeout 900 bash supabase/plan00-local/run-clean-reset.sh --full` was rerun
sequentially with the safe overrides and exited **1**. The harness redirects
its `supabase start`, reset, lint, and test command output to `/dev/null`, so
no failing-file or test-count detail was emitted. This remains a local,
disposable SQL/RLS blocker; no remote database was contacted. It needs a
separate diagnostic run that preserves local harness diagnostics before a
release decision.

### Browser and accessibility evidence

Safe-mode Chromium command:

```text
./node_modules/.bin/playwright test e2e/smoke-i18n.spec.ts e2e/product-navigation.spec.ts --project=chromium --workers=1
```

Result: **12 passed, 3 failed** of 15.

1. Vietnamese product navigation stayed at `/vi/products` after the test chose
   its first `a[href*='/products/']`; expected a detail URL. English navigation
   passed.
2. `/en` returned 200 but root `<html lang>` was `vi`, not `en`.
3. `/ko` returned 200 but root `<html lang>` was `vi`, not `ko`.

Source inspection found the root layout hardcodes `lang="vi"`, while the
localized layout applies locale only to an inner shell. These root-layout and
selector issues predate this integration and are outside scoped merge-conflict
reconciliation. They block full locale/accessibility E2E completion. Server
notices also included the middleware-to-proxy deprecation, an LCP image
advisory, and an existing asynchronous React state-update warning.

## Required follow-up before release

1. Diagnose the suppressed local SQL gate failure and rerun it with captured
   local-only diagnostics.
2. Correct root document locale ownership using the repository's current Next
   App Router and `next-intl` guidance, then rerun locale/accessibility E2E.
3. Tighten Vietnamese product-detail E2E selection to a real canonical product
   link, then rerun product navigation.
4. Run authenticated E2E, visual/Percy, external Sandbox proofs, and release
   acceptance mapping only after their required credentials and approvals.

## Feature flags, rollback, and release status

Safe defaults remain `AUTH_PROVIDER=supabase`, `PAYMENT_MODE=off`, and
`CHAT_ENABLED=false`; vision remains off for this evidence run. Provider
activation requires separate approved credentials and contract proof.

Rollback is bounded to the integration merge/follow-up commits above. Any
approved shared schema reversal must use a new forward migration, never edit a
historical migration.

**Readiness: local merge complete; release not ready.** All five lane branches
are integrated locally and application unit/type/lint gates pass, but local SQL
and browser locale/product-navigation gates remain non-zero. Production remains
untouched pending those fixes and explicit release authorization.
