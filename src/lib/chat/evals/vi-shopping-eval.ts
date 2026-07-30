import { z } from "zod";

import { parseShoppingIntent, type ShoppingIntent } from "../shopping-intent";
import type { RequiredShoppingFilters, VietnameseShoppingCase } from "./vi-shopping-cases";

export type EvalCatalogRecord = Readonly<{
  variantId: string;
  familyKeys?: readonly string[];
  subtypeKeys?: readonly string[];
  categoryKeys?: readonly string[];
  roomKeys?: readonly string[];
  brandKeys?: readonly string[];
  designerKeys?: readonly string[];
  collectionKeys?: readonly string[];
  materialKeys?: readonly string[];
  colorKeys?: readonly string[];
  price?: number;
  priceMode?: "fixed" | "contact" | "unavailable";
  stockState?: "available" | "unknown" | "unavailable";
}>;

export const shoppingEvalReportSchema = z.object({
  caseId: z.string().min(1),
  intentKind: z.string().min(1),
  clarification: z.boolean(),
  cardCount: z.number().int().nonnegative(),
  latencyMs: z.number().finite().nonnegative().optional(),
  passed: z.boolean(),
  failures: z.array(z.string()),
}).strict();

export type ShoppingEvalReport = z.infer<typeof shoppingEvalReportSchema>;

export const shoppingEvalSummarySchema = z.object({
  totalCases: z.number().int().nonnegative(),
  passedCases: z.number().int().nonnegative(),
  passRate: z.number().finite().min(0).max(1),
  latencySamples: z.number().int().nonnegative(),
  p95LatencyMs: z.number().finite().nonnegative(),
  failuresByCode: z.record(z.string().min(1), z.number().int().positive()),
}).strict();

export type ShoppingEvalSummary = z.infer<typeof shoppingEvalSummarySchema>;

