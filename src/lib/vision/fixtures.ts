import type { RoomSceneRecord } from "./contracts";

export const createSyntheticRoomSceneRecord = (): RoomSceneRecord => ({
  sceneId: "synthetic-scene-001",
  roomType: "living_room",
  styleTags: ["synthetic", "minimal"],
  palette: ["warm-white", "oak"],
  materials: ["wood"],
  detectedFurniture: ["chair"],
  measurements: { chairWidth: { value: 240, unit: "cm", source: "vision", confidence: 0.4 } },
  uncertainties: ["synthetic fixture; not a customer image"],
  analyzedAt: "2026-01-01T00:00:00.000Z",
  provider: { name: "synthetic", version: "fixture-1" },
});
