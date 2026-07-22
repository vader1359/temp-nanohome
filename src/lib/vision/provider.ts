import { createSyntheticRoomSceneRecord } from "./fixtures";
import { redactFailure } from "./lifecycle";
import { parseProviderVisionOutput, validateVectorCompatibility } from "./contracts";
import type { FailureCode } from "./lifecycle";
import type { RoomSceneRecord, VectorCompatibility } from "./contracts";

const syntheticVector = [0.125, 0.25, 0.5] as const;
const syntheticModel = {
  provider: "synthetic",
  modelId: "fixture-vector",
  version: "1",
  dimensions: 3,
} as const satisfies VectorCompatibility;

export type SyntheticVisionFixture = "ready" | "low_confidence" | "provider_failure" | "malformed";

export type VisionProviderRequest = Readonly<{
  objectReference: string;
  fixture: SyntheticVisionFixture;
}>;

export type VisionProviderOutcome =
  | Readonly<{
      kind: "ready";
      record: RoomSceneRecord;
      vector: readonly number[];
      model: VectorCompatibility;
    }>
  | Readonly<{ kind: "failed"; code: FailureCode }>;

export type RoomVisionProviderOutcome =
  | Readonly<{ kind: "ready"; record: RoomSceneRecord }>
  | Readonly<{ kind: "failed"; code: FailureCode }>;

export type ImageEmbeddingProviderOutcome =
  | Readonly<{ kind: "ready"; vector: readonly number[]; model: VectorCompatibility }>
  | Readonly<{ kind: "failed"; code: FailureCode }>;

export type RoomVisionProvider = Readonly<{
  analyzeRoom: (request: VisionProviderRequest) => RoomVisionProviderOutcome;
}>;

export type ImageEmbeddingProvider = Readonly<{
  embedImage: (request: VisionProviderRequest) => ImageEmbeddingProviderOutcome;
}>;

export type VisionProvider = Readonly<{
  analyze: (request: VisionProviderRequest) => VisionProviderOutcome;
}>;

const safeFailure = (code: string): Readonly<{ kind: "failed"; code: FailureCode }> => ({ kind: "failed", code: redactFailure({ code }).code });

export const createSyntheticRoomVisionProvider = (): RoomVisionProvider => ({
  analyzeRoom: ({ fixture }): RoomVisionProviderOutcome => {
    switch (fixture) {
      case "ready": {
        const record = createSyntheticRoomSceneRecord();
        const parsedOutput = parseProviderVisionOutput({
          roomType: record.roomType,
          styleTags: record.styleTags,
          palette: record.palette,
          materials: record.materials,
          detectedFurniture: record.detectedFurniture,
          measurements: { chairWidth: { value: 240, unit: "cm", confidence: 0.4 } },
          uncertainties: record.uncertainties,
        });
        switch (parsedOutput.kind) {
          case "invalid":
            return safeFailure("malformed_output");
          case "valid":
            return { kind: "ready", record };
        }
      }
      case "low_confidence":
        return safeFailure("low_confidence");
      case "provider_failure":
        return safeFailure("provider_timeout");
      case "malformed": {
        const parsedOutput = parseProviderVisionOutput({ malformed: "raw provider detail" });
        switch (parsedOutput.kind) {
          case "invalid":
            return safeFailure("malformed_output");
          case "valid":
            return safeFailure("analysis_failed");
        }
      }
    }
  },
});

export const createSyntheticImageEmbeddingProvider = (): ImageEmbeddingProvider => ({
  embedImage: ({ fixture }): ImageEmbeddingProviderOutcome => {
    switch (fixture) {
      case "ready": {
        const vector = validateVectorCompatibility(syntheticVector, syntheticModel, syntheticModel);
        switch (vector.kind) {
          case "invalid":
            return safeFailure("malformed_output");
          case "valid":
            return { kind: "ready", vector: vector.vector, model: syntheticModel };
        }
      }
      case "low_confidence":
        return safeFailure("low_confidence");
      case "provider_failure":
        return safeFailure("provider_timeout");
      case "malformed":
        return safeFailure("malformed_output");
    }
  },
});

export const createSyntheticVisionProvider = (): VisionProvider => {
  const roomVision = createSyntheticRoomVisionProvider();
  const imageEmbedding = createSyntheticImageEmbeddingProvider();

  return {
    analyze: (request): VisionProviderOutcome => {
      const roomOutcome = roomVision.analyzeRoom(request);
      switch (roomOutcome.kind) {
        case "failed":
          return roomOutcome;
        case "ready": {
          const embeddingOutcome = imageEmbedding.embedImage(request);
          switch (embeddingOutcome.kind) {
            case "failed":
              return embeddingOutcome;
            case "ready":
              return { kind: "ready", record: roomOutcome.record, vector: embeddingOutcome.vector, model: embeddingOutcome.model };
          }
        }
      }
    },
  };
};
