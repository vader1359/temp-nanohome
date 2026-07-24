import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type VariantRow = {
  readonly id: string;
  readonly sku: string | null;
  readonly name: string;
  readonly size: string | null;
  readonly validated: boolean;
  readonly updated_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const apply = process.argv.includes("--apply");
const unknownSize = "Không rõ";
const expectedMissingCount = 43;
const usmSkus = new Set(
  Array.from({ length: 17 }, (_, index) => `USM Haller Cabinet No.${index + 1}`),
);
const artifactDirectory = path.resolve(
  process.cwd(),
  "outputs/product-size-audit",
  `mark-unknown-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

async function rest<T>(query: URLSearchParams, init: RequestInit = {}): Promise<T> {
  const url = new URL("/rest/v1/variants", SUPABASE_URL);
  url.search = query.toString();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY!}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Variants request failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  await mkdir(artifactDirectory, { recursive: true });

  const missing = await rest<VariantRow[]>(
    new URLSearchParams({
      select: "id,sku,name,size,validated,updated_at",
      size: "is.null",
      order: "name.asc",
      limit: "1000",
    }),
  );
  const missingUsm = missing.filter((row) => row.sku !== null && usmSkus.has(row.sku));
  const foundUsmSkus = new Set(missingUsm.map(({ sku }) => sku));
  const absentUsmSkus = [...usmSkus].filter((sku) => !foundUsmSkus.has(sku));

  const preflight = {
    expectedMissingCount,
    actualMissingCount: missing.length,
    expectedUsmCount: usmSkus.size,
    actualUsmCount: missingUsm.length,
    absentUsmSkus,
    allUsmCurrentlyValidated: missingUsm.every(({ validated }) => validated),
  };
  await writeFile(
    path.join(artifactDirectory, "before.json"),
    JSON.stringify({ preflight, variants: missing }, null, 2),
  );

  if (
    missing.length !== expectedMissingCount
    || missingUsm.length !== usmSkus.size
    || absentUsmSkus.length > 0
  ) {
    throw new Error(`Preflight mismatch; no changes made. ${JSON.stringify(preflight)}`);
  }

  const changed: VariantRow[] = [];
  const stale: VariantRow[] = [];
  if (apply) {
    for (const row of missing) {
      const isUsm = row.sku !== null && usmSkus.has(row.sku);
      const updated = await rest<VariantRow[]>(
        new URLSearchParams({
          id: `eq.${row.id}`,
          size: "is.null",
          updated_at: `eq.${row.updated_at}`,
        }),
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            size: unknownSize,
            ...(isUsm ? { validated: false } : {}),
          }),
        },
      );
      const result = updated[0];
      if (
        updated.length === 1
        && result?.size === unknownSize
        && (!isUsm || result.validated === false)
      ) {
        changed.push(result);
      } else {
        stale.push(row);
      }
    }
  }

  const targetIds = missing.map(({ id }) => id);
  const verified = targetIds.length === 0
    ? []
    : await rest<VariantRow[]>(
        new URLSearchParams({
          select: "id,sku,name,size,validated,updated_at",
          id: `in.(${targetIds.join(",")})`,
          order: "name.asc",
        }),
      );
  const verification = {
    targetCount: targetIds.length,
    foundCount: verified.length,
    unknownSizeCount: verified.filter(({ size }) => size === unknownSize).length,
    usmCount: verified.filter((row) => row.sku !== null && usmSkus.has(row.sku)).length,
    unvalidatedUsmCount: verified.filter(
      (row) => row.sku !== null && usmSkus.has(row.sku) && row.validated === false,
    ).length,
    staleCount: stale.length,
  };

  await Promise.all([
    writeFile(
      path.join(artifactDirectory, "after.json"),
      JSON.stringify({ apply, verification, variants: verified }, null, 2),
    ),
    writeFile(
      path.join(artifactDirectory, "rollback.json"),
      JSON.stringify(
        missing.map(({ id, sku, name, size, validated }) => ({
          id,
          sku,
          name,
          size,
          validated,
        })),
        null,
        2,
      ),
    ),
  ]);

  process.stdout.write(`${JSON.stringify({
    artifactDirectory,
    apply,
    preflight,
    changedCount: changed.length,
    verification,
  }, null, 2)}\n`);

  if (
    apply
    && (
      changed.length !== expectedMissingCount
      || verification.unknownSizeCount !== expectedMissingCount
      || verification.unvalidatedUsmCount !== usmSkus.size
      || stale.length > 0
    )
  ) {
    throw new Error("Post-update verification failed; inspect the audit artifact.");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
