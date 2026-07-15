import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as productsService from "@/lib/products/products-service";

vi.mock("@/lib/products/products-service", () => ({
  getProductPage: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  setRequestLocale: () => {},
}));

describe("GET /api/products", () => {
  it("returns 400 for unsupported locale", async () => {
    const request = new NextRequest("http://localhost/api/products?locale=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unsupported locale");
  });

  it("calls getProductPage with correct params and returns data", async () => {
    const mockData = {
      products: [],
      totalCount: 0,
      filters: {
        brand: ["usm"],
        category: [],
        subCategory: [],
        room: [],
        status: null,
        q: "",
        sort: "priority",
        page: 1,
      },
      brandOptions: [],
      categoryOptions: [],
      roomOptions: [],
    };
    vi.mocked(productsService.getProductPage).mockResolvedValueOnce(mockData as unknown as ReturnType<typeof productsService.getProductPage>);

    const request = new NextRequest("http://localhost/api/products?locale=en&brand=usm");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    
    const data = await response.json();
    expect(data).toEqual(mockData);
    expect(productsService.getProductPage).toHaveBeenCalledWith("en", expect.objectContaining({
      brand: ["usm"],
    }));
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(productsService.getProductPage).mockRejectedValueOnce(new Error("Database error"));
    const request = new NextRequest("http://localhost/api/products?locale=vi");
    const response = await GET(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Database error");
  });
});
