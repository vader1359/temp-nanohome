#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());

const documents = [
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-build-manifest.md",
    markers: [
      "# Plan 08 Build Manifest — Local Integration Readiness",
      "local-only validation",
      "no feature-code transfer",
      "default off",
      "**BLOCKED**",
      "| 00 |",
      "| 01 |",
      "| 02 |",
      "| 03 |",
      "| 04 |",
      "| 05 |",
      "| 06 |",
      "| 07 |",
      "20260721010000_plan00_catalog_eligibility.sql",
      "20260721024000_plan03_amis_customer_memory.sql",
      "20260721050000_plan04_grounded_chat_persistence.sql",
      "20260721070000_plan06_vision_persistence.sql",
      "20260721080000_plan07_customer_personalization.sql",
      "SQL was not locally applied",
      "unavailable live smoke",
      "SQL/Docker unavailable",
      "unapplied SQL",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-conflict-matrix.md",
    markers: [
      "# Plan 08 Conflict Matrix — Local Integration Readiness",
      "READY FOR FUTURE REVIEW",
      "BLOCKED",
      "DEFERRED",
      "CatalogEligibility",
      "CustomerMemory",
      "ChatAnswer",
      "Vietnamese, English, Korean",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-local-readiness-runbook.md",
    markers: [
      "# Plan 08 Local Readiness Runbook",
      "Plan 02 remains absent, vague",
      "Do not run test E2E/browser/sandbox flows",
      "Future-only proof gates",
      "npm run test:plan08-readiness-guard",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/handoffs/08-handoff.md",
    markers: [
      "# Plan 08 Handoff — Local Readiness Artifacts",
      "No feature code",
      "Plan 02 is an incomplete backend-only handoff",
      "future reviewed integration lane",
      "Revert only the scoped readiness-artifact commits",
    ],
  },
];

const forbiddenClaims = [
  "remote migration applied",
  "e2e passed",
  "provider called",
  "sandbox verified",
  "tenant proven",
  "privacy approved",
  "backup proof complete",
  "deployment completed",
  "production enabled",
];

const requiredLocalArtifacts = [
  "docs/plans/ai-commerce-personalization-v2/handoffs/00-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/01-handoff.md",
  "supabase/migrations/20260721010000_plan00_catalog_eligibility.sql",
  "supabase/migrations/20260721020000_plan01_customer_data_foundation.sql",
  "supabase/migrations/20260721020500_plan01_customer_persistence_controls.sql",
  "supabase/migrations/20260721021000_plan01_customer_persistence_rpc.sql",
  "supabase/migrations/20260721022000_plan01_customer_persistence_hardening.sql",
  "supabase/migrations/20260721023000_plan01_identity_race_hardening.sql",
];

const intentionallyUnavailableArtifacts = [
  "docs/plans/ai-commerce-personalization-v2/handoffs/03-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/04-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/05-product-recommendations-phase1-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/06-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/07-handoff.md",
  "supabase/migrations/20260721024000_plan03_amis_customer_memory.sql",
  "supabase/migrations/20260721050000_plan04_grounded_chat_persistence.sql",
  "supabase/migrations/20260721070000_plan06_vision_persistence.sql",
  "supabase/migrations/20260721080000_plan07_customer_personalization.sql",
];

const failures = [];
const migrationVersions = new Set();

if (!existsSync(join(root, "scripts/plan08-readiness-guard.mjs"))) {
  failures.push("scripts/plan08-readiness-guard.mjs: guard target is missing");
}

for (const artifact of requiredLocalArtifacts) {
  if (!existsSync(join(root, artifact))) {
    failures.push(`${artifact}: referenced local receipt or migration is missing`);
  }
}

for (const artifact of intentionallyUnavailableArtifacts) {
  if (existsSync(join(root, artifact))) {
    failures.push(`${artifact}: feature artifact was copied into the Foundation-only worktree`);
  }
}

for (const document of documents) {
  const path = join(root, document.path);
  if (!existsSync(path)) {
    failures.push(`${document.path}: required artifact is missing`);
    continue;
  }

  const content = readFileSync(path, "utf8");

  for (const marker of document.markers) {
    if (!content.includes(marker)) {
      failures.push(`${document.path}: missing marker ${JSON.stringify(marker)}`);
    }
  }

  for (const forbiddenClaim of forbiddenClaims) {
    if (content.toLowerCase().includes(forbiddenClaim)) {
      failures.push(`${document.path}: restricted claim ${JSON.stringify(forbiddenClaim)}`);
    }
  }

  for (const migration of content.matchAll(/(20260721\d{6})_plan\d{2}_[a-z0-9_]+\.sql/g)) {
    if (migrationVersions.has(migration[1])) {
      failures.push(`${document.path}: duplicate migration version ${migration[1]}`);
    }
    migrationVersions.add(migration[1]);
  }
}

const historicalDuplicateVersions = new Set(["20260710000003", "20260711000000"]);
const actualMigrationVersions = new Set();
const migrationsDirectory = join(root, "supabase/migrations");
if (!existsSync(migrationsDirectory)) {
  failures.push("supabase/migrations: migration directory is missing");
} else {
  for (const filename of readdirSync(migrationsDirectory)) {
    const migration = filename.match(/^(20260721\d{6})_plan\d{2}_[a-z0-9_]+\.sql$/);
    if (migration && !historicalDuplicateVersions.has(migration[1])) {
      if (actualMigrationVersions.has(migration[1])) {
        failures.push(`supabase/migrations/${filename}: duplicate migration version ${migration[1]}`);
      }
      actualMigrationVersions.add(migration[1]);
    }
  }
}

const packagePath = join(root, "package.json");
if (!existsSync(packagePath)) {
  failures.push("package.json: required artifact is missing");
} else {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  if (packageJson.scripts?.["test:plan08-readiness-guard"] !== "node scripts/plan08-readiness-guard.mjs") {
    failures.push("package.json: missing test:plan08-readiness-guard script");
  }
}

if (failures.length > 0) {
  console.error("Plan 08 readiness guard failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Plan 08 readiness guard passed (${documents.length} documents and package script checked).`);
