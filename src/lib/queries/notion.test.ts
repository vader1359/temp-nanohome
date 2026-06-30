import { describe, expect, it } from "vitest";

import { extractNotionPageId, localizedNewsDescription, localizedNotionLink, localizedRawString } from "./notion";

describe("extractNotionPageId", () => {
  it("returns a compact Notion page id when the url contains a hyphenated id", () => {
    const pageId = extractNotionPageId("https://www.notion.so/nanohome/Project-News-1234567890abcdef1234567890abcdef?pvs=4");

    expect(pageId).toBe("1234567890abcdef1234567890abcdef");
  });

  it("returns null when the value is not a Notion page url", () => {
    const pageId = extractNotionPageId(null);

    expect(pageId).toBeNull();
  });
});

describe("localizedRawString", () => {
  it("returns Vietnamese raw text for Vietnamese routes", () => {
    const value = localizedRawString({ description: "English", description__vi: "Tiếng Việt" }, "description", "description__vi", "vi");

    expect(value).toBe("Tiếng Việt");
  });

  it("returns English raw text for non-Vietnamese routes", () => {
    const value = localizedRawString({ description: "English", description__vi: "Tiếng Việt" }, "description", "description__vi", "en");

    expect(value).toBe("English");
  });

  it("supports meta description i18n keys", () => {
    const value = localizedRawString({ meta_description: "English meta", meta_description_vi: "Mô tả tiếng Việt" }, "meta_description", "meta_description_vi", "vi");

    expect(value).toBe("Mô tả tiếng Việt");
  });

  it("prefers Airtable double-underscore Vietnamese meta descriptions for news", () => {
    const value = localizedNewsDescription(
      {
        meta_description: "English meta",
        meta_description__vi: "Mô tả tiếng Việt từ Airtable",
      },
      "Fallback",
      "vi",
    );

    expect(value).toBe("Mô tả tiếng Việt từ Airtable");
  });
});

describe("localizedNotionLink", () => {
  it("returns the Vietnamese Notion link for Vietnamese routes", () => {
    const link = localizedNotionLink({ link: "https://example.com/en", link__vi: "https://example.com/vi" }, "vi");

    expect(link).toBe("https://example.com/vi");
  });

  it("returns the English Notion link for non-Vietnamese routes", () => {
    const link = localizedNotionLink({ link: "https://example.com/en", link__vi: "https://example.com/vi" }, "en");

    expect(link).toBe("https://example.com/en");
  });

  it("falls back to the available localized Notion link", () => {
    const link = localizedNotionLink({ link__vi: "https://example.com/vi" }, "en");

    expect(link).toBe("https://example.com/vi");
  });

  it("returns null when raw data has no Notion links", () => {
    const link = localizedNotionLink({ name: "NanoHome" }, "vi");

    expect(link).toBeNull();
  });
});
