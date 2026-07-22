import { z } from "zod";

const finiteNumber = z.number().finite();

export const observedValueSchema = z.object({
  value: finiteNumber,
  unit: z.string().min(1),
  source: z.union([z.literal("vision"), z.literal("customer_override")]),
  confidence: finiteNumber.min(0).max(1),
}).strict();

export const roomSceneRecordSchema = z.object({
  sceneId: z.string().min(1),
  roomType: z.string().min(1).nullable(),
  styleTags: z.array(z.string().min(1)),
  palette: z.array(z.string().min(1)),
  materials: z.array(z.string().min(1)),
  detectedFurniture: z.array(z.string().min(1)),
  measurements: z.record(observedValueSchema),
  uncertainties: z.array(z.string().min(1)),
  analyzedAt: z.string().datetime({ offset: true }),
  provider: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
}).strict();

export const providerVisionOutputSchema = z.object({
  roomType: z.string().min(1).nullable(),
  styleTags: z.array(z.string().min(1)),
  palette: z.array(z.string().min(1)),
  materials: z.array(z.string().min(1)),
  detectedFurniture: z.array(z.string().min(1)),
  measurements: z.record(z.object({ value: finiteNumber, unit: z.string().min(1), confidence: finiteNumber.min(0).max(1) }).strict()),
  uncertainties: z.array(z.string().min(1)),
}).strict();

export const visualCandidateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), variantId: z.string().min(1), score: finiteNumber.min(0).max(1) }).strict(),
  z.object({ kind: z.literal("external_reference"), referenceId: z.string().min(1), score: finiteNumber.min(0).max(1) }).strict(),
]);

export type ObservedValue = Readonly<z.infer<typeof observedValueSchema>>;
export type RoomSceneRecord = Readonly<z.infer<typeof roomSceneRecordSchema>>;
export type ProviderVisionOutput = Readonly<z.infer<typeof providerVisionOutputSchema>>;
export type VisualCandidate = Readonly<z.infer<typeof visualCandidateSchema>>;

export type ProviderParseResult =
  | Readonly<{ kind: "valid"; value: ProviderVisionOutput }>
  | Readonly<{ kind: "invalid" }>;

export type VectorCompatibility = Readonly<{ provider?: string; dimensions: number; modelId: string; version?: string }>;
export type VectorRejectionReason = "provider_mismatch" | "model_mismatch" | "version_mismatch" | "dimension_mismatch" | "non_finite";
export type VectorValidationResult =
   | Readonly<{ kind: "valid"; vector: readonly number[] }>
  | Readonly<{ kind: "invalid"; reason: VectorRejectionReason }>;
export type MeasurementOverrideResult =
  | Readonly<{ kind: "valid"; value: ObservedValue }>
  | Readonly<{ kind: "invalid" }>;

export const parseProviderVisionOutput = (input: unknown): ProviderParseResult => {
  const result = providerVisionOutputSchema.safeParse(input);
  return result.success ? { kind: "valid", value: result.data } : { kind: "invalid" };
};

export const validateVectorCompatibility = (vector: readonly number[], compatibility: VectorCompatibility, actual?: VectorCompatibility): VectorValidationResult => {
  if (actual?.provider !== undefined && compatibility.provider !== actual.provider) return { kind: "invalid", reason: "provider_mismatch" };
  if (actual?.modelId !== undefined && compatibility.modelId !== actual.modelId) return { kind: "invalid", reason: "model_mismatch" };
  if (actual?.version !== undefined && compatibility.version !== actual.version) return { kind: "invalid", reason: "version_mismatch" };
  if (vector.length !== compatibility.dimensions || (actual !== undefined && actual.dimensions !== compatibility.dimensions)) return { kind: "invalid", reason: "dimension_mismatch" };
  if (!vector.every(Number.isFinite)) return { kind: "invalid", reason: "non_finite" };
  return { kind: "valid", vector };
};

export const measurementWithOverride = (observed: ObservedValue, value: number): MeasurementOverrideResult => {
  if (!Number.isFinite(value)) return { kind: "invalid" };
  return { kind: "valid", value: { ...observed, value, source: "customer_override", confidence: 1 } };
};
