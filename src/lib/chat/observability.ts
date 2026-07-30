import "server-only";

import { createHash } from "node:crypto";

import { shoppingIntentFingerprint, type ShoppingIntent } from "./shopping-intent";

export type ChatTimingSnapshot = Readonly<{
  intentMs: number;
  retrievalMs: number;
  firstBlockMs: number;
  finalMs: number;
}>;

export type PublicChatTelemetry = Readonly<{
  queryFingerprint: string;
  catalogRevision: string;
  locale: ShoppingIntent["locale"];
  intentKind: ShoppingIntent["kind"];
  appliedFilters: Readonly<Record<string, readonly string[] | string | number>>;
  resultCount: number;
  timing: ChatTimingSnapshot;
  fallbackCode?: string;
}>;

function boundedMilliseconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function appliedFiltersFromIntent(intent: ShoppingIntent): Readonly<Record<string, readonly string[] | string | number>> {
  const filters: Record<string, readonly string[] | string | number> = {
    availability: intent.availability,
    sort: intent.sort,
    limit: intent.limit,
  };
  const arrayFields = [
    ["productFamilies", intent.productFamilies],
    ["subtypes", intent.subtypes],
    ["categories", intent.categories],
    ["rooms", intent.rooms],
    ["brands", intent.brands],
    ["designers", intent.designers],
    ["collections", intent.collections],
    ["colors", intent.colors],
    ["materials", intent.materials],
  ] as const;
  for (const [key, values] of arrayFields) {
    if (values.length > 0) filters[key] = values;
  }
  if (intent.minPrice !== undefined) filters.minPrice = intent.minPrice;
  if (intent.maxPrice !== undefined) filters.maxPrice = intent.maxPrice;
  return filters;
}

export function buildPublicChatTelemetry(input: Readonly<{
  intent: ShoppingIntent;
  catalogRevision: string;
  resultCount: number;
  timing: ChatTimingSnapshot;
  fallbackCode?: string;
}>): PublicChatTelemetry {
  const safeCatalogRevision = input.catalogRevision.slice(0, 128);
  const queryFingerprint = createHash("sha256")
    .update(shoppingIntentFingerprint(input.intent, safeCatalogRevision))
    .digest("hex");
  return {
    queryFingerprint,
    catalogRevision: safeCatalogRevision,
    locale: input.intent.locale,
    intentKind: input.intent.kind,
    appliedFilters: appliedFiltersFromIntent(input.intent),
    resultCount: Math.max(0, Math.trunc(input.resultCount)),
    timing: {
      intentMs: boundedMilliseconds(input.timing.intentMs),
      retrievalMs: boundedMilliseconds(input.timing.retrievalMs),
      firstBlockMs: boundedMilliseconds(input.timing.firstBlockMs),
      finalMs: boundedMilliseconds(input.timing.finalMs),
    },
    ...(input.fallbackCode === undefined ? {} : { fallbackCode: input.fallbackCode.slice(0, 80) }),
  };
}

/** Logs only structured, non-question telemetry; never log raw prompts or secrets. */
export function recordPublicChatTelemetry(telemetry: PublicChatTelemetry): void {
  if (process.env.NODE_ENV === "test") return;
  console.info("[public-chat.telemetry]", JSON.stringify(telemetry));
}
