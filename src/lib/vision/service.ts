import type { FailureCode } from "./lifecycle";
import type { VisionProviderOutcome } from "./provider";
import {
  rankRoomFitCandidates,
  rankVisuallySimilarCandidates,
  retrieveVisualCandidates,
} from "./retrieval";
import type { EmbeddingCandidate, RetrievalResult, RoomFitInput } from "./retrieval";

type SafeFailureCode = Extract<FailureCode, "provider_unavailable" | "analysis_failed">;

export type LocalVisionRetrievalInput = Readonly<{
  requestReference: string;
  outcome: VisionProviderOutcome;
  candidates: readonly EmbeddingCandidate[];
  confirmedScene: boolean;
  explicitMeasurements: readonly string[];
  roomSignals: readonly string[];
}>;

export type LocalVisionRetrievalResult =
  | Readonly<{
      kind: "ready";
      visual: RetrievalResult;
      roomFit: RetrievalResult;
    }>
  | Readonly<{
      kind: "unavailable" | "failed";
      reasonCode: SafeFailureCode;
    }>;

export const retrieveLocalVisualCandidates = (
  candidates: readonly EmbeddingCandidate[],
  outcome: Extract<VisionProviderOutcome, { readonly kind: "ready" }>,
): RetrievalResult => retrieveVisualCandidates({ candidates, query: outcome.model });

export const rankLocalVisualSimilarity = (
  candidates: readonly EmbeddingCandidate[],
  outcome: Extract<VisionProviderOutcome, { readonly kind: "ready" }>,
): RetrievalResult => rankVisuallySimilarCandidates(candidates, outcome.model);

export const orchestrateLocalVisionRetrieval = (input: LocalVisionRetrievalInput): LocalVisionRetrievalResult => {
  switch (input.outcome.kind) {
    case "failed":
      return {
        kind: input.outcome.code === "provider_unavailable" ? "unavailable" : "failed",
        reasonCode: input.outcome.code,
      };
    case "ready": {
      const roomFitInput: RoomFitInput = {
        candidates: input.candidates,
        query: input.outcome.model,
        confirmedScene: input.confirmedScene,
        explicitMeasurements: input.explicitMeasurements,
        roomSignals: input.roomSignals,
      };
      return {
        kind: "ready",
        visual: retrieveLocalVisualCandidates(input.candidates, input.outcome),
        roomFit: rankRoomFitCandidates(roomFitInput),
      };
    }
  }
};
