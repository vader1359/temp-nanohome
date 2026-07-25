import { describe, expect, it } from "vitest";

import {
  parseAccountPreferencesPatch,
  parseAccountPreferencesResponse,
} from "./preferences-schema";

describe("account preferences schema", () => {
  it("accepts only editable preference toggles", () => {
    // Given: a browser patch with one safe preference toggle.
    const input = { browsingHistoryEnabled: false };

    // When: the patch is parsed at the API boundary.
    const result = parseAccountPreferencesPatch(input);

    // Then: the canonical safe patch is returned.
    expect(result).toEqual({ browsingHistoryEnabled: false });
  });

  it("rejects an AMIS identifier from a browser patch", () => {
    // Given: a browser patch with unrelated AMIS data.
    const input = { amisId: "forged", browsingHistoryEnabled: false };

    // When: the patch is parsed at the API boundary.
    const result = parseAccountPreferencesPatch(input);

    // Then: the unsafe shape is rejected before it reaches the port.
    expect(result).toBeNull();
  });

  it("accepts only the safe preferences response DTO", () => {
    // Given: a canonical preferences response.
    const input = {
      amisHistory: { available: true, enabled: true },
      browsingHistoryEnabled: true,
      productPersonalizationEnabled: false,
      recommendationDataState: "available",
    };

    // When: a client parses the API response.
    const result = parseAccountPreferencesResponse(input);

    // Then: only the safe response type is returned.
    expect(result).toEqual(input);
  });
});
