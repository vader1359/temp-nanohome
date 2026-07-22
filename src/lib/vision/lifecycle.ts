import { z } from "zod";

const ownerIdSchema = z.string().min(1).regex(/^[a-z0-9-]+$/);
const sceneIdSchema = z.string().min(1).regex(/^[a-z0-9-]+$/);
const uploadPathSchema = z.string().regex(/^vision\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9._-]+$/);
const uploadMimeTypeSchema = z.union([
  z.literal("image/jpeg"),
  z.literal("image/png"),
  z.literal("image/webp"),
]);
const sizeBytesSchema = z.number().int().nonnegative().max(10_485_760);

const createUploadIntentSchema = z.object({
  ownerId: ownerIdSchema,
  sceneId: sceneIdSchema,
  fileName: z.string().min(1),
  mimeType: uploadMimeTypeSchema,
  sizeBytes: sizeBytesSchema,
}).strict();

const validateUploadIntentSchema = z.object({
  ownerId: ownerIdSchema,
  path: uploadPathSchema,
  mimeType: z.string(),
  sizeBytes: z.number(),
}).strict();

const lifecycleStateSchema = z.enum([
  "awaiting_upload",
  "uploaded",
  "normalizing",
  "analyzing",
  "ready",
  "low_confidence",
  "failed",
  "deleting",
  "deleted",
  "expired",
]);

const lifecycleEventSchema = z.enum([
  "upload",
  "normalize",
  "analyze",
  "succeed",
  "low_confidence",
  "fail",
  "delete",
  "deleted",
  "expire",
]);

const lifecycleTransitionSchema = z.object({
  current: lifecycleStateSchema,
  event: lifecycleEventSchema,
}).strict();

export type LifecycleState = z.infer<typeof lifecycleStateSchema>;

const correctionSchema = z.object({
  ownerId: ownerIdSchema,
  sceneOwnerId: ownerIdSchema,
  field: z.string().min(1),
  value: z.unknown(),
}).strict();

const deletionScopeSchema = z.object({
  ownerId: ownerIdSchema,
  sceneId: sceneIdSchema,
}).strict();

export type UploadIntentResult =
  | Readonly<{ kind: "accepted"; path: string }>
  | Readonly<{ kind: "rejected"; reasonCode: "invalid_upload_intent" }>;

export type UploadValidationResult =
  | Readonly<{ kind: "valid" }>
  | Readonly<{ kind: "rejected"; reasonCode: "owner_path_mismatch" | "unsupported_mime_type" | "file_too_large" | "invalid_upload_intent" }>;

export type LifecycleTransitionResult =
  | Readonly<{ kind: "valid"; state: LifecycleState }>
  | Readonly<{ kind: "invalid_transition" }>;

export type FailureCode = "provider_unavailable" | "analysis_failed";
export type FailureResult = Readonly<{ code: FailureCode }>;

export type CustomerCorrectionResult =
  | Readonly<{ kind: "accepted"; field: string; value: number }>
  | Readonly<{ kind: "rejected"; reasonCode: "owner_mismatch" | "field_not_customer_editable" | "invalid_measurement" }>;

export type DeletionScope = Readonly<{
  ownerId: string;
  sceneIds: readonly string[];
  delete: readonly ["room_images", "room_scenes", "room_analysis_jobs"];
  exclude: readonly ["catalog_embeddings", "orders"];
}>;

export const createUploadIntent = (input: unknown): UploadIntentResult => {
  const parsed = createUploadIntentSchema.safeParse(input);
  if (!parsed.success) return { kind: "rejected", reasonCode: "invalid_upload_intent" };

  return { kind: "accepted", path: `vision/${parsed.data.ownerId}/${parsed.data.sceneId}/upload` };
};

export const validateUploadIntent = (input: unknown): UploadValidationResult => {
  const parsed = validateUploadIntentSchema.safeParse(input);
  if (!parsed.success) {
    const candidate = z.object({ ownerId: ownerIdSchema, path: z.string() }).safeParse(input);
    if (candidate.success && !candidate.data.path.startsWith(`vision/${candidate.data.ownerId}/`)) {
      return { kind: "rejected", reasonCode: "owner_path_mismatch" };
    }
    return { kind: "rejected", reasonCode: "invalid_upload_intent" };
  }
  if (!parsed.data.path.startsWith(`vision/${parsed.data.ownerId}/`)) return { kind: "rejected", reasonCode: "owner_path_mismatch" };
  if (!uploadMimeTypeSchema.safeParse(parsed.data.mimeType).success) return { kind: "rejected", reasonCode: "unsupported_mime_type" };
  if (!sizeBytesSchema.safeParse(parsed.data.sizeBytes).success) return { kind: "rejected", reasonCode: "file_too_large" };
  return { kind: "valid" };
};

export const transitionLifecycle = (input: unknown): LifecycleTransitionResult => {
  const parsed = lifecycleTransitionSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid_transition" };

  const transition = `${parsed.data.current}:${parsed.data.event}`;
  switch (transition) {
    case "awaiting_upload:upload":
      return { kind: "valid", state: "uploaded" };
    case "uploaded:normalize":
      return { kind: "valid", state: "normalizing" };
    case "normalizing:analyze":
      return { kind: "valid", state: "analyzing" };
    case "analyzing:succeed":
      return { kind: "valid", state: "ready" };
    case "analyzing:low_confidence":
      return { kind: "valid", state: "low_confidence" };
    case "analyzing:fail":
      return { kind: "valid", state: "failed" };
    case "awaiting_upload:expire":
    case "uploaded:expire":
      return { kind: "valid", state: "expired" };
    case "awaiting_upload:delete":
    case "uploaded:delete":
    case "normalizing:delete":
    case "analyzing:delete":
    case "ready:delete":
    case "low_confidence:delete":
    case "failed:delete":
    case "expired:delete":
      return { kind: "valid", state: "deleting" };
    case "deleting:deleted":
      return { kind: "valid", state: "deleted" };
    default:
      return { kind: "invalid_transition" };
  }
};

export const redactFailure = (input: unknown): FailureResult => {
  const parsed = z.object({ code: z.string() }).passthrough().safeParse(input);
  if (!parsed.success) return { code: "analysis_failed" };

  return parsed.data.code === "provider_timeout" ? { code: "provider_unavailable" } : { code: "analysis_failed" };
};

export const applyCustomerCorrection = (input: unknown): CustomerCorrectionResult => {
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { kind: "rejected", reasonCode: "field_not_customer_editable" };
  if (parsed.data.ownerId !== parsed.data.sceneOwnerId) return { kind: "rejected", reasonCode: "owner_mismatch" };
  if (!/^measurements\.[a-z][a-z0-9_]*$/.test(parsed.data.field)) return { kind: "rejected", reasonCode: "field_not_customer_editable" };
  if (typeof parsed.data.value !== "number" || !Number.isFinite(parsed.data.value)) return { kind: "rejected", reasonCode: "invalid_measurement" };
  return { kind: "accepted", field: parsed.data.field, value: parsed.data.value };
};

export const deletionScope = (input: unknown): DeletionScope | null => {
  const parsed = deletionScopeSchema.safeParse(input);
  if (!parsed.success) return null;

  return {
    ownerId: parsed.data.ownerId,
    sceneIds: [parsed.data.sceneId],
    delete: ["room_images", "room_scenes", "room_analysis_jobs"],
    exclude: ["catalog_embeddings", "orders"],
  };
};
