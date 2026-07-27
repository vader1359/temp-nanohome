import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Table = "products" | "variants";
type CatalogRow = { id: string; sku?: string | null; name: string; size: string | null; updated_at: string };
type ModelItem = { id: string; status: "extracted" | "not_found" | "ambiguous"; evidence?: string; confidence?: "high" | "medium" | "low" | number };
type Outcome = CatalogRow & { table: Table; status: string; proposed_size: string | null; evidence?: string; reason?: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const BATCH_SIZE = 25;
const CONCURRENCY = 3;

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const artifactDirectory = path.resolve(process.cwd(), "outputs/product-size-audit", new Date().toISOString().replace(/[:.]/g, "-"));

type Measurement = { values: readonly [number] | readonly [number, number] };
type TextSpan = { start: number; end: number };

const NUMBER_PATTERN = String.raw`\d+(?:[.,]\d+)?`;
const RANGE_SEPARATOR_PATTERN = String.raw`(?:\/|-|–|—|~)`;
const MEASUREMENT_PATTERN = `${NUMBER_PATTERN}(?:\\s*${RANGE_SEPARATOR_PATTERN}\\s*${NUMBER_PATTERN})?`;
const UNIT_PATTERN = String.raw`(?:mm|cm|m|inches|inch|in|")`;
const AXIS_PATTERN = String.raw`(?:SH|AH|DH|TH|CL|W|D|H|L|R|C)`;
const DIAMETER_PATTERN = String.raw`(?:DIAMETER|DIA\.?|DI|DK|Ø|Φ)`;
const MARKER_PATTERN = `(?:${DIAMETER_PATTERN}|${AXIS_PATTERN})`;
const MARKER_PREFIX_PATTERN = String.raw`(?:^|[\s,(;:]|[x*/]\s*)`;

function normalizeNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function toMillimetres(value: number, unit: string): number | null {
  switch (unit.toLowerCase()) {
    case "mm": return value;
    case "cm": return value * 10;
    case "m": return value * 1000;
    case "in": case "inch": case "inches": case "\"": return value * 25.4;
    default: return null;
  }
}

function canonicalUnit(rawUnit: string): string {
  const unit = rawUnit.toLowerCase();
  return unit === "\"" || unit === "inch" || unit === "inches" ? "in" : unit;
}

function unitBearingClauses(source: string): { text: string; start: number; end: number }[] {
  const clauses: { text: string; start: number; end: number }[] = [];
  let clauseStart = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const decimalComma = character === "," && /\d/.test(source[index - 1] ?? "") && /\d/.test(source[index + 1] ?? "");
    if (character !== ";" && character !== "\n" && (character !== "," || decimalComma)) continue;
    clauses.push({ text: source.slice(clauseStart, index), start: clauseStart, end: index });
    clauseStart = index + 1;
  }
  clauses.push({ text: source.slice(clauseStart), start: clauseStart, end: source.length });
  return clauses.filter((clause) => new RegExp(`(?<![a-z])${UNIT_PATTERN}\\b|\"`, "i").test(clause.text));
}

function hasMalformedDimensionNumber(source: string): boolean {
  return unitBearingClauses(source).some(({ text }) => {
    if (/\d+\s*[.,]{2,}\s*\d/u.test(text)) return true;
    if (/\d+\s+[.,]\s*\d|\d+[.,]\s+\d/u.test(text)) return true;
    if (/\d+[.,]\d+[.,]\d+/u.test(text)) return true;
    if (/(?<!\d)[1-9]\d{0,2}[.,]\d{3}(?!\d)/u.test(text)) return true;
    if (new RegExp(`${MARKER_PATTERN}\\s*[:=]?\\s*[.,]\\s*\\d`, "iu").test(text)) return true;
    if (new RegExp(`${MARKER_PATTERN}\\s*[:=]?\\s*\\d+\\s+\\d+`, "iu").test(text)) return true;
    return /\d+\s+\d+\s*(?:x|\*)/iu.test(text);
  });
}

function parseMeasurement(rawMeasurement: string, unit: string): Measurement | null {
  const values = rawMeasurement
    .split(new RegExp(`\\s*${RANGE_SEPARATOR_PATTERN}\\s*`, "u"))
    .map((rawValue) => toMillimetres(Number(rawValue.replace(",", ".")), unit));
  if ((values.length !== 1 && values.length !== 2) || values.some((value) => value === null || !Number.isFinite(value))) return null;
  return values.length === 1
    ? { values: [values[0]!] }
    : { values: [values[0]!, values[1]!] };
}

