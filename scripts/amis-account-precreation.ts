import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { z } from "zod";

import {
  buildPrecreationEligibility,
  type AmisPrecreationCustomerSource,
} from "@/lib/amis/customer-precreation";
import {
  createCustomerPrecreationManifest,
  writeCustomerPrecreationManifest,
} from "@/lib/amis/customer-precreation-manifest";

const fixtureSchema = z.object({
  sourceFetchedAt: z.string().datetime({ offset: true }),
  now: z.string().datetime({ offset: true }),
  maxSnapshotAgeMs: z.number().int().nonnegative().default(60 * 60 * 1000),
  sourceWatermark: z.string().min(1).nullable().optional(),
  supportedCountries: z.array(z.string().min(2)).optional(),
  customers: z.array(z.object({
    id: z.string().min(1),
    code: z.string(),
    state: z.enum(["active", "inactive", "deleted", "merged", "unknown"]),
    countryCode: z.string().nullable().optional(),
    phoneValues: z.array(z.string()),
    emailValues: z.array(z.string()),
    optOut: z.boolean().optional(),
    modifiedDate: z.string().datetime({ offset: true }),
  }).strict()),
  existingCustomerIds: z.array(z.string()).default([]),
  existingPhoneDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/u)).default([]),
  existingEmailDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/u)).default([]),
}).strict();

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "dry-run") throw new Error("Only --dry-run is enabled by this local tool");
  if (!isAbsolute(args.fixturePath) || !isAbsolute(args.manifestPath)) {
    throw new Error("Fixture and manifest paths must be absolute");
  }
  const fixtureFile = await stat(args.fixturePath);
  if ((fixtureFile.mode & 0o777) !== 0o600) throw new Error("Fixture file must have mode 0600");
  const auditHmacKey = process.env[args.hmacEnvName];
  if (auditHmacKey === undefined || Buffer.byteLength(auditHmacKey, "utf8") < 32) {
    throw new Error("A dedicated precreation HMAC key is required");
  }

  const parsed = fixtureSchema.safeParse(JSON.parse(await readFile(args.fixturePath, "utf8")));
  if (!parsed.success) throw new Error("Sanitized AMIS fixture is malformed");
  const fixture = parsed.data;
  const eligibility = buildPrecreationEligibility({
    customers: fixture.customers as readonly AmisPrecreationCustomerSource[],
    existingCustomerIds: new Set(fixture.existingCustomerIds),
    existingPhoneDigests: new Set(fixture.existingPhoneDigests),
    existingEmailDigests: new Set(fixture.existingEmailDigests),
    auditHmacKey,
    sourceFetchedAt: fixture.sourceFetchedAt,
    now: fixture.now,
    maxSnapshotAgeMs: fixture.maxSnapshotAgeMs,
    sourceWatermark: fixture.sourceWatermark,
    supportedCountries: fixture.supportedCountries,
  });
  const manifest = createCustomerPrecreationManifest({ eligibility, auditHmacKey });
  await writeCustomerPrecreationManifest(args.manifestPath, manifest);

  console.log(JSON.stringify({
    mode: "dry-run",
    candidateCount: manifest.candidateCount,
    eligibleCount: manifest.eligibleCount,
    rejectionCounts: manifest.rejectionCounts,
    identityIssueCounts: manifest.identityIssueCounts,
    manifestDigest: manifest.manifestDigest,
  }));
}

function parseArgs(args: readonly string[]): Readonly<{
  readonly mode: "dry-run" | "execute";
  readonly fixturePath: string;
  readonly manifestPath: string;
  readonly hmacEnvName: string;
}> {
  let mode: "dry-run" | "execute" = "dry-run";
  let fixturePath: string | null = null;
  let manifestPath: string | null = null;
  let hmacEnvName = "AMIS_CUSTOMER_PRECREATION_HMAC_SECRET";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") mode = "dry-run";
    else if (argument === "--execute") mode = "execute";
    else if (argument === "--fixture") fixturePath = args[++index] ?? null;
    else if (argument === "--manifest") manifestPath = args[++index] ?? null;
    else if (argument === "--hmac-env") hmacEnvName = args[++index] ?? hmacEnvName;
    else throw new Error("Unknown argument");
  }
  if (fixturePath === null || manifestPath === null) {
    throw new Error("Usage: --dry-run --fixture /absolute/fixture.json --manifest /absolute/manifest.json");
  }
  return { mode, fixturePath, manifestPath, hmacEnvName };
}

main().catch(() => {
  console.error("AMIS account precreation dry-run failed");
  process.exitCode = 1;
});
