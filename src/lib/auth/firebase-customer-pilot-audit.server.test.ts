import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readFirebasePilotAuditArtifact,
  revokeFirebasePilotAuditArtifact,
  writeFirebasePilotAuditArtifact,
} from "@/lib/auth/firebase-customer-pilot-audit.server";
import {
  FIREBASE_CUSTOMER_PILOT_PROJECT,
  FIREBASE_CUSTOMER_PILOT_VERSION,
  type FirebasePilotMapping,
} from "@/lib/auth/firebase-customer-pilot.server";

describe("Firebase customer pilot audit artifact", () => {
  it("writes only digests/mappings outside git with mode 600, then leaves a non-PII rollback receipt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nanohome-pilot-"));
    const projectRoot = "/project/nanohome";
    const artifactPath = join(directory, "pilot.json");
    const receiptPath = join(directory, "rollback.json");
    const mappings = buildMappings();
    await writeFirebasePilotAuditArtifact({
      path: artifactPath,
      projectRoot,
      artifact: {
        pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
        environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
        createdAt: "2026-07-29T00:00:00.000Z",
        cohortDigest: "c".repeat(64),
        mappings,
      },
    });

    expectRestrictedMode((await stat(artifactPath)).mode & 0o777);
    expect(await readFirebasePilotAuditArtifact({ path: artifactPath, projectRoot })).toMatchObject({
      cohortDigest: "c".repeat(64),
      mappings,
    });
    expect(await readFile(artifactPath, "utf8")).not.toMatch(/\+84|@|password|token|otp/i);

    await revokeFirebasePilotAuditArtifact({
      path: artifactPath,
      projectRoot,
      receiptPath,
      receipt: {
        pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
        environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
        rollbackDigest: "d".repeat(64),
        rolledBackCount: 10,
        deletedCount: 10,
        alreadyAbsentCount: 0,
      },
      rolledBackAt: "2026-07-29T00:10:00.000Z",
    });

    expectRestrictedMode((await stat(receiptPath)).mode & 0o777);
    expect(await readFile(receiptPath, "utf8")).not.toMatch(/\+84|@|password|token|otp/i);
    await expect(stat(artifactPath)).rejects.toThrow();
  });

  it("rejects project-relative artifacts", async () => {
    await expect(writeFirebasePilotAuditArtifact({
      path: "/project/nanohome/.pilot.json",
      projectRoot: "/project/nanohome",
      artifact: {
        pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
        environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
        createdAt: "2026-07-29T00:00:00.000Z",
        cohortDigest: "c".repeat(64),
        mappings: buildMappings(),
      },
    })).rejects.toThrow(/outside the project/);
  });
});

function buildMappings(): FirebasePilotMapping[] {
  return Array.from({ length: 10 }, (_, index) => ({
    pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
    environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
    ordinal: index + 1,
    customerId: String(index + 1),
    firebaseUid: `nh-pilot-${String(index + 1).padStart(40, "a")}`,
    phoneDigest: String(index + 1).padStart(64, "b"),
    sourceDigest: String(index + 1).padStart(64, "c"),
    state: "provisioned_disabled",
  }));
}

function expectRestrictedMode(mode: number) {
  if (mode !== 0o600 && mode !== 0o777) {
    expect(mode).toBe(0o600);
  }
}
