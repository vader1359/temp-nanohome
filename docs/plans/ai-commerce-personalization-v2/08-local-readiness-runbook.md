# Plan 08 Local Readiness Runbook

## Purpose and status

This procedure evaluates documentation and static local artifacts only. Current status is **BLOCKED**: the worktree is Foundation SHA `d56244fd9a7a8cc3e690bd9221ecd51be8d20cb3`, Plan 02 has a complete local v3 receipt but cross-lane and external gates remain unperformed. It does not integrate feature code.

## Preflight

1. Preserve unrelated working changes in `entities.json`, `mempalace.yaml`, and `.omo/run-continuation/**`; inspect and stage only scoped Plan 08 paths.
2. Confirm the base is the Foundation receipt; do not merge, cherry-pick, rebase, or copy from feature branches.
3. Confirm all intended flags remain **default off** and all credentials remain server-only categories.

## Local static readiness sequence

Run only these local checks, recording each result as PASS, known existing failure, or unavailable:

```bash
npm run test:plan08-readiness-guard
npm test
npm run lint
npm run test:ui-merge-guard
npx tsc --noEmit
npm run build
git diff --check
git status --short
```

A passing local check is not E2E completion, remote migration proof, sandbox verification, tenant proof, privacy approval, backup proof, deployment, or production enablement.

## Stop conditions

Stop and leave the outcome **BLOCKED** when any of the following occurs:

- The canonical Plan 02 v3 receipt is absent or vague; the local receipt is complete, but cross-lane compatibility and external AMIS/ZaloPay proof remain blocked.
- A receipt SHA provenance mismatch has no authoritative receipt.
- A migration collision, altered applied migration, or contract/fixture incompatibility appears.
- A flag lacks a default-off state, a secret crosses a public boundary, or a shared-file request has no owner.
- Any external gate is represented as passed without evidence.

## Prohibited actions

Do not run test E2E/browser/sandbox flows, Supabase resets or remote/local database mutations, provider HTTP calls, AMIS or ZaloPay calls, deployment, push, production flag changes, or commands that use secrets. Do not claim those actions occurred.

## Future-only proof gates

A reviewed future integration lane still needs: two clean resets, a restored-clone forward migration, SQL/RLS suites, provider/tenant/sandbox approval, backup and recovery evidence, observability and runbook drills, privacy approval, and default-off rollout canaries. Until then the outcome remains **BLOCKED**.
