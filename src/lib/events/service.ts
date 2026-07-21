import { z } from "zod";
import type { ConsentState } from "@/lib/consent/service";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const locale = z.union([z.literal("vi"), z.literal("en"), z.literal("ko")]);
const placement = z.enum(["home", "pdp", "cart", "chat", "room", "search"]);
const safeKey = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
const keyList = z.array(safeKey).max(20);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/).optional();

const eventSchemas = [
  z.object({ name: z.literal("page_viewed"), properties: z.object({ routeKey: z.string().regex(/^\/[a-z0-9/_-]{0,127}$/), locale }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("product_viewed"), properties: z.object({ productId: id, variantId: id, placement }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("search_submitted"), properties: z.object({ filterKeys: keyList, resultCountBucket: z.enum(["0", "1-9", "10-49", "50+"]) }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("recommendation_impression"), properties: z.object({ requestId: id, placement, itemIds: z.array(id).min(1).max(20) }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("recommendation_clicked"), properties: z.object({ requestId: id, itemId: id, rank: z.number().int().min(1).max(100) }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("cart_item_added"), properties: z.object({ variantId: id, sourcePlacement: placement, requestId: id.optional() }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("checkout_started"), properties: z.object({ cartId: id, itemCountBucket: z.enum(["1", "2-4", "5+"]) }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("preference_updated"), properties: z.object({ preferenceKeys: keyList }).strict(), idempotencyKey }).strict(),
  z.object({ name: z.literal("room_analysis_confirmed"), properties: z.object({ analysisId: id, correctionFlags: keyList }).strict(), idempotencyKey }).strict(),
] as const;

const eventSchema = z.discriminatedUnion("name", eventSchemas);
export type CustomerEvent = Readonly<z.infer<typeof eventSchema>>;
export type CustomerEventName = CustomerEvent["name"];
export type CustomerEventIdentity = Readonly<{ visitorId: string; sessionId: string; userId: string | null }>;
export type RecordedCustomerEvent = Readonly<{ name: CustomerEventName; properties: Readonly<Record<string, unknown>>; identity: CustomerEventIdentity; receivedAt: string; idempotencyKey: string }>;
export type EventSink = (event: RecordedCustomerEvent) => void;
export type EventRatePolicy = Readonly<{ limit: number; windowMs: number }>;
export type EventRecordResult = Readonly<{ kind: "accepted" | "duplicate" | "rate_limited" | "consent_denied" | "policy_unavailable" }>;

export const parseCustomerEvent = (input: unknown) => eventSchema.safeParse(input);

const requiredPurposes: Readonly<Record<CustomerEventName, readonly (keyof ConsentState)[]>> = {
  page_viewed: ["analytics"], product_viewed: ["analytics", "personalization"], search_submitted: ["analytics"],
  recommendation_impression: ["personalization"], recommendation_clicked: ["personalization"], cart_item_added: ["essential"],
  checkout_started: ["essential"], preference_updated: ["personalization"], room_analysis_confirmed: ["roomImageProcessing", "personalization"],
};

const hasPurpose = (consent: ConsentState, name: CustomerEventName): boolean => requiredPurposes[name].every((purpose) => purpose === "essential" || consent[purpose] === true);

export const createEventRecorder = (sink: EventSink, policy?: EventRatePolicy) => {
  const counts = new Map<string, Readonly<{ count: number; startedAt: number }>>();
  const seen = new Set<string>();
  return (event: RecordedCustomerEvent, consent: ConsentState): EventRecordResult => {
    if (policy === undefined) return { kind: "policy_unavailable" };
    if (!hasPurpose(consent, event.name)) return { kind: "consent_denied" };
    const now = Date.parse(event.receivedAt);
    const bucket = counts.get(event.identity.sessionId);
    const active = bucket !== undefined && now - bucket.startedAt < policy.windowMs ? bucket : { count: 0, startedAt: now };
    if (active.count >= policy.limit) return { kind: "rate_limited" };
    const scopedKey = `${event.identity.sessionId}:${event.idempotencyKey}`;
    if (seen.has(scopedKey)) return { kind: "duplicate" };
    seen.add(scopedKey);
    counts.set(event.identity.sessionId, { count: active.count + 1, startedAt: active.startedAt });
    sink(event);
    return { kind: "accepted" };
  };
};
