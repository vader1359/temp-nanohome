# nanoHome AI Commerce v3 — Environment Matrix

This is a names-and-ownership inventory. It intentionally contains no secret
values. Placeholders belong in `.env.example`; runtime values belong in the
deployment secret manager or a mode-`0600` local `.env.local`.

## 1. Rules

- `NEXT_PUBLIC_*` values are bundled into browser builds and must never contain
  server credentials.
- SePay, AMIS, vision, Advisor notification, Firebase Admin, Kakao Admin, and
  migration secrets are server/CLI only.
- Never copy secret values into issue text, OMO prompts, tmux commands, logs,
  screenshots, commits, or chat.
- Environment validation is conditional. The existing site must still build
  while new providers are disabled.
- A missing live credential blocks provider activation, not interface/schema/UI
  implementation with fakes and fixtures.
- Public Firebase SDK configuration must still be copied from the correct
  project; it must not be guessed.

## 2. Existing platform variables

| Variable | Exposure | Current | Source/owner | Used by |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | present locally | Supabase project settings | DB/Storage browser clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | present locally | Supabase project settings | DB/Storage browser clients |
| `SUPABASE_SERVICE_ROLE_KEY` | server secret | present locally | Supabase secret manager | server DAL/jobs/migration support |
| `CRON_SECRET` | server secret | present locally | deployment secret manager | scheduled endpoints |
| `DEEPSEEK_API_KEY` | server secret | present locally | DeepSeek console | chat text model |
| `AMIS_API_BASE_URL` | server config | present locally | MISA tenant/developer app | AMIS clients |
| `AMIS_CLIENT_ID` | server credential | present locally | MISA developer app | AMIS clients |
| `AMIS_CLIENT_SECRET` | server secret | present locally | MISA developer app | AMIS clients |

Other existing media/analytics variables remain outside this program and must
not be copied into its prompts. Their existing values are preserved.

Current schema drift to fix in Foundation:

- `CHAT_ENABLED` is read directly and should enter the typed env schema.
- `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` are in staging runtime code but absent
  from `.env.example`.
- all new provider variables below need conditional validation and safe
  defaults.

## 3. Chat, knowledge, vision, and Advisor

| Variable | Exposure | Default/requirement | Source | Activation |
| --- | --- | --- | --- | --- |
| `CHAT_ENABLED` | server config | `false` in an unconfigured env | deployment config | text chat |
| `DEEPSEEK_MODEL` | server config | approved model ID | DeepSeek/product | text chat |
| `DEEPSEEK_BASE_URL` | server config | official endpoint unless approved otherwise | DeepSeek | text chat |
| `PROMPT_VERSION` | server config | versioned contract, e.g. `public-advisor-v3` | application | prompt rollout |
| `CHAT_HANDOFF_ENABLED` | server config | `false` | operations | handoff |
| `ADVISOR_INBOX_ENABLED` | server config | `false` | operations | staff inbox |
| `ADVISOR_NOTIFICATION_PROVIDER` | server config | `noop` until selected | operations | notification delivery |
| `ADVISOR_NOTIFICATION_DESTINATION` | server sensitive config | absent until approved | operations | notification delivery |
| `ADVISOR_NOTIFICATION_API_KEY` | server secret | absent | provider secret manager | notification delivery |
| `VISION_PROVIDER` | server config | `fake` or `off` | provider decision | image analysis |
| `VISION_MODEL` | server config | absent until benchmarked | provider console | image analysis |
| `VISION_API_KEY` | server secret | absent | provider secret manager | image analysis |
| `VISION_PRIVATE_BUCKET` | server config | absent until storage selected | storage owner | private uploads |
| `VISION_UPLOAD_ENABLED` | server config | `false` | deployment config | customer upload |
| `ROOM_ANALYSIS_ENABLED` | server config | `false` | deployment config | scene extraction |
| `VISUAL_SIMILARITY_ENABLED` | server config | `false` | deployment config | visual retrieval |
| `VISION_RETENTION_DAYS` | server config | policy-approved bounded integer | privacy/operations | expiry job |
| `VISION_EVALUATION_STORAGE_ENABLED` | server config | `false` | privacy/product | benchmark corpus |

Provider, retention, cost ceiling, notification destination, staff RBAC, and SLA
remain external decisions. Do not finalize provider-specific variable names
until the provider contract is chosen; the names above are the application
port.

## 4. SePay

