import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Table = "products" | "variants";
type CatalogRow = { id: string; sku?: string | null; name: string; size: string | null; updated_at: string };
type ModelItem = { id: string; status: "extracted" | "not_found" | "ambiguous"; evidence?: string; confidence?: "high" | "medium" | "low" | number };
type Outcome = CatalogRow & { table: Table; status: string; proposed_size: string | null; evidence?: string; reason?: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const BATCH_SIZE = 25;
const CONCURRENCY = 3;

if (!SUPABASE_URL || !SUPABASE_KEY || !DEEPSEEK_API_KEY) throw new Error("Missing Supabase or DeepSeek server environment");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const artifactDirectory = path.resolve(process.cwd(), "outputs/product-size-audit", new Date().toISOString().replace(/[:.]/g, "-"));

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

function proposedSize(evidence: string): { value?: string; reason?: string } {
  const source = evidence.replace(/×/g, "x");
  const declaredUnits = [...source.matchAll(/\b(mm|cm|m|in|inch|inches)\b|\"/gi)].map((match) => match[0].toLowerCase());
  const uniqueUnits = [...new Set(declaredUnits)];
  if (uniqueUnits.length !== 1) return { reason: uniqueUnits.length === 0 ? "no explicit unit in evidence" : "mixed units in evidence" };
  const unit = uniqueUnits[0]!;
  const axisMatches = [...source.matchAll(/(?:^|[\s,(])((?:W|D|H|SH|AH|DH|TH|CL))\s*[:=]?\s*(\d+(?:[.,]\d+)?)/gi)];
  const parsed = new Map<string, number>();
  for (const match of axisMatches) {
    const axis = match[1]!.toUpperCase();
    const rawNumber = Number(match[2]!.replace(",", "."));
    const millimetres = toMillimetres(rawNumber, unit);
    if (!Number.isFinite(rawNumber) || millimetres === null) return { reason: "unsupported measurement" };
    if (parsed.has(axis) && parsed.get(axis) !== millimetres) return { reason: `conflicting ${axis} values` };
    parsed.set(axis, millimetres);
  }
  if (parsed.size === 0) {
    const ordered = new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(?:x|\\*)\\s*(\\d+(?:[.,]\\d+)?)(?:\\s*(?:x|\\*)\\s*(\\d+(?:[.,]\\d+)?))?\\s*" + unit.replace('"', '\\"'), "i").exec(source);
    if (ordered) {
      const values = ordered.slice(1).filter(Boolean).map((value) => toMillimetres(Number(value.replace(",", ".")), unit));
      if (values.some((value) => value === null)) return { reason: "unsupported ordered measurement" };
      const labels = values.length === 3 ? ["W", "D", "H"] : ["W", "D"];
      return { value: labels.map((label, index) => `${label}${normalizeNumber(values[index]!)} mm`).map((part) => part.replace(/ mm$/, "")).join(" x ") + " mm" };
    }
    const diameter = /(?:Ø|\bdia(?:meter)?\.?\s*)(\d+(?:[.,]\d+)?)/i.exec(source);
    if (!diameter) return { reason: "no labelled dimensions" };
    const millimetres = toMillimetres(Number(diameter[1]!.replace(",", ".")), unit);
    if (millimetres === null) return { reason: "unsupported diameter unit" };
    const h = /(?:^|[\s,(])H\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i.exec(source);
    const height = h ? toMillimetres(Number(h[1]!.replace(",", ".")), unit) : null;
    return { value: height === null ? `Ø${normalizeNumber(millimetres)} mm` : `Ø${normalizeNumber(millimetres)} x H${normalizeNumber(height)} mm` };
  }
  const primary = ["W", "D", "H"].flatMap((axis) => parsed.has(axis) ? `${axis}${normalizeNumber(parsed.get(axis)!)} mm` : []);
  if (primary.length === 0) return { reason: "only auxiliary dimensions found" };
  const auxiliary = ["SH", "AH", "DH", "TH", "CL"].flatMap((axis) => parsed.has(axis) ? `${axis}${normalizeNumber(parsed.get(axis)!)} mm` : []);
  const primaryDisplay = primary.map((part) => part.replace(/ mm$/, "")).join(" x ") + " mm";
  return { value: auxiliary.length === 0 ? primaryDisplay : `${primaryDisplay} (${auxiliary.join(", ")})` };
}

async function rest<T>(table: Table, query: URLSearchParams, init: RequestInit = {}): Promise<T> {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  url.search = query.toString();
  const response = await fetch(url, { ...init, headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY!}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
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
      if (answer.status !== "extracted" || !answer.evidence || !row.name.includes(answer.evidence)) return { ...row, table, status: answer.status === "extracted" ? "exception" : answer.status, proposed_size: null, evidence: answer.evidence, reason: answer.status === "extracted" ? "missing or non-exact evidence" : undefined };
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

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : "unknown error"}\n`); process.exitCode = 1; });
