import { describe, expect, it } from "vitest";
import { parseFilters, buildQueryKey, buildQueryString } from "./filter-utils";

describe("filter-utils", () => {
  it("parses empty or invalid input to default filters", () => {
    const defaults = parseFilters({});
    expect(defaults).toEqual({
      brand: [],
      category: [],
      subCategory: [],
      room: [],
      status: null,
      q: "",
      sort: "priority",
      page: 1,
    });
  });

  it("normalizes and sorts array parameters", () => {
    const parsed = parseFilters({
      brand: ["hay", "usm", "hay"],
      category: "chairs",
      page: "3",
    });
    expect(parsed.brand).toEqual(["hay", "usm"]);
    expect(parsed.category).toEqual(["chairs"]);
    expect(parsed.page).toBe(3);
  });

  it("parses from string or URLSearchParams", () => {
    const parsedStr = parseFilters("brand=usm&brand=hay&category=tables&page=2");
    expect(parsedStr.brand).toEqual(["hay", "usm"]);
    expect(parsedStr.category).toEqual(["tables"]);
    expect(parsedStr.page).toBe(2);

    const params = new URLSearchParams("brand=usm&brand=hay&category=tables&page=2");
    const parsedParams = parseFilters(params);
    expect(parsedParams).toEqual(parsedStr);
  });

  it("builds query key deterministically", () => {
    const filters = parseFilters({
      brand: ["usm", "hay"],
      category: "chairs",
      q: "table",
    });
    const key = buildQueryKey(filters);
    expect(key).toEqual([
      "products",
      {
        brand: ["hay", "usm"],
        category: ["chairs"],
        subCategory: [],
        room: [],
        status: null,
        q: "table",
        sort: "priority",
        page: 1,
      },
    ]);
  });

  it("builds query string deterministically", () => {
    const filters = parseFilters({
      brand: ["usm", "hay"],
      category: "chairs",
      page: 2,
      sort: "price_asc",
    });
    const qs = buildQueryString(filters);
    expect(qs).toBe("brand=hay&brand=usm&category=chairs&sort=price_asc&page=2");
  });
});
