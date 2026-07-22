# Plan 08 Conflict Matrix — Integrated Local Staging

Status terms:

- **MERGED_LOCAL**: committed implementation is present and can be checked locally.
- **FUNCTIONAL_LOCAL**: mounted in the current website and covered by local validation.
- **BLOCKED_EXTERNAL**: code may exist, but credentials, remote state, provider, or approval evidence is missing.
- **DEFERRED**: deliberately outside this merge.

| Area | Status | Resolution / remaining gate |
| --- | --- | --- |
| Plan 00–08 branch graph | MERGED_LOCAL | All selected heads are ancestors of `codex/ai-commerce-staging`; Plan 02 uses v3 `cd158cca`, not obsolete v2 |
| `src/lib/contracts/ports.ts` | MERGED_LOCAL | Kept the canonical Plan 03 space-formatted `CustomerMemoryPort`; API was semantically identical |
| `supabase/plan00-local/run-clean-reset.sh` | MERGED_LOCAL | Combined both `vision_persistence_test.sql` and `plan07_customer_personalization_test.sql` |
| Migration versions | MERGED_LOCAL | Program filenames are unique and monotonic by reserved range; no remote application is claimed |
| PDP recommendations | FUNCTIONAL_LOCAL | Deterministic recommendations are mounted in the existing product-detail page |
| Commerce/cart/order/payment | MERGED_LOCAL | Routes and adapters exist, but auth/catalog/Supabase holds/AMIS/ZaloPay callback and UI composition remain BLOCKED_EXTERNAL |
| AMIS customer memory | MERGED_LOCAL | Bounded port exists; tenant-backed reader/sync/repository remains BLOCKED_EXTERNAL |
| Grounded chat | MERGED_LOCAL | Route/provider contracts exist; launcher, real grounding adapters, persistence, and credentials remain BLOCKED_EXTERNAL |
| Vision intelligence | MERGED_LOCAL | Contracts and synthetic provider exist; upload, storage, worker, embeddings/model, retention proof remain BLOCKED_EXTERNAL |
| Personalization | MERGED_LOCAL | Resolver/components exist and default off; provider mount, consent/event repositories, i18n, and live memory adapter are DEFERRED/BLOCKED_EXTERNAL |
| Generated Supabase types | DEFERRED | Regenerate only after the merged migration chain is validated against an approved database |
| Production rollout | BLOCKED_EXTERNAL | Requires reviewed credentials, remote SQL/RLS, provider and tenant evidence, monitoring, rollback, and deployment approval |

No local pass may be promoted into a claim that a provider, tenant, payment callback, remote database, or production rollout was verified.
