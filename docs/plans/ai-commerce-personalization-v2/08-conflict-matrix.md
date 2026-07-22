# Plan 08 Conflict Matrix — Local Integration Readiness

All rows are local static decisions on Foundation SHA only. Default state is **default off**; no row indicates integrated, merged, validated remotely, or safe to enable.

| Area | Canonical owner | Requesting plans | Required source evidence | Local static decision | Blocking condition | Feature-default state | Future integration owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Migration ordering and immutable history | Plan 00 foundation | 01–08 | Receipt ranges, unique versions, no applied-migration edits, forward-repair policy | READY FOR FUTURE REVIEW | Collision, non-monotonic range, or missing ledger | Default off | Reviewed integration lane |
| Frozen contracts and fixtures: `CatalogEligibility`, customer contexts, commerce snapshot/references, `CustomerMemory`, recommendation request/response, `RoomScene`, visual similarity, `ChatAnswer` | Respective receipt owner | 00–07 | Versioned contract/fixture receipt and compatibility review | BLOCKED | Plan 02 local contract receipt is documented; cross-lane compatibility is not reviewed | Default off | Contract owners plus integration lane |
| AMIS exact capabilities | Plan 01 capability policy / Plan 03 port / Plan 02 v3 receipt | 02, 03, 07 | Catalog/stock GET; exact SaleOrder POST/lookup GET boundary; customer memory read-only GET; wildcard mutation denied | BLOCKED | Plan 02 local capability boundary is documented; AMIS tenant and remote authorization evidence remains incomplete | Default off | AMIS owner after tenant approval |
| Feature flags: identity/events/consent, commerce/AMIS/ZaloPay/refund, memory, chat/storage/tools, recommendation signals, vision/retention, personalization | Future shared configuration owner | 01–07 | Explicit ownership, default-off state, server/client boundary | READY FOR FUTURE REVIEW | A flag lacks default-off state or owner | Default off | Reviewed integration lane |
| Environment schema and server/client exposure | Future server config owner | 03, 04, 06, 07 | Server-only category inventory and no public secret exposure | BLOCKED | Credential boundary or provider configuration unreviewed | Default off | Security/config owner |
| i18n: Vietnamese, English, Korean | Shared localization owner | 04, 07 | Key inventory and future missing-key tests; no runtime model-authored UI copy | DEFERRED | Keys and UI surface not implemented in this local lane | Default off | Localization owner |
| Global providers/layouts and server/client boundaries | Shared application shell owner | 00, 04, 07 | Reviewed provider/layout ownership and hydration boundaries | DEFERRED | No feature code transfer on Foundation-only base | Default off | Application shell owner |
| Canonical product-card mapper | Commerce presentation owner | 02, 04, 05, 07 | Locale/tracking/price/stock/media/link consistency contract | BLOCKED | Plan 02 local commerce receipt is complete; feature-code transfer and integration/UI work remain out of scope | Default off | Commerce UI owner |
| Generated types, packages/lockfile, schedules/queues/buckets, RLS/grants/retention/deletion jobs | Platform/data owners | 00, 01, 03, 04, 06, 07 | Generated type source, package review, schedule ownership, SQL/RLS/retention suite | BLOCKED | No reviewed integration base or local SQL proof | Default off | Platform/data integration owners |
| Evidence, runbooks, metrics, alerts, owners, rollback, external proof gates | Plan 08 readiness owner | 00–07 | Handoff receipts, local command output, named external gates, feature fallback | READY FOR FUTURE REVIEW | Remote, privacy, backup, provider, tenant, sandbox, or rollout proof absent | Default off | Future rollout owner |

## Resolution rules

- **READY FOR FUTURE REVIEW:** explicit evidence and default-off configuration are documented; implementation remains outside this lane.
- **BLOCKED:** evidence is absent, vague, conflicting, or external to the local Plan 08 scope.
- **DEFERRED:** a contract deliberately excludes the behavior.

A future integration review must stop on any unresolved BLOCKED row. It may not turn local static evidence into remote proof or enable a feature by default.
