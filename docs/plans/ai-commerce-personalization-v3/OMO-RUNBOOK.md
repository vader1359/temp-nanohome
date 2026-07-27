# nanoHome AI Commerce v3 — OMO/WSL Runbook

This runbook coordinates implementation in the Windows WSL Ubuntu repository
without touching its existing dirty root worktree or tmux session `0`.

## 1. Topology

- WSL repository: `/home/iant1359/develop/temp-nanohome`
- Dedicated tmux session: `nanohome-ulw`
- Every lane uses a sibling clean worktree.
- Every worktree is created from the same pushed execution-base SHA.
- Existing WSL worktrees, untracked artifacts, tmux session `0`, and local
  changes are preserved.

| Window | Worktree suffix | Branch |
| --- | --- | --- |
| `foundation` | `-ulw-foundation` | `codex/ai-commerce-foundation` |
| `chat` | `-ulw-chat` | `codex/ai-commerce-chat-advisor` |
| `checkout` | `-ulw-checkout` | `codex/ai-commerce-sepay` |
| `personalization` | `-ulw-personalization` | `codex/ai-commerce-amis-personalization` |
| `account` | `-ulw-account` | `codex/ai-commerce-account-firebase` |
| `integration` | `-ulw-integration` | `codex/ai-commerce-integration` |

## 2. Environment handling

For local implementation only, the current WSL root `.env.local` may be copied
to each new worktree with mode `0600`. The copy command must not print values.
New variables remain absent until an owner supplies them through an approved
secret path.

OMO behavior when a variable is missing:

1. keep the provider/network feature disabled;
2. implement its interface, fake/noop adapter, fixtures, validation, and tests;
3. add only the variable name and safe placeholder to `.env.example` through
   the Foundation handoff;
4. record the owner action in the lane handoff;
5. never fabricate a credential or weaken verification to make a test pass.

## 3. Common ULW prompt contract

Every OMO prompt starts with `ulw` and contains:

- lane, branch, worktree, source plan, and owned scope;
- instruction to read `AGENTS.md` and relevant files under
  `node_modules/next/dist/docs/` before writing Next.js code;
- instruction to inspect current code/tests before deciding file changes;
- instruction to preserve unrelated changes and never reset/delete user work;
- explicit prohibition on deploy, billing, console mutations, live DB
  migrations, production traffic, secret logging, or credential creation;
- safe defaults and fixture/fake behavior when external services are absent;
- targeted test commands and bounded commits;
- a handoff manifest containing commits, tests, deltas, flags, blockers, and
  rollback notes;
- instruction to continue independently until the lane's local definition of
  done is met.

## 4. Lane prompts

### Foundation

Read the master plan, all domain plans, and environment matrix. Implement Wave
1 shared foundations first: provider-neutral customer identity/session
contracts, forward-only schemas/RLS and fixtures, common payment/conversation/
handoff/attachment/AMIS projection/offer contracts, and conditional typed env
validation. Own migrations, generated DB types, `.env.example`, env schema,
lockfile, and schedules. Do not enable any external provider or apply a live
migration. Commit bounded working slices and provide the shared contract SHA
needed by sibling lanes.

### Chat

Read Plan 01 and the master plan. Implement the no-secret slice: shared
horizontal product/media carousel, tone contract/tests, managed-knowledge
interfaces, runtime conversation persistence/restore, handoff creation,
Advisor Inbox, outbox with noop/test notifier, and private attachment/vision
ports with fake provider. Do not change shared identity/payment migrations or
lockfile. Publish requested shared deltas rather than editing Foundation-owned
files. Never send raw CRM or transcript data to a notification.

### Checkout

Read Plan 02 and the master plan. Implement server-owned checkout and the pure
SePay bank-transfer port: request/signature/IPN schemas, constant-time
verification where applicable, state machine, idempotency, status,
reconciliation interface, cancellation, and audited refund intent. Keep
`PAYMENT_MODE=off`; do not contact SePay or AMIS and do not install an SDK until
contract tests justify it. Remove ZaloPay only from payment selection, not Zalo
OA/customer chat. Cover forged, duplicate, delayed, wrong-amount/reference,
cancel, timeout, and reconciliation fixtures.

### Personalization

Read Plan 03 and the master plan. Implement page-zero-safe AMIS read clients,
restricted snapshots/projection ports, purchased versus quoted/interested
semantics, deterministic recommendations, explanation codes, settings
behavior, and synthetic/redacted fixture tests. Keep sync, writes, and
customer-visible rollout disabled; never call the live tenant or expose raw CRM
fields. Do not own shared identity schema/env/lockfile.

### Account

Read Plan 04 and the master plan. Implement the responsive Account Center and
its no-secret UI slice: routes/layout/components/states, profile/orders/
wishlist/cart/offers/personalization/security functions, five login UX flows,
page-level tests, durable account feature controllers, guest-merge UX, and
revocation/deletion/unlink UX against Foundation-owned auth/session ports and
fakes. Do not edit the shared identity/session adapters or migrations. Do not
configure cloud consoles, export real users, cut over auth, or add secrets.
Publish shared env/migration/port deltas for Foundation.

### Integration

Read every plan. Initially perform a read-only baseline test/conflict inventory
and monitor lane handoffs. Do not invent feature code while Foundation is
pending. When the coordinator makes sibling commits available, merge
Foundation first, then Chat, Checkout, Personalization, and Account; reconcile
shared deltas once, run targeted tests after each merge, and finally run the
complete quality/security/E2E suite that the environment permits. Never deploy
or mutate external services.

## 5. Heartbeat operation

At each 15-minute heartbeat:

- capture session/window/pane health and the last relevant pane output;
- inspect each branch HEAD, ahead/behind count, dirty state, recent commits,
  running command, and test result;
- classify each lane as `working`, `testing`, `ready`, `waiting-foundation`,
  `waiting-owner`, `failed`, or `crashed`;
- calculate program progress from delivered acceptance slices, not token/output
  volume;
- answer safe code/domain questions and send a concise continuation message
  only to idle/waiting panes;
- never send keystrokes into a pane that is running a command or awaiting a
  user approval;
- restart only a genuinely exited/crashed pane using its original prompt and
  handoff state;
- report new commits, passed tests, conflicts, blockers, and next checkpoint.

If a lane needs a secret, the heartbeat checks presence only. It may use the
secure bridge to copy an existing `.env.local` without displaying contents. If
the value does not exist, the lane continues on fake/fixture work and the
missing owner action is reported.

## 6. Stop conditions

The implementation monitor continues until:

- all locally implementable acceptance criteria are merged and tested;
- every external-only criterion is represented by a disabled adapter, test
  fixture, runbook, and explicit owner action;
- no OMO lane has uncommitted implementation work;
- Integration has a final manifest and no unresolved shared delta.

Production deployment and live provider activation are a separate authorized
release operation.