| Variable | Exposure | Default/requirement | Source | Activation |
| --- | --- | --- | --- | --- |
| `PAYMENT_MODE` | server config | `off`; allowed `off`, `sepay_sandbox`, `sepay_primary` | deployment config | payment creation |
| `SEPAY_ENV` | server config | `sandbox` before production | SePay merchant config | endpoint selection |
| `SEPAY_MERCHANT_ID` | server credential | absent | SePay dashboard | hosted checkout |
| `SEPAY_MERCHANT_SECRET` | server secret | absent | SePay dashboard/secret manager | request signing |
| `SEPAY_IPN_SECRET` | server secret | absent | SePay dashboard/secret manager | IPN verification |
| `SEPAY_PAYMENT_METHOD` | server config | `BANK_TRANSFER` | approved contract | hosted checkout |
| `SEPAY_SUCCESS_URL` | server config | exact HTTPS application URL | deployment domains | redirect UI |
| `SEPAY_ERROR_URL` | server config | exact HTTPS application URL | deployment domains | redirect UI |
| `SEPAY_CANCEL_URL` | server config | exact HTTPS application URL | deployment domains | redirect UI |
| `SEPAY_RECONCILIATION_ENABLED` | server config | `false` until API proof | operations | reconciliation job |

There must be no `NEXT_PUBLIC_SEPAY_*`. The browser receives a short-lived
server-created redirect only. Live activation additionally needs Sandbox
merchant access, bank-transfer entitlement, callback origins, HTTPS IPN,
signature samples, reconciliation limits, and the merchant refund procedure.

## 5. AMIS personalization and checkout

| Variable | Exposure | Default/requirement | Source | Activation |
| --- | --- | --- | --- | --- |
| `AMIS_API_BASE_URL` | server config | existing exact tenant API root | MISA tenant | all AMIS calls |
| `AMIS_CLIENT_ID` | server credential | existing | MISA developer app | all AMIS calls |
| `AMIS_CLIENT_SECRET` | server secret | existing | MISA developer app | all AMIS calls |
| `AMIS_COMPANY_CODE` | CLI/server config, conditional | not accepted as a runtime contract yet | tenant/export tool | only if verified |
| `AMIS_SYNC_ENABLED` | server config | `false` | deployment config | read sync |
| `AMIS_WRITES_ENABLED` | server config | `false` | deployment config | checkout writes |
| `AMIS_PERSONALIZATION_ENABLED` | server config | `false` | deployment config | customer memory |
| `RECOMMENDATIONS_SHADOW_MODE` | server config | `true` | deployment config | offline comparison |

Before activation, verify redacted Customers/Contacts/SaleOrders payloads,
page-zero pagination, stable IDs, exact `approved` field/value, customer
relation, deleted/merged semantics, modified cursor, line SKU, custom fields,
stock freshness, rate limits, and write idempotency.

## 6. Firebase/Identity Platform and Account Center

### Browser/build configuration

