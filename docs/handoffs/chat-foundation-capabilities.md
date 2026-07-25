# Chat-to-Foundation capability handoff

## Ownership

| Area | Chat lane | Foundation |
| --- | --- | --- |
| Public UI and localized unavailable states | Owns | — |
| Contract validation and default-off gates | Owns | — |
| Migrations, RLS, retention, deletion, export | — | Owns |
| Storage, upload signing, malware/media validation | — | Owns |
| Provider credentials, observability, rate limits | — | Owns |
| Production capability activation | — | Owns |

## Current contracts

- `src/lib/chat/capabilities.ts` provides strict, opaque-reference-only schemas for conversation persistence, Advisor handoff lifecycle, attachment descriptors, and visual-analysis envelopes.
- `chatCapabilityRegistry` is immutable and all four capabilities are `false`.
- `createDisabledChatCapabilityAdapter()` returns only `{ kind: "capability_unavailable" }`; it performs no provider, storage, database, or network operation.
- Vision scene semantics remain centralized in `src/lib/vision/contracts.ts`; Chat does not duplicate or infer room facts.

## Activation prerequisites

Foundation must complete each capability's migration and RLS review, implement a server-only adapter, provision secrets outside source control, approve consent and retention/deletion behavior, enforce media limits/scanning and signed uploads, add audit logging and rate limits, and extend contract tests before enabling a flag.

## Opaque payload examples

```json
{ "conversationRef": "conversation_01", "messageRef": "message_01" }
```

```json
{ "handoffRef": "handoff_01", "reasonCode": "staff_confirmation_required" }
```

```json
{ "attachmentRef": "attachment_01", "mediaKind": "image", "displayName": "living-room.webp", "state": "pending" }
```

```json
{ "attachmentRef": "attachment_01", "sceneRef": "scene_01", "state": "disabled" }
```

## Explicitly blocked

This lane does not add durable transcript storage, handoff ticket/status persistence, attachment uploads or lifecycle, real vision inference/vector retrieval, shared migrations, environment configuration, or production activation.
