import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSePayTestModeVietQr,
  SePayTestModeClientError,
  SEPAY_TEST_API_BASE_URL,
  SEPAY_TEST_VIETQR_URL,
} from "./test-mode-client.server";

const bankAccountId = "00000000-0000-4000-8000-000000000701";
const providerOrderId = "00000000-0000-4000-8000-000000000702";
const terminalId = "00000000-0000-4000-8000-000000000703";
const merchantReference = "WEB0123456789AB";
const valid = {
  amount: 125000,
  apiBaseUrl: SEPAY_TEST_API_BASE_URL,
  apiToken: "test-mode-api-token",
  bankAccountId,
  merchantReference,
} as const;

function accountResponse(): Response {
  return Response.json({
    data: [{
      account_type: "business_household",
      active: "1",
      bank_code: "VCB",
      id: bankAccountId,
    }],
    status: "success",
  });
}

function terminalResponse(): Response {
  return Response.json({
    data: [{ tid: "SBVCBTESTTID001", xid: terminalId }],
    status: "success",
  });
}

function createdOrderResponse(): Response {
  return Response.json({
    data: {
      amount: 125000,
      id: providerOrderId,
      order_code: merchantReference,
      status: "Pending",
      va: [{
        status: "Unpaid",
        va_number: "SBSEPAYTESTVA000001",
      }],
    },
    status: "success",
  }, { status: 201 });
}

function successfulFetcher(): ReturnType<typeof vi.fn> {
  return vi.fn()
    .mockResolvedValueOnce(accountResponse())
    .mockResolvedValueOnce(terminalResponse())
    .mockResolvedValueOnce(createdOrderResponse());
}

describe("SePay Test Mode VietQR client", () => {
  it("creates one VCB order VA and builds an allowlisted QR handoff", async () => {
    const fetcher = successfulFetcher();

    const result = await createSePayTestModeVietQr({ ...valid, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(3);
    const [accountUrl] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(accountUrl.toString()).toBe(
      "https://userapi-sandbox.sepay.vn/v2/bank-accounts?per_page=100",
    );
    const [terminalUrl] = fetcher.mock.calls[1] as [URL, RequestInit];
    expect(terminalUrl.pathname).toBe(`/v2/bank-accounts/${bankAccountId}/terminals`);
    const [orderUrl, orderInit] = fetcher.mock.calls[2] as [URL, RequestInit];
    expect(orderUrl.pathname).toBe(`/v2/bank-accounts/${bankAccountId}/orders`);
    expect(orderInit.method).toBe("POST");
    expect(JSON.parse(String(orderInit.body))).toEqual({
      amount: 125000,
      duration: 86400,
      order_code: merchantReference,
      qrcode_template: "compact",
      tid: "SBVCBTESTTID001",
      with_qrcode: "1",
    });
    expect(orderInit.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-mode-api-token",
      "Content-Type": "application/json",
    });
    const paymentUrl = new URL(result.paymentUrl);
    expect(`${paymentUrl.origin}${paymentUrl.pathname}`).toBe(SEPAY_TEST_VIETQR_URL);
    expect(Object.fromEntries(paymentUrl.searchParams)).toEqual({
      acc: "SBSEPAYTESTVA000001",
      bank: "VCB",
      amount: "125000",
      des: merchantReference,
      template: "compact",
      showinfo: "true",
      fullacc: "true",
    });
  });

  it("recovers an already-created provider order after a duplicate response", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(accountResponse())
      .mockResolvedValueOnce(terminalResponse())
      .mockResolvedValueOnce(Response.json({ error_code: "duplicate" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({
        data: [{
          amount: 125000,
          id: providerOrderId,
          order_code: merchantReference,
          status: "Pending",
          va: [{
            status: "Unpaid",
            va_number: "SBSEPAYTESTVA000001",
          }],
        }],
        status: "success",
      }));

    const result = await createSePayTestModeVietQr({ ...valid, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(4);
    const [lookupUrl] = fetcher.mock.calls[3] as [URL, RequestInit];
    expect(lookupUrl.searchParams.get("per_page")).toBe("100");
    expect(new URL(result.paymentUrl).searchParams.get("acc")).toBe("SBSEPAYTESTVA000001");
  });

  it.each([
    ["production API", { apiBaseUrl: "https://userapi.sepay.vn/v2" }],
    ["missing token", { apiToken: " " }],
    ["unknown account", { bankAccountId: "00000000-0000-4000-8000-000000000704" }],
    ["hyphenated reference", { merchantReference: "WEB-0123456789AB" }],
    ["overlong VCB reference", { merchantReference: "WEB0123456789ABC" }],
    ["amount below Test Mode minimum", { amount: 999 }],
    ["amount above Test Mode maximum", { amount: 499_000_001 }],
  ])("rejects %s", async (_label, override) => {
    await expect(createSePayTestModeVietQr({
      ...valid,
      ...override,
      fetcher: successfulFetcher(),
    })).rejects.toBeInstanceOf(SePayTestModeClientError);
  });

  it("fails closed when the selected account has ambiguous terminals", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(accountResponse())
      .mockResolvedValueOnce(Response.json({
        data: [
          { tid: "SBVCBTESTTID001", xid: terminalId },
          { tid: "SBVCBTESTTID002", xid: "00000000-0000-4000-8000-000000000705" },
        ],
        status: "success",
      }));

    await expect(createSePayTestModeVietQr({ ...valid, fetcher }))
      .rejects.toMatchObject({ code: "request_failed" });
  });

  it.each([
    ["rate limit", new Response(null, { status: 429 }), "rate_limited"],
    ["provider error", new Response(null, { status: 503 }), "request_failed"],
    ["malformed response", Response.json({ data: [{}], status: "success" }), "request_failed"],
  ])("fails closed on %s", async (_label, response, code) => {
    await expect(createSePayTestModeVietQr({
      ...valid,
      fetcher: vi.fn().mockResolvedValue(response),
    })).rejects.toMatchObject({ code });
  });

  it("maps a network timeout to a secret-safe error", async () => {
    await expect(createSePayTestModeVietQr({
      ...valid,
      fetcher: vi.fn().mockRejectedValue(new Error("token must not escape")),
    })).rejects.toMatchObject({ code: "request_failed", message: "request_failed" });
  });
});
