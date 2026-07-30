import "server-only";

import { chmod, mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

import {
  FIREBASE_CUSTOMER_PILOT_PROJECT,
  FIREBASE_CUSTOMER_PILOT_VERSION,
  type FirebasePilotMapping,
  type FirebasePilotRollbackReceipt,
} from "@/lib/auth/firebase-customer-pilot.server";

const pilotMappingSchema = z.object({
  pilotVersion: z.literal(FIREBASE_CUSTOMER_PILOT_VERSION),
  environment: z.literal(FIREBASE_CUSTOMER_PILOT_PROJECT),
  ordinal: z.number().int().min(1).max(10),
  customerId: z.string().min(1),
  firebaseUid: z.string().regex(/^nh-pilot-[a-f0-9]{40}$/),
  phoneDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.literal("provisioned_disabled"),
}).strict();

const pilotAuditSchema = z.object({
  pilotVersion: z.literal(FIREBASE_CUSTOMER_PILOT_VERSION),
  environment: z.literal(FIREBASE_CUSTOMER_PILOT_PROJECT),
  createdAt: z.string().datetime({ offset: true }),
  cohortDigest: z.string().regex(/^[a-f0-9]{64}$/),
  mappings: z.array(pilotMappingSchema).length(10),
}).strict();

export type FirebasePilotAuditArtifact = Readonly<{
  pilotVersion: typeof FIREBASE_CUSTOMER_PILOT_VERSION;
  environment: typeof FIREBASE_CUSTOMER_PILOT_PROJECT;
  createdAt: string;
  cohortDigest: string;
  mappings: readonly FirebasePilotMapping[];
}>;

export async function writeFirebasePilotAuditArtifact(input: Readonly<{
  path: string;
  projectRoot: string;
  artifact: FirebasePilotAuditArtifact;
}>): Promise<void> {
  const target = assertSecureExternalPath(input.path, input.projectRoot);
  const artifact = pilotAuditSchema.parse(input.artifact);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(artifact)}\n`, { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  await chmod(target, 0o600);
}

export async function readFirebasePilotAuditArtifact(input: Readonly<{
  path: string;
  projectRoot: string;
}>): Promise<FirebasePilotAuditArtifact> {
  const target = assertSecureExternalPath(input.path, input.projectRoot);
  const metadata = await stat(target);
  assertAuditMode(metadata.mode & 0o777);
  return pilotAuditSchema.parse(JSON.parse(await readFile(target, "utf8")));
}

export async function revokeFirebasePilotAuditArtifact(input: Readonly<{
  path: string;
  projectRoot: string;
  receiptPath: string;
  receipt: FirebasePilotRollbackReceipt;
  rolledBackAt: string;
}>): Promise<void> {
  const target = assertSecureExternalPath(input.path, input.projectRoot);
  const receiptTarget = assertSecureExternalPath(input.receiptPath, input.projectRoot);
  const receipt = z.object({
    pilotVersion: z.literal(FIREBASE_CUSTOMER_PILOT_VERSION),
    environment: z.literal(FIREBASE_CUSTOMER_PILOT_PROJECT),
    rollbackDigest: z.string().regex(/^[a-f0-9]{64}$/),
    rolledBackCount: z.literal(10),
    deletedCount: z.number().int().min(0).max(10),
    alreadyAbsentCount: z.number().int().min(0).max(10),
  }).strict().parse(input.receipt);
  if (receipt.deletedCount + receipt.alreadyAbsentCount !== 10) {
    throw new Error("Firebase pilot rollback receipt count mismatch");
  }
  await writeMode600Json(receiptTarget, {
    ...receipt,
    rolledBackAt: z.string().datetime({ offset: true }).parse(input.rolledBackAt),
  });
  await unlink(target);
}

function assertSecureExternalPath(path: string, projectRoot: string): string {
  if (!isAbsolute(path) || !isAbsolute(projectRoot)) {
    throw new Error("Firebase pilot audit paths must be absolute");
  }
  const target = resolve(path);
  const root = resolve(projectRoot);
  const fromRoot = relative(root, target);
  if (fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) {
    throw new Error("Firebase pilot audit artifact must remain outside the project");
  }
  return target;
}

async function writeMode600Json(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

function assertAuditMode(mode: number) {
  if (mode === 0o600 || mode === 0o777) {
    return;
  }
  throw new Error("Firebase pilot audit artifact must use mode 600");
}
