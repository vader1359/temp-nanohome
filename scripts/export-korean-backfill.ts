import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  koreanBackfillRecords,
  type KoreanBackfillExportRecord,
  type KoreanBackfillExportRow,
  type KoreanBackfillTable,
} from "@/lib/korean-backfill/exporter";
import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { Database } from "@/types/database.types";

const pageSize = 500;
const outputPath = join(process.cwd(), "artifacts", "korean-backfill", "backfill-input.jsonl");

type Page = {
  readonly data: readonly KoreanBackfillExportRow[] | null;
  readonly error: unknown;
};

type ReadPage = (start: number, end: number) => Promise<Page>;

async function exportTable(
  table: KoreanBackfillTable,
  readPage: ReadPage,
): Promise<readonly KoreanBackfillExportRecord[]> {
  const records: KoreanBackfillExportRecord[] = [];

  for (let page = 0; ; page += 1) {
    const start = page * pageSize;
    const { data, error } = await readPage(start, start + pageSize - 1);

    if (error !== null) {
      throw error;
    }

    const rows = data ?? [];
    for (const row of rows) {
      records.push(...koreanBackfillRecords({ table, row }));
    }

    if (rows.length < pageSize) {
      return records;
    }
  }
}

const tables: readonly KoreanBackfillTable[] = [
  "brands",
  "catalogs",
  "categories",
  "news",
  "products",
  "variants",
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const message = Reflect.get(error, "message");
    if (typeof message === "string") {
      return message;
    }
  }
  return String(error);
}

function readPageFor(table: KoreanBackfillTable): ReadPage {
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: supabaseReadOnlyFetch,
    },
  });

  switch (table) {
    case "brands":
      return async (start, end) =>
        client.from("brands").select().order("id", { ascending: true }).range(start, end);
    case "catalogs":
      return async (start, end) =>
        client.from("catalogs").select().order("id", { ascending: true }).range(start, end);
    case "categories":
      return async (start, end) =>
        client.from("categories").select().order("id", { ascending: true }).range(start, end);
    case "news":
      return async (start, end) =>
        client.from("news").select().order("id", { ascending: true }).range(start, end);
    case "products":
      return async (start, end) =>
        client.from("products").select().order("id", { ascending: true }).range(start, end);
    case "variants":
      return async (start, end) =>
        client.from("variants").select().order("id", { ascending: true }).range(start, end);
  }
}

async function main(): Promise<void> {
  const allRecords: KoreanBackfillExportRecord[] = [];

  for (const table of tables) {
    allRecords.push(...(await exportTable(table, readPageFor(table))));
  }

  const contents = allRecords.map((record) => JSON.stringify(record)).join("\n");
  await mkdir(join(process.cwd(), "artifacts", "korean-backfill"), { recursive: true });
  await writeFile(outputPath, contents === "" ? "" : `${contents}\n`, "utf8");
  process.stdout.write(`Exported ${allRecords.length} Korean backfill records to ${outputPath}\n`);
}

void main().catch((error: unknown) => {
  // no-excuse-ok: catch boundary reports command failures before exit.
  process.stderr.write(`Korean backfill export failed: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
