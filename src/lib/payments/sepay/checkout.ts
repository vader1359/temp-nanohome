import { createHmac } from "node:crypto";

export const SEPAY_CHECKOUT_ACTION_URL = "https://pgapi.sepay.vn/v1/checkout/init";

export type SePayCheckoutInput = Readonly<{
  readonly merchant: string;
  readonly secret: string;
  readonly orderAmount: number;
  readonly currency: "VND";
  readonly description: string;
  readonly invoiceNumber: string;
  readonly customerId?: string;
  readonly paymentMethod?: string;
  readonly successUrl: string;
  readonly errorUrl: string;
  readonly cancelUrl: string;
}>;

type SePayCheckoutFields = Readonly<{
  readonly order_amount: string;
  readonly merchant: string;
  readonly currency: "VND";
  readonly operation: "PURCHASE";
  readonly order_description: string;
  readonly order_invoice_number: string;
  readonly customer_id?: string;
  readonly payment_method?: string;
  readonly success_url: string;
  readonly error_url: string;
  readonly cancel_url: string;
  readonly signature: string;
}>;

export type SePayCheckoutRequest = Readonly<{
  readonly actionUrl: typeof SEPAY_CHECKOUT_ACTION_URL;
  readonly fields: SePayCheckoutFields;
  readonly signature: string;
}>;

const canonicalFields = (input: SePayCheckoutInput): readonly [string, string][] => {
  const fields: [string, string][] = [
    ["order_amount", String(input.orderAmount)],
    ["merchant", input.merchant],
    ["currency", input.currency],
    ["operation", "PURCHASE"],
    ["order_description", input.description],
    ["order_invoice_number", input.invoiceNumber],
  ];
  if (input.customerId !== undefined) fields.push(["customer_id", input.customerId]);
  if (input.paymentMethod !== undefined) fields.push(["payment_method", input.paymentMethod]);
  fields.push(
    ["success_url", input.successUrl],
    ["error_url", input.errorUrl],
    ["cancel_url", input.cancelUrl],
  );
  return fields;
};

export const buildSePayCheckoutRequest = (input: SePayCheckoutInput): SePayCheckoutRequest => {
  if (!Number.isSafeInteger(input.orderAmount) || input.orderAmount <= 0) {
    throw new Error("SePay VND amounts must be positive safe integers");
  }
  const fields = canonicalFields(input);
  const signature = createHmac("sha256", input.secret)
    .update(fields.map(([key, value]) => `${key}=${value}`).join(","))
    .digest("base64");
  const formFields: SePayCheckoutFields = {
    order_amount: String(input.orderAmount),
    merchant: input.merchant,
    currency: input.currency,
    operation: "PURCHASE",
    order_description: input.description,
    order_invoice_number: input.invoiceNumber,
    ...(input.customerId === undefined ? {} : { customer_id: input.customerId }),
    ...(input.paymentMethod === undefined ? {} : { payment_method: input.paymentMethod }),
    success_url: input.successUrl,
    error_url: input.errorUrl,
    cancel_url: input.cancelUrl,
    signature,
  };
  return { actionUrl: SEPAY_CHECKOUT_ACTION_URL, fields: formFields, signature };
};
