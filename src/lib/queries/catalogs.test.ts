import { describe, expect, it } from "vitest";

import { getCatalogs, getCatalogsByBrandId } from "./catalogs";

describe("catalogs exports", () => {
  it("imports every catalog query export", () => {
    expect(getCatalogs).toBeTypeOf("function");
    expect(getCatalogsByBrandId).toBeTypeOf("function");
  });
});
