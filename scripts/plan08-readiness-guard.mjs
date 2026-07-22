#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const failures = [];

const documents = [
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-build-manifest.md",
    markers: [
      "# Plan 08 Build Manifest — Integrated Local Staging",
      "LOCAL STAGING INTEGRATED",
      "LIVE ACTIVATION BLOCKED",
      "codex/ai-commerce-staging",
      "codex/commerce-payment-amis-v3",
      "cd158cca",
      "Plan 00",
      "Plan 01",
      "Plan 02",
      "Plan 03",
      "Plan 04",
      "Plan 05",
      "Plan 06",
      "Plan 07",
      "Plan 08",
      "default off",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-conflict-matrix.md",
    markers: [
      "# Plan 08 Conflict Matrix — Integrated Local Staging",
      "src/lib/contracts/ports.ts",
      "supabase/plan00-local/run-clean-reset.sh",
      "MERGED_LOCAL",
      "BLOCKED_EXTERNAL",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/08-local-readiness-runbook.md",
    markers: [
      "# Plan 08 Local Staging Validation Runbook",
      "pnpm run test:plan08-readiness-guard",
      "pnpm test",
      "pnpm exec tsc --noEmit",
      "pnpm run build",
      "No remote mutation",
    ],
  },
  {
    path: "docs/plans/ai-commerce-personalization-v2/handoffs/08-handoff.md",
    markers: [
      "# Plan 08 Handoff — Integrated Local Staging",
      "codex/ai-commerce-staging",
      "Plan 02 v3",
      "No push, deploy, production enablement, or remote database change",
    ],
  },
];

const requiredArtifacts = [
  "docs/plans/ai-commerce-personalization-v2/handoffs/00-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/01-handoff.md",
  "docs/handoffs/worktree-02-commerce-payment-amis.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/03-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/04-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/05-product-recommendations-phase1-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/06-handoff.md",
  "docs/plans/ai-commerce-personalization-v2/handoffs/07-handoff.md",
  "src/lib/catalog/eligibility.ts",
  "src/lib/customer-context/repository.ts",
  "src/app/api/commerce/checkout/route.ts",
  "src/lib/amis-customer-memory/customer-memory-port.ts",
  "src/app/api/chat/route.ts",
  "src/lib/recommendations/service.ts",
  "src/lib/vision/service.ts",
  "src/lib/personalization/index.ts",
  "scripts/plan08-readiness-guard.mjs",
];

const expectedMigrations = [
  "20260721010000_plan00_catalog_eligibility.sql",
  "20260721020000_plan01_customer_data_foundation.sql",
  "20260721020500_plan01_customer_persistence_controls.sql",
  "20260721021000_plan01_customer_persistence_rpc.sql",
  "20260721022000_plan01_customer_persistence_hardening.sql",
  "20260721023000_plan01_identity_race_hardening.sql",
  "20260721024000_plan03_amis_customer_memory.sql",
  "20260721030000_add_commerce_checkout_ledger.sql",
  "20260721050000_plan04_grounded_chat_persistence.sql",
  "20260721070000_plan06_vision_persistence.sql",
  "20260721080000_plan07_customer_personalization.sql",
];

const defaultOffEvidence = [
  {
    path: "src/lib/commerce/feature-gates.ts",
    markers: ["amisSaleOrderDraftEnabled === true", "manualRefundEnabled === true"],
  },
  {
    path: "src/app/api/chat/route.ts",
    markers: ['process.env.CHAT_ENABLED === "true"'],
  },
  {
    path: "src/lib/vision/config.ts",
    markers: ["uploadEnabled: false", "roomAnalysisEnabled: false", "visualSimilarityEnabled: false"],
  },
  {
    path: "src/lib/personalization/index.ts",
    markers: ["personalizationEnabled: false", "recentlyViewedEnabled: false", "customerMemoryEnabled: false"],
  },
];

const forbiddenClaims = [
  "live payment verified",
  "remote migrations applied",
  "production enabled",
  "provider verified",
  "amis tenant verified",
];

function requireFile(path, description = "required integrated artifact is missing") {
  if (!existsSync(join(root, path))) failures.push(`${path}: ${description}`);
}

for (const artifact of requiredArtifacts) requireFile(artifact);

for (const document of documents) {
  const path = join(root, document.path);
  if (!existsSync(path)) {
    failures.push(`${document.path}: required staging document is missing`);
    continue;
  }
  const content = readFileSync(path, "utf8");
  for (const marker of document.markers) {
    if (!content.includes(marker)) failures.push(`${document.path}: missing marker ${JSON.stringify(marker)}`);
  }
  for (const claim of forbiddenClaims) {
    if (content.toLowerCase().includes(claim)) failures.push(`${document.path}: unsupported claim ${JSON.stringify(claim)}`);
  }
}

const migrationsDirectory = join(root, "supabase/migrations");
if (!existsSync(migrationsDirectory)) {
  failures.push("supabase/migrations: migration directory is missing");
} else {
  for (const migration of expectedMigrations) requireFile(`supabase/migrations/${migration}`, "expected merged migration is missing");
  const versions = new Map();
  for (const filename of readdirSync(migrationsDirectory)) {
    const match = filename.match(/^(20260721\d{6})_.*\.sql$/);
    if (match === null) continue;
    const existing = versions.get(match[1]);
    if (existing !== undefined) failures.push(`supabase/migrations: duplicate version ${match[1]} in ${existing} and ${filename}`);
    versions.set(match[1], filename);
  }
}

for (const evidence of defaultOffEvidence) {
  const path = join(root, evidence.path);
  if (!existsSync(path)) {
    failures.push(`${evidence.path}: default-off evidence file is missing`);
    continue;
  }
  const content = readFileSync(path, "utf8");
  for (const marker of evidence.markers) {
    if (!content.includes(marker)) failures.push(`${evidence.path}: missing default-off marker ${JSON.stringify(marker)}`);
  }
}

const envPath = join(root, "src/lib/env.ts");
if (!existsSync(envPath)) {
  failures.push("src/lib/env.ts: server environment schema is missing");
} else {
  const envContent = readFileSync(envPath, "utf8");
  for (const marker of ["DEEPSEEK_API_KEY: optionalEnvString", "DEEPSEEK_MODEL:"]) {
    if (!envContent.includes(marker)) failures.push(`src/lib/env.ts: missing server-only chat configuration ${JSON.stringify(marker)}`);
  }
  for (const publicSecret of ["NEXT_PUBLIC_DEEPSEEK", "NEXT_PUBLIC_ZALOPAY", "NEXT_PUBLIC_AMIS_CLIENT_SECRET", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]) {
    if (envContent.includes(publicSecret)) failures.push(`src/lib/env.ts: secret must not be public: ${publicSecret}`);
  }
}

const packagePath = join(root, "package.json");
if (!existsSync(packagePath)) {
  failures.push("package.json: missing");
} else {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  if (packageJson.scripts?.["test:plan08-readiness-guard"] !== "node scripts/plan08-readiness-guard.mjs") {
    failures.push("package.json: missing test:plan08-readiness-guard script");
  }
}

if (failures.length > 0) {
  console.error("Plan 08 integrated staging guard failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Plan 08 integrated staging guard passed (${requiredArtifacts.length} artifacts, ${expectedMigrations.length} migrations, and default-off boundaries checked).`);
