import { isRecommendationEligible, isVisualMatchEligible, type CatalogEligibility } from "../catalog/eligibility";
import { validateVectorCompatibility, type VectorCompatibility } from "./contracts";

export type EmbeddingCandidate = Readonly<{
  variantId: string;
  productImageId: string;
  embedding: readonly number[];
  model: VectorCompatibility;
  visualDistance: number;
  eligibility: CatalogEligibility;
}>;

type CandidateResult = Readonly<{ variantId: string; reasonCodes: readonly string[] }>;
type Rejection = Readonly<{ variantId: string; reasonCode: "provider_mismatch" | "model_mismatch" | "version_mismatch" | "dimension_mismatch" | "non_finite" | "incompatible_vector" | "ineligible" | "stale" | "duplicate" | "room_signals_required" }>;
export type RetrievalResult = Readonly<{ candidates: readonly CandidateResult[]; rejected: readonly Rejection[] }>;
export type RetrievalInput = Readonly<{ query: VectorCompatibility; candidates: readonly EmbeddingCandidate[] }>;
export type RoomFitInput = RetrievalInput & Readonly<{
  confirmedScene: boolean;
  explicitMeasurements: readonly string[];
  roomSignals: readonly string[];
}>;
type Claim = "visually_similar" | "room_fit";

const rank = (input: RetrievalInput, claim: Claim): RetrievalResult => {
  const accepted: CandidateResult[] = [];
  const rejected: Rejection[] = [];
  const seenImages = new Set<string>();

  for (const candidate of input.candidates) {
    const compatibility = validateVectorCompatibility(candidate.embedding, input.query, candidate.model);
    if (compatibility.kind === "invalid") {
      rejected.push({ variantId: candidate.variantId, reasonCode: compatibility.reason });
      continue;
    }
    if (!Number.isFinite(candidate.visualDistance)) {
      rejected.push({ variantId: candidate.variantId, reasonCode: "non_finite" });
      continue;
    }
    const eligible = claim === "visually_similar"
      ? isVisualMatchEligible(candidate.eligibility)
      : isRecommendationEligible(candidate.eligibility);
    if (!eligible) {
      rejected.push({ variantId: candidate.variantId, reasonCode: "ineligible" });
      continue;
    }
    if (!candidate.eligibility.has_fresh_stock) {
      rejected.push({ variantId: candidate.variantId, reasonCode: "stale" });
      continue;
    }
    if (seenImages.has(candidate.productImageId)) {
      rejected.push({ variantId: candidate.variantId, reasonCode: "duplicate" });
      continue;
    }
    seenImages.add(candidate.productImageId);
    accepted.push({ variantId: candidate.variantId, reasonCodes: [claim] });
  }

  if (claim === "visually_similar") {
    accepted.sort((left, right) => {
      const leftCandidate = input.candidates.find(({ variantId }) => variantId === left.variantId);
      const rightCandidate = input.candidates.find(({ variantId }) => variantId === right.variantId);
      return (leftCandidate?.visualDistance ?? Number.POSITIVE_INFINITY) - (rightCandidate?.visualDistance ?? Number.POSITIVE_INFINITY);
    });
  }

  return { candidates: accepted, rejected };
};

export const retrieveVisualCandidates = (input: RetrievalInput): RetrievalResult => rank(input, "visually_similar");
export const rankVisuallySimilarCandidates = (candidates: readonly EmbeddingCandidate[], query: VectorCompatibility): RetrievalResult => rank({ candidates, query }, "visually_similar");
export const rankRoomFitCandidates = (input: RoomFitInput): RetrievalResult => {
  const reasonCodes: string[] = [];
  if (input.confirmedScene) reasonCodes.push("confirmed_scene");
  if (input.explicitMeasurements.length > 0) reasonCodes.push("explicit_measurement");
  if (input.roomSignals.length > 0) reasonCodes.push("room_signal_match");

  if (reasonCodes.length === 0) {
    return {
      candidates: [],
      rejected: input.candidates.map(({ variantId }) => ({ variantId, reasonCode: "room_signals_required" as const })),
    };
  }

  const result = rank(input, "room_fit");
  return {
    candidates: result.candidates.map((candidate) => ({ variantId: candidate.variantId, reasonCodes: ["room_fit", ...reasonCodes] })),
    rejected: result.rejected,
  };
};
