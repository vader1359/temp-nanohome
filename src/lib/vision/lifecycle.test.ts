import { describe, expect, it } from "vitest";

import { transitionLifecycle } from "./lifecycle";

describe("transitionLifecycle", () => {
  it("advances an upload through normalization and analysis to ready", () => {
    // Given: a scene awaiting its first upload.
    const awaitingUpload = { current: "awaiting_upload", event: "upload" };

    // When: each required lifecycle event is applied.
    const uploaded = transitionLifecycle(awaitingUpload);
    const normalizing = transitionLifecycle({ current: "uploaded", event: "normalize" });
    const analyzing = transitionLifecycle({ current: "normalizing", event: "analyze" });
    const ready = transitionLifecycle({ current: "analyzing", event: "succeed" });

    // Then: the lifecycle reaches each Plan 06 state in order.
    expect(uploaded).toEqual({ kind: "valid", state: "uploaded" });
    expect(normalizing).toEqual({ kind: "valid", state: "normalizing" });
    expect(analyzing).toEqual({ kind: "valid", state: "analyzing" });
    expect(ready).toEqual({ kind: "valid", state: "ready" });
  });

  it("branches analysis into low confidence or failure", () => {
    // Given: an active analysis.
    const current = "analyzing";

    // When: confidence is insufficient or the analysis fails.
    const lowConfidence = transitionLifecycle({ current, event: "low_confidence" });
    const failed = transitionLifecycle({ current, event: "fail" });

    // Then: each terminal analysis outcome is explicit.
    expect(lowConfidence).toEqual({ kind: "valid", state: "low_confidence" });
    expect(failed).toEqual({ kind: "valid", state: "failed" });
  });

  it("deletes every non-deleted lifecycle state", () => {
    // Given: each state that remains eligible for deletion.
    const states = ["awaiting_upload", "uploaded", "normalizing", "analyzing", "ready", "low_confidence", "failed", "expired"] as const;

    // When: a deletion is requested.
    const results = states.map((current) => transitionLifecycle({ current, event: "delete" }));

    // Then: each state enters the deletion lifecycle.
    expect(results).toEqual(states.map(() => ({ kind: "valid", state: "deleting" })));
  });

  it("expires unprocessed uploads before deletion and rejects terminal transitions", () => {
    // Given: upload-phase states and an already deleted scene.
    const uploaded = { current: "uploaded", event: "expire" };
    const awaitingUpload = { current: "awaiting_upload", event: "expire" };

    // When: their expiry and terminal transitions are requested.
    const uploadedExpired = transitionLifecycle(uploaded);
    const awaitingUploadExpired = transitionLifecycle(awaitingUpload);
    const deleted = transitionLifecycle({ current: "deleting", event: "deleted" });
    const terminal = transitionLifecycle({ current: "deleted", event: "delete" });

    // Then: expiry leads to deletion while terminal states reject further events.
    expect(uploadedExpired).toEqual({ kind: "valid", state: "expired" });
    expect(awaitingUploadExpired).toEqual({ kind: "valid", state: "expired" });
    expect(deleted).toEqual({ kind: "valid", state: "deleted" });
    expect(terminal).toEqual({ kind: "invalid_transition" });
  });

  it("uses the explicit deleted event to finish deletion", () => {
    // Given: a scene whose deletion has started.
    const current = "deleting";

    // When: the deletion worker reports completion.
    const result = transitionLifecycle({ current, event: "deleted" });

    // Then: the scene reaches its terminal deleted state.
    expect(result).toEqual({ kind: "valid", state: "deleted" });
  });
});
