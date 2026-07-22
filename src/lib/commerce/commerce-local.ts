import { createHash } from "node:crypto";

import { z } from "zod";

import { parseCatalogEligibilityRow } from "@/lib/catalog/eligibility";
import { parseRawSku, parseWarehouseId, type RawSku, type WarehouseId } from "./domain";

export const ownerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id: z.string().min(1) }),
  z.object({ kind: z.literal("guest"), id: z.string().min(1) }),
]);
const selectionSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().positive(), browserSku: z.string().optional(), browserUnitAmount: z.number().optional() });
const contactSchema = z.object({ fullName: z.string().min(1), email: z.string().email(), phone: z.string().min(1), address: z.string().min(1) });
export const cartInputSchema = z.object({ owner: ownerSchema, selections: z.array(selectionSchema).min(1) });
export const checkoutInputSchema = cartInputSchema.extend({ contact: contactSchema, idempotencyKey: z.string().min(1) });

export type CommerceOwner = z.infer<typeof ownerSchema>;
export type CommerceCatalog = Readonly<{ findVariant: (variantId: string) => Promise<unknown> }>;
export type CommerceVariant = Readonly<{ variantId: string; sku: string; unitAmount: number; currency: string; warehouseId: string }>;
export type Cart = Readonly<{ owner: CommerceOwner; items: readonly CartItem[]; totalAmount: number; currency: string; warehouseId: WarehouseId }>;
export type CartItem = Readonly<{ sku: RawSku; quantity: number; unitAmount: number }>;
export type Order = Readonly<{ orderId: string; channel: "WEB"; owner: CommerceOwner; items: readonly OrderItem[]; totalAmount: number; currency: string; warehouseId: WarehouseId; contact: z.infer<typeof contactSchema> }>;
export type OrderItem = Readonly<{ sku: RawSku; quantity: number; unitAmount: number }>;
export type CommerceLocalServices = Readonly<{ cart: Readonly<{ replace: (input: z.infer<typeof cartInputSchema>) => Promise<CartResult> }>; checkout: Readonly<{ create: (input: z.infer<typeof checkoutInputSchema>) => Promise<CheckoutResult> }>; orders: Readonly<{ get: (input: Readonly<{ owner: CommerceOwner; orderId: string }>) => Promise<OrderResult> }> }>;
export type CartResult = Readonly<{ kind: "success"; cart: Cart }> | Readonly<{ kind: "variant_not_found" }>;
export type CheckoutResult = Readonly<{ kind: "created"; order: Order }> | Readonly<{ kind: "conflict" }> | Readonly<{ kind: "variant_not_found" }>;
export type OrderResult = Readonly<{ kind: "found"; order: Order }> | Readonly<{ kind: "not_found" }>;

type Repository = Readonly<{ getById: (orderId: string) => Promise<Order | null>; getByKey: (owner: CommerceOwner, key: string) => Promise<Readonly<{ hash: string; order: Order }> | null>; save: (owner: CommerceOwner, key: string, hash: string, order: Order) => Promise<Order> }>;

const ownerKey = (owner: CommerceOwner): string => `${owner.kind}:${owner.id}`;
const serverVariantSchema = z.object({ variantId: z.string().min(1), sku: z.string().min(1).refine((value) => value.trim().length > 0), unitAmount: z.number().finite().positive(), currency: z.literal("VND"), warehouseId: z.string().min(1).refine((value) => value.trim().length > 0), eligibility: z.unknown() }).strict();
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
};
const stableHash = (value: unknown): string => createHash("sha256").update(JSON.stringify(canonicalize(value)) ?? "").digest("hex");
const createRepository = (): Repository => {
  const orders = new Map<string, Order>();
  const keys = new Map<string, Readonly<{ hash: string; order: Order }>>();
  return {
    async getById(orderId) { return orders.get(orderId) ?? null; },
    async getByKey(owner, key) { return keys.get(`${ownerKey(owner)}:${key}`) ?? null; },
    async save(owner, key, hash, order) { orders.set(order.orderId, order); keys.set(`${ownerKey(owner)}:${key}`, { hash, order }); return order; },
  };
};

export const createCommerceLocalServices = (input: Readonly<{ catalog: CommerceCatalog; repository?: Repository }>): CommerceLocalServices => {
  const repository = input.repository ?? createRepository();
  const resolve = async (owner: CommerceOwner, selections: readonly z.infer<typeof selectionSchema>[]): Promise<Cart | null> => {
    const variants = (await Promise.all(selections.map((selection) => input.catalog.findVariant(selection.variantId)))).map((variant) => serverVariantSchema.safeParse(variant));
    if (variants.some((variant) => !variant.success)) return null;
    const first = variants[0];
    if (first === undefined || !first.success) return null;
    if (variants.some((variant) => {
      if (!variant.success) return true;
      const eligibility = parseCatalogEligibilityRow(variant.data.eligibility);
      if (!eligibility.cart || !eligibility.payment) return true;
      return variant.data.currency !== first.data.currency || variant.data.warehouseId !== first.data.warehouseId;
    })) return null;
    const items = selections.map((selection, index) => {
      const variant = variants[index];
      if (variant === undefined || !variant.success) return null;
      return { sku: parseRawSku(variant.data.sku), quantity: selection.quantity, unitAmount: variant.data.unitAmount };
    });
    if (items.some((item) => item === null)) return null;
    return { owner, items: items.flatMap((item) => item === null ? [] : [item]), totalAmount: items.reduce((total, item) => total + (item?.unitAmount ?? 0) * (item?.quantity ?? 0), 0), currency: first.data.currency, warehouseId: parseWarehouseId(first.data.warehouseId) };
  };
  const replace = async (inputData: z.infer<typeof cartInputSchema>): Promise<CartResult> => { const cart = await resolve(inputData.owner, inputData.selections); return cart === null ? { kind: "variant_not_found" } : { kind: "success", cart }; };
  const create = async (inputData: z.infer<typeof checkoutInputSchema>): Promise<CheckoutResult> => {
    const payloadHash = stableHash({ owner: inputData.owner, selections: inputData.selections.map(({ variantId, quantity }) => ({ variantId, quantity })), contact: inputData.contact });
    const existing = await repository.getByKey(inputData.owner, inputData.idempotencyKey);
    if (existing !== null) return existing.hash === payloadHash ? { kind: "created", order: existing.order } : { kind: "conflict" };
    const cart = await resolve(inputData.owner, inputData.selections);
    if (cart === null) return { kind: "variant_not_found" };
    const order: Order = { orderId: `WEB-${stableHash({ owner: inputData.owner, key: inputData.idempotencyKey }).slice(0, 20)}`, channel: "WEB", owner: inputData.owner, items: cart.items.map((item) => ({ ...item })), totalAmount: cart.totalAmount, currency: cart.currency, warehouseId: cart.warehouseId, contact: inputData.contact };
    await repository.save(inputData.owner, inputData.idempotencyKey, payloadHash, order);
    return { kind: "created", order };
  };
  const get = async (inputData: Readonly<{ owner: CommerceOwner; orderId: string }>): Promise<OrderResult> => { const order = await repository.getById(inputData.orderId); return order === null || ownerKey(order.owner) !== ownerKey(inputData.owner) ? { kind: "not_found" } : { kind: "found", order }; };
  return { cart: { replace }, checkout: { create }, orders: { get } };
};
