export type PaymentProvider = "sepay";

export type PaymentMode = "off" | "enabled";

export type PaymentAttempt = Readonly<{
  readonly orderId: string;
  readonly merchantReference: string;
  readonly provider: PaymentProvider;
  readonly amount: number;
  readonly currency: string;
}>;

const verifiedPaymentEvidenceKey = Symbol("verified-payment-evidence");

export type VerifiedPaymentEvidence = Readonly<{
  readonly provider: PaymentProvider;
  readonly merchantReference: string;
  readonly providerTransactionId: string;
  readonly amount: number;
  readonly currency: string;
  readonly [verifiedPaymentEvidenceKey]: true;
}>;

export type PaymentCreationResult =
  | Readonly<{ readonly kind: "payment_disabled"; readonly orderId: string }>
  | Readonly<{ readonly kind: "payment_created"; readonly attempt: PaymentAttempt; readonly redirectUrl: string }>
  | Readonly<{ readonly kind: "payment_ambiguous"; readonly attempt: PaymentAttempt }>;

export type PaymentGateway = Readonly<{
  readonly createPayment: (attempt: PaymentAttempt) => Promise<PaymentCreationResult>;
  readonly retrievePayment: (attempt: PaymentAttempt) => Promise<unknown>;
  readonly cancelUnpaid: (attempt: PaymentAttempt) => Promise<unknown>;
  readonly verifyNotification: (input: Readonly<{ readonly rawBody: string; readonly secret: string }>) => unknown;
}>;

export const createPaymentDisabledResult = (orderId: string): PaymentCreationResult => ({
  kind: "payment_disabled",
  orderId,
});

export const createVerifiedPaymentEvidence = (
  input: Omit<VerifiedPaymentEvidence, typeof verifiedPaymentEvidenceKey>,
): VerifiedPaymentEvidence => ({
  ...input,
  [verifiedPaymentEvidenceKey]: true,
});

export const hasVerifiedPaymentEvidence = (value: unknown): value is VerifiedPaymentEvidence =>
  typeof value === "object" && value !== null && Reflect.get(value, verifiedPaymentEvidenceKey) === true;
