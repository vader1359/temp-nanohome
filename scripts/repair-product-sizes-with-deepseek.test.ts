import { describe, expect, it } from "vitest";
import { hasCompleteDimensionEvidence, proposedSize } from "./repair-product-sizes-with-deepseek";

describe("proposedSize", () => {
  it.each([
    ["DI120 x H130 mm", "W120 x D120 x H130 mm"],
    ["DK120 x H130 mm", "W120 x D120 x H130 mm"],
    ["H44xDI38 cm", "W380 x D380 x H440 mm"],
    ["H44xDK38 cm", "W380 x D380 x H440 mm"],
    ["Ø120 x H130 mm", "W120 x D120 x H130 mm"],
    ["​​Ø16 x H29.5 cm", "W160 x D160 x H295 mm"],
    ["Φ23xW26xH35 cm", "W260 x D230 x H350 mm"],
    ["FLOWERPOT VP9 Decorative Lamps DI16 x H29.5 cm", "W160 x D160 x H295 mm"],
  ])("maps diameter aliases in %s", (evidence, expected) => {
    expect(proposedSize(evidence)).toEqual({ value: expected });
  });

  it("treats standalone R as diameter while preserving Vietnamese D/R/C axes", () => {
    expect(proposedSize("R38 x H44 cm")).toEqual({ value: "W380 x D380 x H440 mm" });
    expect(proposedSize("D44.6 x R21.7 x C32.7 cm")).toEqual({ value: "W446 x D217 x H327 mm" });
  });

  it.each([
    ["W43.6 x L61.6 x H3.3 cm", "W616 x D436 x H33 mm"],
    ["L40 x W40 x H44 cm", "W400 x D400 x H440 mm"],
    ["L1600 x D800 x H700 mm", "W1600 x D800 x H700 mm"],
  ])("normalizes source axes in %s", (evidence, expected) => {
    expect(proposedSize(evidence)).toEqual({ value: expected });
  });

  it.each([
    ["L128 x W70 x H45/80 cm", "W1280 x D700 x H450/800 mm"],
    ["DI50 x H50-75 mm", "W50 x D50 x H50/75 mm"],
    ["DI40 x H56–62 cm", "W400 x D400 x H560/620 mm"],
    ["DI40 x H56~62 cm", "W400 x D400 x H560/620 mm"],
    ["DI100/125 mm", "W100/125 x D100/125 mm"],
    ["DI56x70/86 cm", "W560 x D560 x H700/860 mm"],
  ])("preserves and converts ranges in %s", (evidence, expected) => {
    expect(proposedSize(evidence)).toEqual({ value: expected });
  });

  it.each([
    ["67.5 x 67.5 cm", "W675 x D675 mm"],
    ["13*13*15cm", "W130 x D130 x H150 mm"],
    ["10cm x 20cm x 30cm", "W100 x D200 x H300 mm"],
  ])("supports complete unlabelled dimensions in %s", (evidence, expected) => {
    expect(proposedSize(evidence)).toEqual({ value: expected });
  });

  it.each([
    ["10 x 20 x 30 x 40 mm", "too many unlabelled dimensions"],
    ["50/75 x 30 cm", "no labelled dimensions"],
    ["Ø60 x 150 x 200 cm", "unconsumed dimension token requires review"],
    ["B120 x H130 mm", "unconsumed dimension token requires review"],
    ["L100 x R50 x H70 cm", "ambiguous L/R axis combination"],
  ])("refuses partial dimension parsing in %s", (evidence, expectedReason) => {
    expect(proposedSize(evidence)).toEqual({ reason: expectedReason });
  });

  it.each([
    "W43. 6 x D21.7 x H32.7 cm",
    "W43..6 x D21 x H32 cm",
    "W1,300 x D800 x H700 mm",
    "W1,200.5 x D800 mm",
    "W1 300 x D800 mm",
  ])("refuses malformed or ambiguous numbers in %s", (evidence) => {
    expect(proposedSize(evidence)).toEqual({ reason: "malformed decimal dimension requires review" });
  });

  it("keeps mixed units conservative", () => {
    expect(proposedSize("W1 m x D50 cm x H400 mm")).toEqual({ reason: "mixed units in evidence" });
  });

  it("keeps auxiliary dimensions after the primary size", () => {
    expect(proposedSize("W500 x D450 x H800 x SH450 x AH650 x DH300 x TH25 x CL700 mm")).toEqual({
      value: "W500 x D450 x H800 mm (SH450 mm, AH650 mm, DH300 mm, TH25 mm, CL700 mm)",
    });
  });

  it("keeps conflicting multiple diameters in review", () => {
    expect(proposedSize("DI265 x DK390 x H575 mm")).toEqual({ reason: "conflicting diameter values" });
  });
});

describe("hasCompleteDimensionEvidence", () => {
  it("accepts the complete exact dimension expression", () => {
    const name = "IKEBANA VASE SMALL, DI120 x H130 mm, Blown Glass";
    expect(hasCompleteDimensionEvidence(name, "DI120 x H130 mm")).toBe(true);
  });

  it("rejects an exact substring that omits a diameter", () => {
    const name = "IKEBANA VASE SMALL, DI120 x H130 mm, Blown Glass";
    expect(hasCompleteDimensionEvidence(name, "H130 mm")).toBe(false);
  });

  it("rejects an exact substring that omits another dimension clause", () => {
    const name = "L'AMICA Table Lamp, Ø22x65 cm, Diameter 12 cm, Green";
    expect(hasCompleteDimensionEvidence(name, "Ø22x65 cm")).toBe(false);
  });

  it("rejects an ordered substring that drops the first dimension", () => {
    const name = "Panel, 10 x 20 x 30 mm, White";
    expect(hasCompleteDimensionEvidence(name, "20 x 30 mm")).toBe(false);
  });

  it("rejects non-exact evidence", () => {
    expect(hasCompleteDimensionEvidence("Vase, DI120 x H130 mm", "DI120 × H130 mm")).toBe(false);
  });
});
