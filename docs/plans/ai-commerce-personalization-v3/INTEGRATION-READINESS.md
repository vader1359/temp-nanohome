# Integration Readiness Handoff — Local Staging Merge

## Scope and boundary

This record covers the user-authorized local-only integration of the five v3
lanes into `codex/ai-commerce-staging` in the isolated worktree
`/home/iant1359/develop/temp-nanohome-ulw-staging-integration`.

- Remote reviewed baseline: `origin/codex/ai-commerce-staging@b4d28a37cd77d895f8fea3ad72edc6f5fededd44`
- Local staging start: `b1afa51df3e290431c4a20736827fb4fbaee6810`
- Final local staging head before this handoff update:
  `28bcfb6d1e1dca678d839bb3f2e9a47a9c97209d`
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
| Direct Vitest full suite | PASS — 220 files, 1,176 tests, 83.16s. Vite CJS Node API deprecation notice only. |
| Direct ESLint | PASS — 0 errors, 30 warnings. Warnings retained without unrelated cleanup. |
| Direct `tsc --noEmit` | PASS — 0 errors. |
| Direct `next build --webpack` | TypeScript completed in 30.0s; `.next/BUILD_ID` and `.next/server/app-paths-manifest.json` present. Tool output did not retain a final route-count line, so this is artifact-based completion evidence. |
| `git diff --check` | PASS after blocker source changes. |

### Disposable local SQL gate

The harness now preserves local `supabase start` stderr and its exit status.
Its shell regression test passes, including a fake-start failure that returns
status 9 and emits both child stderr and `Local Supabase start failed.`

`timeout 900 bash supabase/plan00-local/run-clean-reset.sh --full` still exits
**1** in the disposable local stack. The captured fresh-reset failure is:

```text
ERROR: column "brief_version" does not exist (SQLSTATE 42703)
create unique index if not exists customer_memory_briefs_link_version_unique
on public.customer_memory_briefs (link_id, brief_version)
```

`20260725100000_plan03_safe_personalization_projections.sql` creates a legacy
`customer_memory_briefs` table without `brief_version`. Historical migration
`20260726001000_personalization_foundation_contracts.sql` then uses `create
table if not exists`, which preserves that legacy shape, before it creates the
index above. A forward migration cannot run because reset stops at this earlier
migration; migration-history repair and harness-only injection would conceal
the invalid clean-install graph. A safe repair requires an explicitly approved,
broad historical contract upgrade for this and other legacy tables. No remote
database was contacted and no migration source was changed for this blocker.

### Browser and accessibility evidence

Safe-mode Chromium command:

```text
./node_modules/.bin/playwright test e2e/smoke-i18n.spec.ts e2e/product-navigation.spec.ts --project=chromium --workers=1
```

Focused locale/navigation Chromium gate passed **15/15**. A later combined
smoke, navigation, and tracker accessibility run had **16 passed, 1 failed**:
Vietnamese product navigation stayed on `/vi/products` after clicking
`article[data-product-card] a[data-product-image-frame]`. The selector is more
specific than the original generic link but still does not prove product-detail
navigation under the combined run, so it is not release evidence.

Root `src/app/layout.tsx` now awaits `next-intl/server` `getLocale()` and sets
`<html lang={locale}>`, while keeping root document ownership required by the
top-level 404 route. Root-layout unit coverage checks `vi`, `en`, and `ko`
language values. The document-language failures are cleared; product-detail
browser navigation still needs a deterministic fixture or canonical navigation
contract before release.

## Required follow-up before release

1. Approve and execute a broad historical migration-contract upgrade, then
   rerun the disposable full SQL gate.
2. Repair the Vietnamese product-detail navigation E2E contract and rerun the
   combined accessibility browser suite.
3. Run authenticated E2E, visual/Percy, external Sandbox proofs, and release
   acceptance mapping only after their required credentials and approvals.

## Feature flags, rollback, and release status

Safe defaults remain `AUTH_PROVIDER=supabase`, `PAYMENT_MODE=off`, and
`CHAT_ENABLED=false`; vision remains off for this evidence run. Provider
activation requires separate approved credentials and contract proof.

Rollback is bounded to the integration merge/follow-up commits above. Any
approved shared schema reversal must use a new forward migration, never edit a
historical migration.

**Readiness: local merge complete; release not ready.** All five lane branches
are integrated locally; unit/type/lint/build pass and document-language browser
coverage passes. Fresh local SQL reset remains non-zero because historical
migration contracts cannot safely upgrade pre-existing Plan03 schemas without
wider authorization. Combined browser accessibility coverage also retains one
Vietnamese product-detail navigation failure. Production remains untouched;
there was no staging push pending these repairs and explicit release
authorization.
