import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { approvedKoreanBackfillUpdates, koreanBackfillChunks } from "@/lib/korean-backfill/apply";
import { productionApplyErrorMessage } from "@/lib/korean-backfill/production-error";
import { env } from "@/lib/env";

const artifactSha256 = "fff127514982159e899ad915ce2b0c0d13b6bba0cba5ed1358e58b55264d7226";
const artifactPath = join(process.cwd(), "artifacts", "korean-backfill", "repaired", "drafts.jsonl");
const chunkSize = 250;

const runIdSchema = z.string().uuid();
const outcomeSchema = z.object({ outcome: z.enum(["applied", "skipped_nonempty", "skipped_already_applied", "missing"]) });

type Counts = {
  applied: number;
  skipped: number;
  missing: number;
};

function addOutcomes(counts: Counts, outcomes: readonly z.infer<typeof outcomeSchema>[]): Counts {
  for (const { outcome } of outcomes) {
    switch (outcome) {
      case "applied":
        counts.applied += 1;
        break;
      case "skipped_nonempty":
      case "skipped_already_applied":
        counts.skipped += 1;
        break;
      case "missing":
        counts.missing += 1;
        break;
    }
  }
  return counts;
}

async function main(): Promise<void> {
  const content = await readFile(artifactPath, "utf8");
  const updates = approvedKoreanBackfillUpdates(content, artifactSha256);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rawRunId, error: startError } = await client.rpc("start_korean_backfill_run", {
    p_artifact_sha256: artifactSha256,
    p_planned_count: updates.length,
  });
  if (startError) {
    throw startError;
  }
  const runId = runIdSchema.parse(rawRunId);
  const counts: Counts = { applied: 0, skipped: 0, missing: 0 };

  for (const updatesChunk of koreanBackfillChunks(updates, chunkSize)) {
    const { data, error } = await client.rpc("apply_korean_backfill_chunk", {
      p_run_id: runId,
      p_updates: updatesChunk.map(({ id, table, column, value }) => ({ id, table, column, value })),
    });
    if (error) {
      throw error;
    }
    addOutcomes(counts, z.array(outcomeSchema).parse(data));
  }

  const { error: finishError } = await client.rpc("finish_korean_backfill_run", {
    p_run_id: runId,
    p_applied_count: counts.applied,
    p_skipped_count: counts.skipped,
    p_missing_count: counts.missing,
  });
  if (finishError) {
    throw finishError;
  }

  process.stdout.write(`${JSON.stringify({ runId, ...counts, total: updates.length })}\n`);
}

void main().catch((error: unknown) => {
  // no-excuse-ok: catch boundary reports the production command failure before exit.
  process.stderr.write(`${productionApplyErrorMessage(error)}\n`);
  process.exitCode = 1;
});
