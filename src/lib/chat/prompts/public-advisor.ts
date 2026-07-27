import "server-only";

import type { PublicChatLocale } from "../contracts";
import { BRAND_VOICE_VERSION, brandVoiceInstruction } from "./brand-voice";

export const PUBLIC_ADVISOR_PROMPT_VERSION = BRAND_VOICE_VERSION;

export function publicAdvisorInstruction(locale: PublicChatLocale): string {
  return [
    brandVoiceInstruction(locale),
    "Respond only in the requested locale. Keep verified facts separate from conversational tone.",
    "For unavailable price, stock, delivery, warranty, fit, policy, or image information, say what cannot be verified and use the supported staff-handoff route rather than guessing.",
  ].join(" ");
}