function measurementsEqual(left: Measurement, right: Measurement): boolean {
  return left.values.length === right.values.length && left.values.every((value, index) => value === right.values[index]);
}

function formatMeasurement(measurement: Measurement): string {
  return measurement.values.map(normalizeNumber).join("/");
}

function markerKind(rawMarker: string): string {
  const marker = rawMarker.toUpperCase();
  return /^(?:DIAMETER|DIA\.?|DI|DK|Ø|Φ)$/u.test(marker) ? "DIAMETER" : marker;
}

function isDimensionRelatedNumber(source: string, span: TextSpan, recognizedSpans: readonly TextSpan[]): boolean {
  if (recognizedSpans.some((recognized) => spanContains(recognized, span))) return true;
  const previous = source.slice(0, span.start).match(/(\S)\s*$/u)?.[1];
  const next = source.slice(span.end).match(/^\s*(\S)/u)?.[1];
  if ((previous && /[x*/\-–—~]/iu.test(previous)) || (next && /[x*/\-–—~]/iu.test(next))) return true;
  return new RegExp(`^\\s*${UNIT_PATTERN}\\b|^\\s*\"`, "iu").test(source.slice(span.end));
}

function numericOccurrences(source: string, recognizedSpans: readonly TextSpan[]): TextSpan[] {
  return unitBearingClauses(source).flatMap((clause) =>
    [...clause.text.matchAll(new RegExp(NUMBER_PATTERN, "gu"))].map((match) => ({
      start: clause.start + match.index!,
      end: clause.start + match.index! + match[0].length,
    })).filter((span) => isDimensionRelatedNumber(source, span, recognizedSpans)),
  );
}

function spanContains(span: TextSpan, candidate: TextSpan): boolean {
  return candidate.start >= span.start && candidate.end <= span.end;
}

function dimensionSignature(source: string): { markers: string[]; numbers: string[] } {
  const markers: string[] = [];
  const numbers: string[] = [];
  const markerRegex = new RegExp(`${MARKER_PREFIX_PATTERN}(${MARKER_PATTERN})\\s*[:=]?\\s*(${MEASUREMENT_PATTERN})`, "giu");
  const normalizedSource = source.replace(/×/gu, "x").replace(/[\u200B-\u200D\uFEFF]/gu, "");
  for (const clause of unitBearingClauses(normalizedSource)) {
    const clauseMarkerSpans: TextSpan[] = [];
    for (const match of clause.text.matchAll(markerRegex)) {
      markers.push(`${markerKind(match[1]!)}:${match[2]!.replaceAll(",", ".").replace(new RegExp(`\\s*${RANGE_SEPARATOR_PATTERN}\\s*`, "gu"), "/")}`);
      clauseMarkerSpans.push({ start: clause.start + match.index!, end: clause.start + match.index! + match[0].length });
    }
    for (const match of clause.text.matchAll(new RegExp(NUMBER_PATTERN, "gu"))) {
      const span = { start: clause.start + match.index!, end: clause.start + match.index! + match[0].length };
      if (isDimensionRelatedNumber(normalizedSource, span, clauseMarkerSpans)) numbers.push(match[0].replace(",", "."));
    }
  }
  return { markers, numbers };
}

function multisetContains(actual: readonly string[], expected: readonly string[]): boolean {
  const counts = new Map<string, number>();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of expected) {
    const available = counts.get(value) ?? 0;
    if (available === 0) return false;
    counts.set(value, available - 1);
  }
  return true;
}

export function hasCompleteDimensionEvidence(name: string, evidence: string): boolean {
  if (!name.includes(evidence)) return false;
  const expected = dimensionSignature(name);
  const actual = dimensionSignature(evidence);
  return multisetContains(actual.markers, expected.markers) && multisetContains(actual.numbers, expected.numbers);
}

