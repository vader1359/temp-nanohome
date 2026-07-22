export const DEFAULT_VISION_CONFIG = {
  uploadEnabled: false,
  roomAnalysisEnabled: false,
  visualSimilarityEnabled: false,
  evaluationStorageEnabled: false,
} as const;

export type VisionConfig = Readonly<typeof DEFAULT_VISION_CONFIG>;
