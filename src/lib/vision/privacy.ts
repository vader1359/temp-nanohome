import type { RoomSceneRecord } from "./contracts";

export type VisionConsent = Readonly<{ roomImageProcessing: boolean; roomImageStorage: boolean }>;
export type DeepSeekTextPayload = Readonly<{
  scene: Readonly<Pick<RoomSceneRecord, "sceneId" | "roomType" | "styleTags" | "palette" | "materials" | "detectedFurniture" | "measurements" | "uncertainties">>;
  providerTextPresent: boolean;
}>;

export const canProcessRoomImage = (consent: VisionConsent): boolean => consent.roomImageProcessing;
export const canRetainRoomImage = (consent: VisionConsent): boolean => consent.roomImageStorage;

export const buildDeepSeekTextPayload = (input: Readonly<{
  record: RoomSceneRecord;
  providerText: string;
  rawImage: string;
  sourceUrl: string;
  vector: readonly number[];
  rawProviderResponse: unknown;
}>): DeepSeekTextPayload => ({
  scene: {
    sceneId: input.record.sceneId,
    roomType: input.record.roomType,
    styleTags: input.record.styleTags,
    palette: input.record.palette,
    materials: input.record.materials,
    detectedFurniture: input.record.detectedFurniture,
    measurements: input.record.measurements,
    uncertainties: input.record.uncertainties,
  },
  providerTextPresent: input.providerText.trim().length > 0,
});
