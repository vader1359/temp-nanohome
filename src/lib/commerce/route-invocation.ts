import type { CheckoutResult, CommerceOwner } from "./commerce-local";

type CheckoutBody = Readonly<{
  selections: readonly Readonly<{ variantId: string; quantity: number }>[];
  contact: Readonly<Record<string, string>>;
  idempotencyKey: string;
}>;

export type CheckoutRouteResponse = Readonly<{
  status: 201 | 401 | 404 | 409;
  body: CheckoutResult | Readonly<{ kind: "unauthorized" }>;
}>;

export const invokeCheckoutRoute = async (input: Readonly<{
  body: CheckoutBody;
  owner: CommerceOwner | null;
  checkout: (input: CheckoutBody & { readonly owner: CommerceOwner }) => Promise<CheckoutResult>;
}>): Promise<CheckoutRouteResponse> => {
  if (input.owner === null) return { status: 401, body: { kind: "unauthorized" } };
  const result = await input.checkout({ ...input.body, owner: input.owner });
  switch (result.kind) {
    case "created":
      return { status: 201, body: result };
    case "conflict":
      return { status: 409, body: result };
    case "variant_not_found":
      return { status: 404, body: result };
  }
};
