import { describe, expect, it } from "vitest";

import { getNewsByAirtableId, getNewsList, searchNews } from "./news";

describe("news exports", () => {
  it("imports every news query export", () => {
    expect(getNewsList).toBeTypeOf("function");
    expect(getNewsByAirtableId).toBeTypeOf("function");
    expect(searchNews).toBeTypeOf("function");
  });
});
