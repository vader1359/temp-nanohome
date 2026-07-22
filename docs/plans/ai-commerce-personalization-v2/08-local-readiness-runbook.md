# Plan 08 Local Staging Validation Runbook

## Scope

Use this runbook only in `/home/iant1359/develop/temp-nanohome-ai-commerce-staging` on branch `codex/ai-commerce-staging`. It validates the merged local website without changing `main` or any external system.

## Preflight

1. Confirm the worktree owner can read/write it and `.env.local` is mode `600`.
2. Confirm Node, Corepack, and pnpm run from the configured NVM environment.
3. Install exactly the lockfile with `corepack pnpm install --frozen-lockfile`.
4. Print only environment variable names and set/missing state; never print secret values.
5. Keep provider/payment/AMIS/vision/personalization flags off unless their approved staging credentials and remote dependencies exist.

## Local validation sequence

```bash
corepack pnpm run test:plan08-readiness-guard
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm run test:ui-merge-guard
corepack pnpm run lint
corepack pnpm run build
git diff --check
```

After a successful build, start the production server on a non-production local port and verify an HTTP 200 response for at least `/vi`, `/en`, and `/ko`. Stop the server after the smoke check.

## Database validation

The merged program migrations and SQL tests are present, but a database reset is not part of the safe default sequence. When Docker/Supabase is available and database mutation is explicitly approved, extend the harness to run the Plan 01 customer-data, Plan 02 checkout-ledger, Plan 03 memory, Plan 04 chat, Plan 06 vision, and Plan 07 personalization suites together.

## Stop conditions

Stop activation if any integrated guard, test, typecheck, build, or smoke check fails. Also stop if a feature lacks a default-off boundary, a secret would cross into a `NEXT_PUBLIC_` variable, migration history collides, or an external capability has no approved evidence.

## Safety boundary

**No remote mutation.** Do not push, deploy, enable production, apply remote migrations, call real AMIS/ZaloPay/provider endpoints, or turn on live flags as part of this runbook.
