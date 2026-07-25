export type SePayPaymentState = "awaiting_customer" | "paid" | "customer_left" | "manual_review";

export type PaymentEventKind = "payment_verified" | "payment_cancelled";

export type SePayPaymentRecord = Readonly<{
  readonly orderId: string;
  readonly merchantReference: string;
  readonly state: SePayPaymentState;
  readonly events: ReadonlyMap<string, PaymentEventKind>;
}>;

export type ApplyPaymentEventResult =
  | Readonly<{ readonly kind: "applied"; readonly record: SePayPaymentRecord }>
  | Readonly<{ readonly kind: "duplicate"; readonly record: SePayPaymentRecord }>
  | Readonly<{ readonly kind: "conflict"; readonly record: SePayPaymentRecord }>
  | Readonly<{ readonly kind: "ignored"; readonly record: SePayPaymentRecord }>;

export const createPaymentRecord = (input: Readonly<{ readonly orderId: string; readonly merchantReference: string }>): SePayPaymentRecord => ({
  orderId: input.orderId,
  merchantReference: input.merchantReference,
  state: "awaiting_customer",
  events: new Map(),
});

const nextState = (state: SePayPaymentState, event: PaymentEventKind): SePayPaymentState | null => {
  switch (state) {
    case "awaiting_customer":
      switch (event) {
        case "payment_verified":
          return "paid";
        case "payment_cancelled":
          return "customer_left";
      }
    case "paid":
    case "customer_left":
    case "manual_review":
      return null;
  }
};

export const applyPaymentEvent = (input: Readonly<{
  readonly record: SePayPaymentRecord;
  readonly providerEventId: string;
  readonly kind: PaymentEventKind;
}>): ApplyPaymentEventResult => {
  const previousEvent = input.record.events.get(input.providerEventId);
  if (previousEvent === input.kind) return { kind: "duplicate", record: input.record };
  if (previousEvent !== undefined) {
    return {
      kind: "conflict",
      record: { ...input.record, state: "manual_review" },
    };
  }

  const state = nextState(input.record.state, input.kind);
  if (state === null) return { kind: "ignored", record: input.record };
  const events = new Map(input.record.events);
  events.set(input.providerEventId, input.kind);
  return { kind: "applied", record: { ...input.record, state, events } };
};
