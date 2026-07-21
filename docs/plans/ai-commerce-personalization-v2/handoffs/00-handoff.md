# Plan 00 Handoff — Program Base and Contracts

## Commit boundary

- Base plan commit: `b72872fceb4adf1342c816ef6b83e7096241f56c`
- Base branch merge point: `e920ab95b73cc80cac971e8ed7fb1afff1866db7` (`origin/main`)
- Program Base SHA: emitted as `HEAD` in the delivery receipt after the Plan 00-only local commit. A Git commit cannot contain its own content-addressed SHA without changing that SHA.
- Scope: canonical catalog eligibility, frozen framework-neutral contracts, local-only clean-reset recovery, and evidence documentation. No Plan 01–08 implementation is included.

## Ownership

| Artifact | Owner | Handoff rule |
| --- | --- | --- |
| `public.catalog_eligibility` | Plan 00 | Consume its flags/reason codes; do not copy approval, validation, stock, media, or price rules. |
| `src/lib/catalog/eligibility.ts` | Plan 00 | Parse database rows through this boundary; do not depend on generated DB types. |
| `src/lib/contracts/*` | Plan 00 | Frozen public DTOs and ports. Additions require integration review. |
| `supabase/plan00-local/*` | Plan 00 | Ephemeral local recovery only; never use against a linked/shared database. |
| generated DB types, global providers, env, messages, lockfile | Plan 08 | Not modified by Plan 00. |

## Migration ranges and paths

- Historical duplicates retained, untouched: `20260710000003_*` and `20260711000000_*`.
- Plan 00 forward migration: `20260721010000_plan00_catalog_eligibility.sql`.
- Reserved future prefixes: Plan 01 `2026072102xxxx`; Plan 02 `2026072103xxxx`; Plan 03 `2026072104xxxx`; Plan 04 `2026072105xxxx`; Plan 05 `2026072106xxxx`; Plan 06 `2026072107xxxx`; Plan 07 `2026072108xxxx`; Plan 08 `2026072109xxxx`.
- Clean reset: run `supabase/plan00-local/run-clean-reset.sh` only. It rejects arguments, creates a temporary Supabase workdir, uses `db reset --local --no-seed`, and deletes its temporary workdir on exit.
- Existing-environment forward: do not reset or bootstrap. Apply only additive forward migrations after the external evidence gate below.

## Local evidence

- Native tracked-chain local reset failed before Plan 00 recovery: `relation "public.variants" does not exist (SQLSTATE 42P01)`.
- Historical commit `c680c8f1dfa4bc9e490d90fcdd39bd97459e5d17` contained the missing catalog baseline but also renamed colliding migrations; Plan 00 does not reuse that unsafe shared-history strategy.
- The local harness reset and pgTAP test passed after inserting the baseline into an isolated temporary workdir.
- Targeted TypeScript tests and no-excuse check are recorded in the final verification section of this handoff after the commit.

## External proof blocker — required before shared deployment

No remote schema, migration ledger, deployment, or configuration was queried or changed by Plan 00. A staging/production operator must attach all of the following before applying `20260721010000_plan00_catalog_eligibility.sql`:

1. project ref, environment name, owner, approver identity, and UTC timestamp;
2. read-only applied-migration ledger export with versions and checksums;
3. catalog/commerce schema fingerprint for tables, columns, functions, policies, and grants;
4. approved backup/recovery point;
5. comparison to the committed migration inventory and `PROGRAM_BASE_SHA`;
6. discrepancy resolution that uses an additive forward repair, never a historical migration rename/edit.

Absent this bundle, shared deployment is blocked.

## Rollback

- Do not roll back by editing or renaming historical migrations.
- For local development, discard the ephemeral database and rerun the local harness.
- For a shared environment after an approved forward migration, deploy a separately reviewed, additive migration that replaces/drops only the Plan 00 eligibility view if necessary; retain source catalog tables and historical migration history.

## Downstream adoption

Plans 02–08 must consume `CatalogEligibility` for eligibility decisions. Plan 01 may use frozen customer-context contracts but must not add providers. Plan 08 alone may regenerate `src/types/database.types.ts` and reconcile integration ownership.