function sameValues(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function checkRequiredFilters(intent: ShoppingIntent, expected: RequiredShoppingFilters): string[] {
  const failures: string[] = [];
  const fields = [
    "productFamilies",
    "subtypes",
    "categories",
    "rooms",
    "brands",
    "designers",
    "collections",
    "colors",
    "materials",
    "availability",
    "sort",
    "minPrice",
    "maxPrice",
  ] as const;
  for (const field of fields) {
    const expectedValue = expected[field];
    if (expectedValue === undefined) continue;
    const actualValue = intent[field];
    if (Array.isArray(expectedValue)) {
      if (!sameValues(actualValue as readonly string[], expectedValue)) failures.push(`filter:${field}`);
    } else if (actualValue !== expectedValue) {
      failures.push(`filter:${field}`);
    }
  }
  return failures;
}

function recordMatchesRequired(record: EvalCatalogRecord, expected: RequiredShoppingFilters): string[] {
  const failures: string[] = [];
  const checks: readonly [keyof RequiredShoppingFilters, readonly string[] | undefined, readonly string[] | undefined][] = [
    ["productFamilies", record.familyKeys, expected.productFamilies],
    ["subtypes", record.subtypeKeys, expected.subtypes],
    ["categories", record.categoryKeys, expected.categories],
    ["rooms", record.roomKeys, expected.rooms],
    ["brands", record.brandKeys, expected.brands],
    ["designers", record.designerKeys, expected.designers],
    ["collections", record.collectionKeys, expected.collections],
    ["materials", record.materialKeys, expected.materials],
    ["colors", record.colorKeys, expected.colors],
  ];
  for (const [field, actual, required] of checks) {
    if (required === undefined) continue;
    if (actual === undefined || required.some((value) => !actual.includes(value))) failures.push(`record:${field}`);
  }
  if (expected.maxPrice !== undefined && (record.priceMode !== "fixed" || record.price === undefined || record.price > expected.maxPrice)) failures.push("record:maxPrice");
  if (expected.minPrice !== undefined && (record.priceMode !== "fixed" || record.price === undefined || record.price < expected.minPrice)) failures.push("record:minPrice");
  if (expected.availability === "available_only" && record.stockState !== "available") failures.push("record:availability");
  return failures;
}

export function evaluateVietnameseShoppingCase(
  item: VietnameseShoppingCase,
  options: Readonly<{
    records?: readonly EvalCatalogRecord[];
    latencyMs?: number;
  }> = {},
): ShoppingEvalReport {
  const intent = parseShoppingIntent(item.question, item.locale);
  const records = options.records ?? [];
  const failures = [
    ...(intent.kind === item.expectedIntent ? [] : ["intent:kind"]),
    ...checkRequiredFilters(intent, item.requiredFilters),
    ...(item.expectClarification === (intent.kind === "clarification") ? [] : ["intent:clarification"]),
  ];
  if (options.records !== undefined) {
    for (const record of records) {
      const recordFamilies = new Set([
        ...(record.familyKeys ?? []),
        ...(record.subtypeKeys ?? []),
      ]);
      for (const forbidden of item.forbiddenFamilies) {
        if (recordFamilies.has(forbidden)) failures.push(`record:forbidden:${forbidden}`);
      }
      failures.push(...recordMatchesRequired(record, item.requiredFilters).map((failure) => `${failure}:${record.variantId}`));
    }
    if (records.length < item.minCards) failures.push("cards:min");
    if (records.length > item.maxCards) failures.push("cards:max");
    if (item.requiredFilters.sort === "price_asc") {
      if (records.some((record) => record.priceMode !== "fixed")) failures.push("ranking:contact_price");
      const prices = records.map((record) => record.price).filter((price): price is number => price !== undefined);
      if (prices.some((price, index) => index > 0 && price < prices[index - 1]!)) failures.push("ranking:price_asc");
    }
    if (item.requiredFilters.sort === "price_desc") {
      if (records.some((record) => record.priceMode !== "fixed")) failures.push("ranking:contact_price");
      const prices = records.map((record) => record.price).filter((price): price is number => price !== undefined);
      if (prices.some((price, index) => index > 0 && price > prices[index - 1]!)) failures.push("ranking:price_desc");
    }
  }
  if (options.latencyMs !== undefined && options.latencyMs > item.maxLatencyMs) failures.push("latency:max");
  return shoppingEvalReportSchema.parse({
    caseId: item.id,
    intentKind: intent.kind,
    clarification: intent.kind === "clarification",
    cardCount: records.length,
    ...(options.latencyMs === undefined ? {} : { latencyMs: options.latencyMs }),
    passed: failures.length === 0,
    failures: [...new Set(failures)],
  });
}

export function evaluateVietnameseShoppingMatrix(
  cases: readonly VietnameseShoppingCase[],
  options: Readonly<{ latencyMsByCaseId?: Readonly<Record<string, number>> }> = {},
): readonly ShoppingEvalReport[] {
  return cases.map((item) => evaluateVietnameseShoppingCase(item, {
    latencyMs: options.latencyMsByCaseId?.[item.id],
  }));
}

export function summarizeVietnameseShoppingEval(
  reports: readonly ShoppingEvalReport[],
): ShoppingEvalSummary {
  const latencies = reports
    .map((report) => report.latencyMs)
    .filter((latency): latency is number => latency !== undefined)
    .sort((left, right) => left - right);
  const p95Index = latencies.length === 0 ? -1 : Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1);
  const failuresByCode: Record<string, number> = {};
  for (const report of reports) {
    for (const failure of report.failures) failuresByCode[failure] = (failuresByCode[failure] ?? 0) + 1;
  }
  return shoppingEvalSummarySchema.parse({
    totalCases: reports.length,
    passedCases: reports.filter((report) => report.passed).length,
    passRate: reports.length === 0 ? 1 : reports.filter((report) => report.passed).length / reports.length,
    latencySamples: latencies.length,
    p95LatencyMs: p95Index < 0 ? 0 : latencies[p95Index]!,
    failuresByCode,
  });
}
