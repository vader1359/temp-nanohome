import { describe, expect, it } from "vitest";

import {
  chatAttachmentDescriptorSchema,
  chatCapabilityRegistry,
  chatConversationPersistenceRequestSchema,
  chatHandoffLifecycleRequestSchema,
  chatVisualAnalysisEnvelopeSchema,
  createDisabledChatCapabilityAdapter,
} from "./capabilities";

describe("default-off chat capability contracts", () => {
  it("rejects persistence requests that carry message content or identity", () => {
    const result = chatConversationPersistenceRequestSchema.safeParse({
      conversationRef: "conversation_01",
      messageRef: "message_01",
      message: "Do not persist this.",
    });

    expect(result.success).toBe(false);
  });

  it("accepts opaque handoff, attachment, and scene references only", () => {
    expect(chatHandoffLifecycleRequestSchema.safeParse({ handoffRef: "handoff_01", reasonCode: "staff_confirmation_required" }).success).toBe(true);
    expect(chatAttachmentDescriptorSchema.safeParse({ attachmentRef: "attachment_01", mediaKind: "image", displayName: "living-room.webp", state: "pending" }).success).toBe(true);
    expect(chatVisualAnalysisEnvelopeSchema.safeParse({ attachmentRef: "attachment_01", sceneRef: "scene_01", state: "disabled" }).success).toBe(true);
  });

  it("rejects URLs, binary payloads, and inferred room facts", () => {
    expect(chatAttachmentDescriptorSchema.safeParse({ attachmentRef: "attachment_01", mediaKind: "image", displayName: "room.png", state: "pending", uploadUrl: "https://example.test/upload" }).success).toBe(false);
    expect(chatVisualAnalysisEnvelopeSchema.safeParse({ attachmentRef: "attachment_01", state: "disabled", roomType: "bedroom" }).success).toBe(false);
  });

  it("fails closed without invoking a provider or storage", async () => {
    const adapter = createDisabledChatCapabilityAdapter();

    await expect(adapter.execute("attachment")).resolves.toEqual({ kind: "capability_unavailable", capability: "attachment" });
    expect(chatCapabilityRegistry).toEqual({
      conversationPersistence: false,
      advisorHandoff: false,
      attachment: false,
      visualAnalysis: false,
    });
  });
});
