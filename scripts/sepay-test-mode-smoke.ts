import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseEnvFile } from "./staging-doctor";
import {
  isExpectedSePayTestVietQrUrl,
  isSePayTestPaymentReference,
} from "../src/lib/payments/sepay/checkout";
import { createSePayTestModeVietQr } from "../src/lib/payments/sepay/test-mode-client.server";

const requestDiagnostics: Array<Readonly<{ method: string; path: string; status: number }>> = [];

async function main(): Promise<void> {
  const environment = {
    ...parseEnvFile(await readFile(resolve(process.cwd(), ".env.local"), "utf8")),
    ...process.env,
  };
  const amount = 125_000;
  const merchantReference = `WEB${randomBytes(6).toString("hex").toUpperCase()}`;
  const apiBaseUrl = required(environment, "SEPAY_API_BASE_URL");
  const apiToken = required(environment, "SEPAY_API_TOKEN");
  const bankAccountId = required(environment, "SEPAY_TEST_BANK_ACCOUNT_ID");
  if (!isSePayTestPaymentReference(merchantReference)) throw new Error("invalid_smoke_reference");

  const handoff = await createSePayTestModeVietQr({
    amount,
    apiBaseUrl,
    apiToken,
    bankAccountId,
    fetcher: async (input, init) => {
      const response = await fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : input);
      requestDiagnostics.push({
        method: init?.method ?? "GET",
        path: url.pathname.replace(bankAccountId, ":account"),
        status: response.status,
      });
      return response;
    },
    merchantReference,
  });
  if (!isExpectedSePayTestVietQrUrl(handoff.paymentUrl, { amount, merchantReference })) {
    throw new Error("invalid_smoke_handoff");
  }
  const qrResponse = await fetch(handoff.paymentUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = qrResponse.headers.get("content-type")?.toLowerCase() ?? "";
  if (!qrResponse.ok || !contentType.startsWith("image/")) throw new Error("qr_unavailable");

  process.stdout.write(`${JSON.stringify({
    amount,
    merchantReference,
    providerOrderCreatedOrRecovered: true,
    providerRequests: requestDiagnostics,
    qrContentType: contentType.split(";", 1)[0],
    qrHostAllowlisted: new URL(handoff.paymentUrl).hostname === "vietqr.app",
    qrStatus: qrResponse.status,
  })}\n`);
}

function required(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = environment[key];
  if (value === undefined || value.trim() === "") throw new Error(`missing_${key}`);
  return value;
}

main().catch((error: unknown) => {
  process.stdout.write(`${JSON.stringify({
    error: error instanceof Error ? error.message : "unexpected_failure",
    providerOrderCreatedOrRecovered: false,
    providerRequests: requestDiagnostics,
  })}\n`);
  process.exitCode = 1;
});
