import type {
  CommerceLocalServices,
  CommerceOwner,
  CartResult,
  CheckoutResult,
  OrderResult,
} from "./commerce-local";

export type ServerOwnedCommerceRoutes = Readonly<{
  replaceCart: (input: Parameters<CommerceLocalServices["cart"]["replace"]>[0]) => Promise<CartResult | UnauthorizedResult>;
  checkout: (input: Omit<Parameters<CommerceLocalServices["checkout"]["create"]>[0], "owner">) => Promise<CheckoutResult | UnauthorizedResult>;
  getOrder: (orderId: string) => Promise<OrderResult | UnauthorizedResult>;
}>;

export type UnauthorizedResult = Readonly<{ kind: "unauthorized" }>;

export const createServerOwnedCommerceRoutes = (input: Readonly<{
  services: CommerceLocalServices;
  resolveOwner: () => Promise<CommerceOwner | null>;
}>): ServerOwnedCommerceRoutes => {
  const replaceCart = async (request: Parameters<CommerceLocalServices["cart"]["replace"]>[0]): Promise<CartResult | UnauthorizedResult> => {
    const owner = await input.resolveOwner();
    return owner === null ? { kind: "unauthorized" } : input.services.cart.replace({ ...request, owner });
  };
  const checkout = async (request: Omit<Parameters<CommerceLocalServices["checkout"]["create"]>[0], "owner">): Promise<CheckoutResult | UnauthorizedResult> => {
    const owner = await input.resolveOwner();
    return owner === null ? { kind: "unauthorized" } : input.services.checkout.create({ ...request, owner });
  };
  const getOrder = async (orderId: string): Promise<OrderResult | UnauthorizedResult> => {
    const owner = await input.resolveOwner();
    return owner === null ? { kind: "unauthorized" } : input.services.orders.get({ owner, orderId });
  };
  return { replaceCart, checkout, getOrder };
};