| Variable | Exposure | Requirement | Source |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ORIGIN` | public | canonical exact origin per environment | deployment/domain owner |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | public | required when Firebase path enabled | Firebase Web app SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | public | required; exact authorized auth domain | Firebase Web app SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | public | required | Firebase Web app SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | public | required | Firebase Web app SDK config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | public, optional | optional for Auth-only | Firebase Web app SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` | public, conditional | required only for approved App Check rollout | Firebase App Check |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` | public, dev-only | never set in production | local emulator |
| `NEXT_PUBLIC_FIREBASE_TENANT_ID` | public, conditional | only if multi-tenancy is explicitly selected | Identity Platform |

### Server configuration and credentials

| Variable | Exposure | Default/requirement | Source |
| --- | --- | --- | --- |
| `AUTH_PROVIDER` | server config | `supabase` before canary; `firebase` after cutover | deployment config |
| `ACCOUNT_CENTER_ENABLED` | server config | `false` before rollout | deployment config |
| `AUTH_FIREBASE_ROLLOUT_PERCENT` | server config | `0`, integer 0–100 | operations |
| `AUTH_LEGACY_LOGIN_ENABLED` | server config | `true` during overlap; eventually `false` | operations |
| `FIREBASE_ADMIN_PROJECT_ID` | server config | required for Admin SDK unless ADC derives it | Firebase project |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | server credential | credential mode B only | service account secret |
| `FIREBASE_ADMIN_PRIVATE_KEY` | server secret | credential mode B only | service account secret |
| `AUTH_SESSION_COOKIE_NAME` | server config | safe code default; production uses `__Host-...` | application/security |
| `AUTH_SESSION_TTL_SECONDS` | server config | bounded 300–1,209,600 | application/security |
| `FIREBASE_AUTH_EMULATOR_HOST` | server, dev-only | never set in production | local emulator |
| `AUTH_CSRF_SECRET` | server secret, conditional | only if signed/HMAC state design is selected | secret manager |

Use exactly one Admin credential mode:

1. preferred: workload identity/Application Default Credentials, normally with
   only `FIREBASE_ADMIN_PROJECT_ID`; or
2. non-Google hosting/local fallback: project ID, client email, and private key
   from the secret manager.

Cookie `Secure`, `HttpOnly`, `SameSite`, `Path=/`, and lack of `Domain` for
`__Host-` are code invariants, not configurable knobs.

### Kakao

| Variable | Exposure | Requirement | Source |
| --- | --- | --- | --- |
| `KAKAO_APP_ID` | server config | required for unlink/webhook proof | Kakao Developers |
| `KAKAO_ADMIN_KEY` | server secret | required for server unlink | Kakao secret manager |
| `KAKAO_REST_API_KEY` | server/CI credential | provider setup/fallback only | Kakao Developers |
| `KAKAO_CLIENT_SECRET` | server/CI secret | Identity Platform OIDC provider setup | Kakao Developers |

No `NEXT_PUBLIC_KAKAO_*` is used. OIDC issuer, discovery/JWKS URLs, provider ID
`oidc.kakao`, and callback path are constants/derived configuration.

### Migration-only

| Variable | Exposure | Requirement | Source |
| --- | --- | --- | --- |
| `SUPABASE_DB_URL` | CLI secret | privileged hash/identity export path | Supabase/DB owner |
| `SUPABASE_ACCESS_TOKEN` | CLI secret, conditional | linked CLI alternative | Supabase account |
| `AUTH_MIGRATION_ENCRYPTION_KEY` | CLI secret, alternative | temporary encrypted export | secret manager |
| `AUTH_MIGRATION_KMS_KEY_NAME` | CLI config, preferred alternative | Cloud KMS export protection | Cloud owner |
| `GOOGLE_APPLICATION_CREDENTIALS` | local/server path, conditional | file outside repo for ADC fallback | secret manager/local operator |

Choose KMS or the raw migration encryption key, not both. Batch size, dry-run,
input/output path, and manifest path are CLI arguments, not long-lived env.

Do not add `SUPABASE_JWT_SECRET`, Google OAuth client secrets, Firebase cookie
signing secrets, phone/Twilio secrets, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
or Kakao JavaScript keys for this design.

## 7. Conditional validation

- When `AUTH_PROVIDER=supabase`, missing Firebase fields must not break the
  existing build.
- When `AUTH_PROVIDER=firebase`, client project/auth fields and one valid Admin
  credential mode are required.
- Firebase Admin project ID, client project ID, and Supabase trusted Firebase
  project ID must match.
- When Kakao unlink/delete is enabled, `KAKAO_APP_ID` and `KAKAO_ADMIN_KEY` are
  required.
- When App Check enforcement is approved, the site key is required.
- When `PAYMENT_MODE=off`, SePay credentials are optional and no external
  payment may be created.
- When `PAYMENT_MODE=sepay_sandbox|sepay_primary`, all relevant SePay
  credentials/URLs are required.
- When vision or notification providers are `off|fake|noop`, their credentials
  are optional and network calls are forbidden.
- When AMIS flags are false, missing optional AMIS contracts do not block
  fixture-backed development.

## 8. Owner actions before live activation

- Firebase/Google Cloud owner access, project/environment strategy, billing,
  Identity Platform, Web app config, Admin credential mode, authorized domains,
  email sender/templates, SMS regions/budget, and App Check decision.
- Kakao app ownership, Login/OIDC, REST/client/admin keys, exact callback,
  scopes/legal URLs, unlink webhook, and branding approval.
- Supabase console access, exact Firebase third-party trust, and privileged
  encrypted user/identity export authorization.
- SePay Sandbox/production merchant access, IPN/signature contract, callback
  URLs, reconciliation API, and refund operations.
- AMIS tenant payload/semantics/rate-limit proof.
- Vision provider/privacy/storage/retention/cost selection.
- Advisor channel, staff RBAC, SLA, retention, and escalation ownership.
