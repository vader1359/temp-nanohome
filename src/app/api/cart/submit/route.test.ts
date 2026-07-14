import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("POST /api/cart/submit", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("FILLOUT_API_KEY", "test-api-key");
    // Clear other env vars that might interfere
    vi.stubEnv("FILLOUT_CART_QUESTION_VAT_REQUESTED_ID", "");
    vi.stubEnv("FILLOUT_CART_QUESTION_ZALOPAY_REQUESTED_ID", "");
    vi.stubEnv("FILLOUT_CART_QUESTION_VNPAY_REQUESTED_ID", "");
    vi.stubEnv("FILLOUT_CART_QUESTION_TOTAL_ID", "");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const validBasePayload = {
    name: "Nguyen Van A",
    phone: "0900000000",
    email: "customer@example.com",
    cartItems: [
      {
        id: "item-1",
        name: "Test Product",
        category: "Test Category",
        quantity: 2,
        price: "100.000 ₫",
        lineTotal: 200000,
      },
    ],
    total: 200000,
  };

  it("omitted flags map defaults false", async () => {
    // Configure env IDs for all three boolean questions
    vi.stubEnv("FILLOUT_CART_QUESTION_VAT_REQUESTED_ID", "vat_id");
    vi.stubEnv("FILLOUT_CART_QUESTION_ZALOPAY_REQUESTED_ID", "zalo_id");
    vi.stubEnv("FILLOUT_CART_QUESTION_VNPAY_REQUESTED_ID", "vnpay_id");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "submission-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Call with omitted flags
    const request = new NextRequest("http://localhost/api/cart/submit", {
      method: "POST",
      body: JSON.stringify(validBasePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify fetch call has false for the omitted flags
    expect(fetchMock).toHaveBeenCalledOnce();
    const fetchArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);
    const questions = body.submissions[0].questions;

    const vatQuestion = questions.find((q: { id?: string }) => q.id === "vat_id");
    const zaloQuestion = questions.find((q: { id?: string }) => q.id === "zalo_id");
    const vnpayQuestion = questions.find((q: { id?: string }) => q.id === "vnpay_id");

    expect(vatQuestion).toEqual({ id: "vat_id", value: false });
    expect(zaloQuestion).toEqual({ id: "zalo_id", value: false });
    expect(vnpayQuestion).toEqual({ id: "vnpay_id", value: false });
  });

  const invalidValues = [
    { label: "null", value: null },
    { label: "string", value: "true" },
    { label: "number", value: 1 },
    { label: "object", value: {} },
    { label: "array", value: [] },
  ];

  for (const flag of ["vatRequested", "zaloPayRequested", "vnPayRequested"] as const) {
    for (const { label, value } of invalidValues) {
      it(`invalid ${label} for ${flag} returns 400`, async () => {
        const payload = {
          ...validBasePayload,
          [flag]: value,
        };

        const request = new NextRequest("http://localhost/api/cart/submit", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe(`${flag} must be a boolean`);
      });
    }
  }

  it("optional individual configured Fillout env IDs append only their own boolean question and no absent-ID question", async () => {
    // Configure only vatRequestedId, leave other two empty/undefined
    vi.stubEnv("FILLOUT_CART_QUESTION_VAT_REQUESTED_ID", "vat_id");
    vi.stubEnv("FILLOUT_CART_QUESTION_ZALOPAY_REQUESTED_ID", "");
    vi.stubEnv("FILLOUT_CART_QUESTION_VNPAY_REQUESTED_ID", "");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "submission-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/cart/submit", {
      method: "POST",
      body: JSON.stringify({
        ...validBasePayload,
        vatRequested: true,
        zaloPayRequested: true,
        vnPayRequested: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledOnce();
    const fetchArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);
    const questions = body.submissions[0].questions;

    // Must find vat_id
    const vatQuestion = questions.find((q: { id?: string }) => q.id === "vat_id");
    expect(vatQuestion).toEqual({ id: "vat_id", value: true });

    // Must NOT find questions for zaloPayRequested or vnPayRequested
    const hasZalo = questions.some((q: { id?: string }) => q.id === "" || q.id === "zalo_id");
    const hasVnpay = questions.some((q: { id?: string }) => q.id === "" || q.id === "vnpay_id");
    expect(hasZalo).toBe(false);
    expect(hasVnpay).toBe(false);
  });
});