export function proposedSize(evidence: string): { value?: string; reason?: string } {
  const source = evidence.replace(/×/gu, "x").replace(/[\u200B-\u200D\uFEFF]/gu, "");
  const declaredUnits = [...source.matchAll(new RegExp(`(?<![a-z])${UNIT_PATTERN}\\b|\"`, "gi"))].map((match) => canonicalUnit(match[0]));
  const uniqueUnits = [...new Set(declaredUnits)];
  if (uniqueUnits.length !== 1) return { reason: uniqueUnits.length === 0 ? "no explicit unit in evidence" : "mixed units in evidence" };
  if (hasMalformedDimensionNumber(source)) return { reason: "malformed decimal dimension requires review" };
  const unit = uniqueUnits[0]!;

  const markerRegex = new RegExp(`${MARKER_PREFIX_PATTERN}(${MARKER_PATTERN})\\s*[:=]?\\s*(${MEASUREMENT_PATTERN})`, "giu");
  const markerMatches = [...source.matchAll(markerRegex)];
  const consumedSpans: TextSpan[] = markerMatches.map((match) => ({ start: match.index!, end: match.index! + match[0].length }));
  const sourceAxes = new Map<string, Measurement>();
  const diameterMeasurements: Measurement[] = [];
  for (const match of markerMatches) {
    const kind = markerKind(match[1]!);
    const measurement = parseMeasurement(match[2]!, unit);
    if (!measurement) return { reason: "unsupported measurement" };
    if (kind === "DIAMETER") {
      diameterMeasurements.push(measurement);
      continue;
    }
    const existing = sourceAxes.get(kind);
    if (existing && !measurementsEqual(existing, measurement)) return { reason: `conflicting ${kind} values` };
    sourceAxes.set(kind, measurement);
  }

  const parsed = new Map<string, Measurement>();
  const setCanonical = (axis: string, value: Measurement | undefined): string | null => {
    if (!value) return null;
    const existing = parsed.get(axis);
    if (existing && !measurementsEqual(existing, value)) return `conflicting canonical ${axis} values`;
    parsed.set(axis, value);
    return null;
  };

  let mappingError: string | null = null;
  let standaloneR: Measurement | undefined;
  if (sourceAxes.has("L")) {
    if (sourceAxes.has("R")) return { reason: "ambiguous L/R axis combination" };
    mappingError ??= setCanonical("W", sourceAxes.get("L"));
    mappingError ??= setCanonical("D", sourceAxes.get("W"));
    mappingError ??= setCanonical("D", sourceAxes.get("D"));
  } else if (sourceAxes.has("D") && sourceAxes.has("R")) {
    if (sourceAxes.has("W")) return { reason: "ambiguous W/D/R axis combination" };
    mappingError ??= setCanonical("W", sourceAxes.get("D"));
    mappingError ??= setCanonical("D", sourceAxes.get("R"));
  } else {
    mappingError ??= setCanonical("W", sourceAxes.get("W"));
    mappingError ??= setCanonical("D", sourceAxes.get("D"));
    if (sourceAxes.has("R")) {
      if (sourceAxes.has("W") || sourceAxes.has("D")) return { reason: "ambiguous standalone R axis" };
      standaloneR = sourceAxes.get("R");
    }
  }
  mappingError ??= setCanonical("H", sourceAxes.get("H"));
  mappingError ??= setCanonical("H", sourceAxes.get("C"));
  for (const axis of ["SH", "AH", "DH", "TH", "CL"]) mappingError ??= setCanonical(axis, sourceAxes.get(axis));
  if (mappingError) return { reason: mappingError };

  let diameter: Measurement | undefined = standaloneR;
  for (const candidate of diameterMeasurements) {
    if (diameter && !measurementsEqual(diameter, candidate)) return { reason: "conflicting diameter values" };
    diameter = candidate;
  }

  const inferredHeightRegex = new RegExp(
    `${MARKER_PREFIX_PATTERN}(${DIAMETER_PATTERN})\\s*[:=]?\\s*${MEASUREMENT_PATTERN}\\s*${UNIT_PATTERN}?\\s*(?:x|\\*)\\s*(?!${MARKER_PATTERN}\\b)(${MEASUREMENT_PATTERN})\\s*${UNIT_PATTERN}?`,
    "giu",
  );
  const inferredHeightMatches = [...source.matchAll(inferredHeightRegex)];
  if (inferredHeightMatches.length > 1) return { reason: "multiple unlabelled diameter heights" };
  if (inferredHeightMatches.length === 1) {
    if (parsed.has("H")) return { reason: "unlabelled axis requires review" };
    const inferredHeight = parseMeasurement(inferredHeightMatches[0]![2]!, unit);
    if (!inferredHeight) return { reason: "unsupported diameter height" };
    parsed.set("H", inferredHeight);
    consumedSpans.push({
      start: inferredHeightMatches[0]!.index!,
      end: inferredHeightMatches[0]!.index! + inferredHeightMatches[0]![0].length,
    });
  }

  if (diameter) {
    const width = parsed.get("W");
    const depth = parsed.get("D");
    if (!width && !depth) {
      parsed.set("W", diameter);
      parsed.set("D", diameter);
    } else if (!width) {
      parsed.set("W", diameter);
    } else if (!depth) {
      parsed.set("D", diameter);
    } else if (!measurementsEqual(width, diameter) || !measurementsEqual(depth, diameter)) {
      return { reason: "diameter conflicts with W and D" };
    }
  }

  if (markerMatches.length === 0) {
    const factorPattern = `${NUMBER_PATTERN}\\s*${UNIT_PATTERN}?`;
    const orderedRegex = new RegExp(
      `(?<![\\d.,/\\-–—~x*])${factorPattern}(?:\\s*(?:x|\\*)\\s*${factorPattern})+(?!\\s*(?:x|\\*)|[\\/\\-–—~]\\s*\\d)`,
      "giu",
    );
    const orderedMatches = [...source.matchAll(orderedRegex)];
    if (orderedMatches.length !== 1) return { reason: orderedMatches.length === 0 ? "no labelled dimensions" : "multiple unlabelled dimension groups" };
    const values = [...orderedMatches[0]![0].matchAll(new RegExp(NUMBER_PATTERN, "gu"))]
      .map((match) => toMillimetres(Number(match[0].replace(",", ".")), unit));
    if (values.length > 3) return { reason: "too many unlabelled dimensions" };
    if (values.length < 2 || values.some((value) => value === null || !Number.isFinite(value))) return { reason: "unsupported ordered measurement" };
    const labels = values.length === 3 ? ["W", "D", "H"] : ["W", "D"];
    labels.forEach((label, index) => parsed.set(label, { values: [values[index]!] }));
    consumedSpans.push({
      start: orderedMatches[0]!.index!,
      end: orderedMatches[0]!.index! + orderedMatches[0]![0].length,
    });
  }

  const unconsumed = numericOccurrences(source, consumedSpans).filter((numberSpan) => !consumedSpans.some((consumed) => spanContains(consumed, numberSpan)));
  if (unconsumed.length > 0) return { reason: "unconsumed dimension token requires review" };

  const primary = ["W", "D", "H"].flatMap((axis) => parsed.has(axis) ? `${axis}${formatMeasurement(parsed.get(axis)!)} mm` : []);
  if (primary.length === 0) return { reason: parsed.size === 0 ? "no labelled dimensions" : "only auxiliary dimensions found" };
  const auxiliary = ["SH", "AH", "DH", "TH", "CL"].flatMap((axis) => parsed.has(axis) ? `${axis}${formatMeasurement(parsed.get(axis)!)} mm` : []);
  const primaryDisplay = primary.map((part) => part.replace(/ mm$/u, "")).join(" x ") + " mm";
  return { value: auxiliary.length === 0 ? primaryDisplay : `${primaryDisplay} (${auxiliary.join(", ")})` };
}

