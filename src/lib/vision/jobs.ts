import { z } from "zod";
import type { VisionProviderOutcome, VisionProviderRequest } from "./provider";

const jobIdentitySchema = z.string().trim().min(1).max(256);

export type VisionJobDelivery = VisionProviderRequest & Readonly<{
  requestId: string;
  idempotencyKey: string;
}>;

export type VisionJobBoundary = Readonly<{
  deliver: (delivery: VisionJobDelivery) => VisionProviderOutcome;
}>;

export type VisionJobBoundaryDependencies = Readonly<{
  analyze: (request: VisionProviderRequest) => VisionProviderOutcome;
}>;

type StoredJobOutcome = Readonly<{
  outcome: VisionProviderOutcome;
  request: VisionProviderRequest;
}>;

export const createInMemoryVisionJobBoundary = ({ analyze }: VisionJobBoundaryDependencies): VisionJobBoundary => {
  const outcomes = new Map<string, Map<string, StoredJobOutcome>>();

  return {
    deliver: (delivery) => {
      const requestId = jobIdentitySchema.parse(delivery.requestId);
      const idempotencyKey = jobIdentitySchema.parse(delivery.idempotencyKey);
      const requestOutcomes = outcomes.get(requestId);
      const prior = requestOutcomes?.get(idempotencyKey);

      if (prior !== undefined) {
        if (prior.request.objectReference === delivery.objectReference && prior.request.fixture === delivery.fixture) {
          return prior.outcome;
        }
        return { kind: "failed", code: "analysis_failed" };
      }

      const request: VisionProviderRequest = {
        objectReference: delivery.objectReference,
        fixture: delivery.fixture,
      };

      const outcome = analyze(request);
      const persistedOutcomes = requestOutcomes ?? new Map<string, StoredJobOutcome>();
      persistedOutcomes.set(idempotencyKey, { outcome, request });
      outcomes.set(requestId, persistedOutcomes);
      return outcome;
    },
  };
};
