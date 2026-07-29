export const SEPAY_SANDBOX_API_BASE_URL = "https://userapi-sandbox.sepay.vn/v2";

export type SePayTestPaymentInstruction = Readonly<{
  readonly amount: number;
  readonly currency: "VND";
  readonly environment: "sandbox";
  readonly merchantReference: string;
  readonly paymentState: "pending" | "paid";
}>;

export function buildSePayTestPaymentInstruction(input: Readonly<{
  readonly amount: number;
  readonly currency: "VND";
  readonly merchantReference: string;
  readonly paymentState: "pending" | "paid";
}>): SePayTestPaymentInstruction {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error("SePay Test VND amounts must be positive safe integers");
  }
  if (!/^WEB-[A-Z0-9_-]+$/.test(input.merchantReference)) {
    throw new Error("SePay Test requires a canonical server merchant reference");
  }
  return {
    amount: input.amount,
    currency: input.currency,
    environment: "sandbox",
    merchantReference: input.merchantReference,
    paymentState: input.paymentState,
  };
}