async function rest<T>(table: Table, query: URLSearchParams, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase server environment");
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  url.search = query.toString();
  const response = await fetch(url, { ...init, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`${table} request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function readAll(table: Table): Promise<CatalogRow[]> {
  const rows: CatalogRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ select: table === "variants" ? "id,sku,name,size,updated_at" : "id,name,size,updated_at", order: "id.asc", limit: "1000", offset: String(offset) });
    const page = await rest<CatalogRow[]>(table, query);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}


function unfence(value: string): string { return value.replace(/^```json\s*\n?|\n?```$/g, ""); }

async function deepSeek(items: readonly CatalogRow[]): Promise<ModelItem[]> {
  if (!DEEPSEEK_API_KEY) throw new Error("Missing DeepSeek server environment");
  const body = {
    model: "deepseek-v4-flash", thinking: { type: "disabled" }, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Extract physical dimensions only when explicitly stated in each supplied catalog name. Return ONLY a JSON object shaped as {\"items\":[{\"id\":...,\"status\":\"extracted|not_found|ambiguous\",\"evidence\":\"exact substring from name\",\"confidence\":\"high|medium|low\"}]}. Evidence must include all dimensions and their explicit unit. Never infer values, axes, units, or product facts. If no explicit dimensions occur, use not_found; if dimensions are incomplete or ambiguous, use ambiguous." },
      { role: "user", content: JSON.stringify({ items: items.map(({ id, sku, name }) => ({ id, sku: sku ?? null, name })) }) },
    ],
  };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      if (response.status === 429 || response.status >= 500) { if (attempt < 3) continue; }
      if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status} ${await response.text()}`);
      const envelope = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = envelope.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek response missing content");
      const parsed = JSON.parse(unfence(content)) as { items?: ModelItem[] };
      if (!Array.isArray(parsed.items) || parsed.items.length !== items.length) throw new Error("DeepSeek response has missing items");
      const expected = new Set(items.map((item) => item.id));
      if (new Set(parsed.items.map((item) => item.id)).size !== items.length || parsed.items.some((item) => !expected.has(item.id))) throw new Error("DeepSeek response IDs invalid");
      return parsed.items;
    } catch (error) { if (attempt === 3) throw error; }
    finally { clearTimeout(timer); }
  }
  throw new Error("DeepSeek request exhausted retries");
}

