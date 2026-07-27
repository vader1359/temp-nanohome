import "server-only";

import { z } from "zod";

const opaqueReferenceSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u);

export const chatConversationPersistenceRequestSchema = z.object({
  conversationRef: opaqueReferenceSchema,
  messageRef: opaqueReferenceSchema,
}).strict();

export const chatHandoffLifecycleRequestSchema = z.object({
  handoffRef: opaqueReferenceSchema,
  reasonCode: z.enum(["unsupported_request", "staff_confirmation_required"]),
}).strict();

export const chatAttachmentDescriptorSchema = z.object({
  attachmentRef: opaqueReferenceSchema,
  mediaKind: z.literal("image"),
  displayName: z.string().min(1).max(200),
  state: z.enum(["pending", "disabled", "deleted"]),
}).strict();

export const chatVisualAnalysisEnvelopeSchema = z.object({
  attachmentRef: opaqueReferenceSchema,
  sceneRef: opaqueReferenceSchema.optional(),
  state: z.literal("disabled"),
}).strict();

export type ChatConversationPersistenceRequest = Readonly<z.infer<typeof chatConversationPersistenceRequestSchema>>;
export type ChatHandoffLifecycleRequest = Readonly<z.infer<typeof chatHandoffLifecycleRequestSchema>>;
export type ChatAttachmentDescriptor = Readonly<z.infer<typeof chatAttachmentDescriptorSchema>>;
export type ChatVisualAnalysisEnvelope = Readonly<z.infer<typeof chatVisualAnalysisEnvelopeSchema>>;
export type ChatCapability = "conversationPersistence" | "advisorHandoff" | "attachment" | "visualAnalysis";
export type ChatCapabilityResult = Readonly<{ kind: "capability_unavailable"; capability: ChatCapability }>;

export const chatCapabilityRegistry: Readonly<Record<ChatCapability, false>> = {
  conversationPersistence: false,
  advisorHandoff: false,
  attachment: false,
  visualAnalysis: false,
};

export type DisabledChatCapabilityAdapter = Readonly<{
  execute: (capability: ChatCapability) => Promise<ChatCapabilityResult>;
}>;

export function createDisabledChatCapabilityAdapter(): DisabledChatCapabilityAdapter {
  return {
    execute: async (capability) => ({ kind: "capability_unavailable", capability }),
  };
}
