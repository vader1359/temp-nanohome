import { describe, expect, it } from "vitest";

import { getNewsByAirtableId, getNewsList } from "./news";

describe("news exports", () => {
  it("imports every news query export", () => {
    expect(getNewsList).toBeTypeOf("function");
    expect(getNewsByAirtableId).toBeTypeOf("function");
  });
});
