import { describe, expect, it } from "vitest";
import type { CostsEvidence } from "./evidence-types.js";
import { encodeCostsEvidence, validateCostsEvidence } from "./evidence.js";

/** Minimal closed cost vector isolates the rule that none has no optional decisions. */
function costs(): CostsEvidence {
  return {
    kind: "blend65.costs",
    schemaVersion: 1,
    mode: "none",
    totals: {
      programBytes: 0,
      pathCycles: [],
      resources: [
        { kind: "standard", id: "zeroPage", value: 0 },
        { kind: "standard", id: "residentRam", value: 0 },
        { kind: "standard", id: "hardwareStack", value: 0 },
        { kind: "standard", id: "scratch", value: 0 },
      ],
    },
    entries: [],
    decisions: [],
  };
}

describe("direct none decision evidence", () => {
  // The absence of optional decisions is explicit, even when there is no generated code.
  it("should preserve an explicit empty decision list under none", () => {
    const encoded = encodeCostsEvidence(costs());
    expect(encoded.kind).toBe("complete");
    if (encoded.kind !== "complete") throw new Error("Expected canonical costs");
    expect(validateCostsEvidence(encoded.bytes)).toEqual({ kind: "complete", value: costs() });
  });

  // No optional candidate decision is valid in none, regardless of its contents.
  it("should reject any nonempty optimizer decision list under none", () => {
    expect(encodeCostsEvidence({ ...costs(), decisions: [{}] })).toMatchObject({ kind: "error" });
  });
});
