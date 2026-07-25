import { describe, expect, it } from "vitest";

import { BRAND_VOICE_VERSION, brandVoiceInstruction } from "./brand-voice";

describe("chat brand voice", () => {
  it("uses the Vietnamese neutral address and guarded humor policy", () => {
    const instruction = brandVoiceInstruction("vi");

    expect(BRAND_VOICE_VERSION).toBe("public-advisor-v3");
    expect(instruction).toContain("address the customer as bạn");
    expect(instruction).toContain("Never guess age, title, or gender.");
    expect(instruction).toContain("at most one light humorous line");
    expect(instruction).toContain("Never use humor for payment, refund, delivery damage, complaints, privacy, account, accessibility, safety, price or stock disappointment, or staff escalation.");
    expect(instruction).toContain("never permits inventing facts, commercial claims, or assurances.");
  });

  it.each(["en", "ko"] as const)("uses a neutral address in %s", (locale) => {
    expect(brandVoiceInstruction(locale)).toContain("respectful neutral form of address");
  });
});
