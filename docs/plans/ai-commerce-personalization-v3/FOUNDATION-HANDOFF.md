# Foundation Lane Handoff — Identity, Provider Contracts, and Local Proof

## Commit boundary

- Dependency base: `8e8c962` (`docs: consolidate AI commerce v3 execution plan`).
- Foundation commits:
  - `ee03f61` `feat(db): add internal customer account identity spine`
  - `44b5379` `feat(contracts): add provider-neutral payment port`
  - `8127826` `feat(env): validate provider modes conditionally`
  - `6ea4fd7` `docs(env): document safe provider defaults`
- This handoff records the two pending bounded commits: server-only account-session contract and local-only harness lifecycle.

## Delivered Foundation contracts

| Area | Delivered | Integration rule |
| --- | --- | --- |
| Account identity | Additive internal `customer_accounts` mapping and Firebase-principal schema; resolver ignores browser-provided account IDs and accepts mapped non-UUID subjects. | Existing legacy `auth.uid()` ownership remains until a dedicated per-domain account-ownership migration is reviewed and verified. |
| Session boundary | `src/lib/account-session.ts` defines server-only session-cookie, external-subject, and internal-account abstractions with no Supabase bearer-token field. | A Firebase session cookie must be verified server-side only; never forward it as a Supabase bearer token. |
| Payment port | `PaymentGateway` defines create/retrieve/cancel-unpaid/verify-notification results without installing a provider SDK or performing I/O. | Checkout owns adapter/orchestration adoption; do not treat browser payment input as verified evidence. |
| Environment | Safe defaults are `AUTH_PROVIDER=supabase`, `PAYMENT_MODE=off`, and `CHAT_ENABLED=false`; Firebase and SePay validation activates only in their enabled modes. | Keep external providers disabled until approved credentials and provider-specific integration proof exist. |
| Local pgTAP harness | The temporary workdir harness now starts and tears down its own local Supabase stack, then invokes only `--local` reset/lint/test commands. | Never pass `--linked` or a remote database URL; local Docker must be available before use. |

## Migrations and data safety

- Added forward-only migration: `20260724000000_foundation_customer_identity_accounts.sql`.
- No historical migration was changed.
- No live migration, remote schema query, deployment, provider activation, credential creation, or external service mutation was performed.
- `customer_identity_providers` defaults to empty, so no external JWT issuer is trusted until privileged provisioning explicitly configures one.
- `current_customer_account_id()` fails closed on malformed claims; it checks exact configured issuer/audience, authenticated role, active principal/account state, and does not trust a browser account claim.

## Verification evidence

### Passed

- `pnpm exec vitest run src/lib/account-session.test.ts`: **1 file, 3 tests passed**.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed with **18 pre-existing warnings**, no errors.
- `pnpm test`: **149 files, 927 tests passed**.
- `git diff --check`: passed.
- Shell syntax: `sh -n supabase/plan00-local/run-clean-reset.sh` passed.

### Local pgTAP blocker

The local-only harness was not run to SQL completion. Observed runtime evidence:

```text
supabase start --debug
failed to inspect service: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

```text
/var/run/docker.sock: No such file or directory
The command 'docker' could not be found in this WSL 2 distro.
We recommend to activate the WSL integration in Docker Desktop settings.
```

Docker Desktop reports a server from the Windows shim, but this WSL distro lacks Docker Desktop WSL integration. Enable the distro in Docker Desktop, then run exactly:

```sh
supabase/plan00-local/run-clean-reset.sh
```

The harness creates a temporary workdir, starts a local stack there, resets/lints/tests only that stack, stops it with `--no-backup`, and removes the temporary workdir. It never links to or targets a live project.

## Rollback

- Session/contract changes: revert their bounded commits.
- Local test database: the harness teardown removes the temporary local stack/data; no shared rollback action exists.
- Identity schema: if a later approved shared deployment requires reversal, use a separately reviewed additive forward migration; never edit/rename historical migrations.

## Remaining Foundation work

- Run the local pgTAP harness after WSL Docker integration is restored.
- Regenerate `src/types/database.types.ts` only after the local migration proof passes, using the repository's established local workflow; never hand-edit generated types.
- Add per-domain additive `account_id` ownership/backfill/RLS migrations for legacy carts, orders, profiles, AMIS, chat, and vision tables. Those ownership cutovers are intentionally not included in this bounded identity slice.
