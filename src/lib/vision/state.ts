export const ANALYSIS_STATES = ["queued", "processing", "completed", "failed"] as const;
export type AnalysisState = (typeof ANALYSIS_STATES)[number];
export type AnalysisEvent = "start" | "complete" | "fail" | "retry";
export type TransitionResult =
  | Readonly<{ kind: "transitioned"; state: AnalysisState }>
  | Readonly<{ kind: "invalid_transition" }>;

const transitions: Readonly<Record<AnalysisState, Readonly<Record<AnalysisEvent, AnalysisState | undefined>>>> = {
  queued: { start: "processing", complete: undefined, fail: "failed", retry: undefined },
  processing: { start: undefined, complete: "completed", fail: "failed", retry: undefined },
  completed: { start: undefined, complete: undefined, fail: undefined, retry: undefined },
  failed: { start: undefined, complete: undefined, fail: undefined, retry: "queued" },
};

export const transitionAnalysisState = (state: AnalysisState, event: AnalysisEvent): TransitionResult => {
  const next = transitions[state][event];
  return next === undefined ? { kind: "invalid_transition" } : { kind: "transitioned", state: next };
};