async function mapConcurrent<T, R>(items: readonly T[], mapper: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = []; let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (true) { const index = cursor++; if (index >= items.length) return; result[index] = await mapper(items[index]!); } }));
  return result;
}

async function processTable(table: Table, rows: CatalogRow[]): Promise<Outcome[]> {
  const batches = Array.from({ length: Math.ceil(rows.length / BATCH_SIZE) }, (_, index) => rows.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE));
  let completed = 0;
  const reports = await mapConcurrent(batches, async (batch) => {
    const model = await deepSeek(batch); const byId = new Map(model.map((item) => [item.id, item]));
    completed += 1; process.stderr.write(`${table}: ${completed}/${batches.length} batches\n`);
    return batch.map((row): Outcome => {
      const answer = byId.get(row.id)!;
      if (answer.status !== "extracted" || !answer.evidence || !hasCompleteDimensionEvidence(row.name, answer.evidence)) return { ...row, table, status: answer.status === "extracted" ? "exception" : answer.status, proposed_size: null, evidence: answer.evidence, reason: answer.status === "extracted" ? "missing, non-exact, or incomplete evidence" : undefined };
      const normalized = proposedSize(answer.evidence);
      if (!normalized.value) return { ...row, table, status: "exception", proposed_size: null, evidence: answer.evidence, reason: normalized.reason };
      return { ...row, table, status: normalized.value === row.size ? "unchanged" : "ready", proposed_size: normalized.value, evidence: answer.evidence };
    });
  });
  return reports.flat();
}

async function applyChanges(rows: Outcome[]): Promise<{ applied: string[]; stale: string[] }> {
  const ready = rows.filter((row) => row.status === "ready"); const applied: string[] = []; const stale: string[] = [];
  await mapConcurrent(ready, async (row) => {
    const query = new URLSearchParams({ id: `eq.${row.id}`, updated_at: `eq.${row.updated_at}` });
    const updated = await rest<CatalogRow[]>(row.table, query, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ size: row.proposed_size }) });
    if (updated.length === 1 && updated[0]?.size === row.proposed_size) applied.push(row.id); else stale.push(row.id);
  });
  return { applied, stale };
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !DEEPSEEK_API_KEY) throw new Error("Missing Supabase or DeepSeek server environment");
  await mkdir(artifactDirectory, { recursive: true });
  const [products, variants] = await Promise.all([readAll("products"), readAll("variants")]);
  await writeFile(path.join(artifactDirectory, "catalog-snapshot.json"), JSON.stringify({ products, variants }, null, 2));
  const outcomes = [...await processTable("variants", variants), ...await processTable("products", products)];
  const result = apply ? await applyChanges(outcomes) : { applied: [], stale: [] };
  const exceptions = outcomes.filter((row) => row.status !== "ready" && row.status !== "unchanged");
  await Promise.all([
    writeFile(path.join(artifactDirectory, "size-repair-report.json"), JSON.stringify({ apply, result, outcomes }, null, 2)),
    writeFile(path.join(artifactDirectory, "size-exceptions.json"), JSON.stringify(exceptions, null, 2)),
    writeFile(path.join(artifactDirectory, "rollback.json"), JSON.stringify(outcomes.filter((row) => result.applied.includes(row.id)).map((row) => ({ table: row.table, id: row.id, size: row.size })), null, 2)),
  ]);
  const counts = Object.groupBy(outcomes, (row) => row.status);
  process.stdout.write(JSON.stringify({ artifactDirectory, scanned: outcomes.length, ready: counts.ready?.length ?? 0, unchanged: counts.unchanged?.length ?? 0, exceptions: exceptions.length, ...result }, null, 2) + "\n");
}

const isDirectExecution = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : "unknown error"}\n`); process.exitCode = 1; });
}
