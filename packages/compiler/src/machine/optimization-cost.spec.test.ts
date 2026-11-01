import { describe, expect, it } from "vitest";
import { compareOptimizationCosts, selectOptimizationCandidate } from "./optimization-cost.js";
import type {
  OptimizationCandidate,
  OptimizationCostVector,
  OptimizationCycleMeasurement,
} from "./optimization-cost.js";

type OptimizedMode = "size" | "speed" | "balanced";

type ResourceId = "zeroPage" | "residentRam" | "hardwareStack" | "scratch";

const RESOURCE_ORDER: readonly ResourceId[] = [
  "zeroPage",
  "residentRam",
  "hardwareStack",
  "scratch",
];

/** One exact cycle count. */
function exact(value: number): OptimizationCycleMeasurement {
  return { kind: "exact", value };
}

/** One inclusive bounded cycle count. */
function range(minimum: number, maximum: number): OptimizationCycleMeasurement {
  return { kind: "range", minimum, maximum };
}

/** One formula over a declared integer domain. */
function symbolic(
  expression: string,
  name: string,
  minimum: number,
  maximum: number,
): OptimizationCycleMeasurement {
  return { expression, kind: "symbolic", variables: [{ maximum, minimum, name }] };
}

/** A cycle term whose honest value is unavailable. */
function unknown(): OptimizationCycleMeasurement {
  return { kind: "unknown" };
}

/** Build a complete vector with the fixed resource comparison order. */
function vector(
  programBytes: number,
  cycles: Readonly<Record<string, OptimizationCycleMeasurement>>,
  resources: Readonly<Partial<Record<ResourceId, number>>> = {},
): OptimizationCostVector {
  return {
    programBytes,
    pathCycles: Object.entries(cycles).map(([pathId, measurement]) => ({
      pathId,
      cycles: measurement,
    })),
    resources: RESOURCE_ORDER.map((id) => ({
      id,
      kind: "standard" as const,
      value: resources[id] ?? 0,
    })),
  };
}

/** One stable candidate identity and its closed vector. */
function candidate(id: string, cost: OptimizationCostVector): OptimizationCandidate {
  return { id, cost };
}

/** Comparison kind for compact ordering assertions. */
function compared(
  mode: OptimizedMode,
  left: OptimizationCostVector,
  right: OptimizationCostVector,
): string {
  return compareOptimizationCosts(mode, left, right).kind;
}

describe("optimization cost comparison", () => {
  // Size orders loaded bytes first: a one-byte reduction may win even when the
  // alternative is faster.
  it("should order size candidates by bytes before cycles", () => {
    const smallAndSlow = vector(18, { main: exact(20) });
    const largeAndFast = vector(20, { main: exact(5) });

    expect(compared("size", smallAndSlow, largeAndFast)).toBe("less");
    expect(compared("size", largeAndFast, smallAndSlow)).toBe("greater");
  });

  // After bytes, resources are compared in their fixed physical order.
  it("should order size candidates by resource order after bytes", () => {
    const moreZeroPage = vector(10, { main: exact(10) }, { residentRam: 0, zeroPage: 2 });
    const lessZeroPage = vector(10, { main: exact(10) }, { residentRam: 100, zeroPage: 1 });

    expect(compared("size", lessZeroPage, moreZeroPage)).toBe("less");
  });

  // Last, size compares the semantic cycle vector from worst path to best path.
  it("should order size candidates by their worst-to-best cycle vector", () => {
    const worseWorst = vector(10, { first: exact(10), second: exact(30) });
    const betterWorst = vector(10, { first: exact(11), second: exact(20) });

    expect(compared("size", betterWorst, worseWorst)).toBe("less");
    expect(compared("size", worseWorst, betterWorst)).toBe("greater");
  });

  // Remaining cycle bounds decide after the worst path ties.
  it("should compare the remaining cycle bounds after the worst path ties", () => {
    const left = vector(10, { first: exact(10), second: exact(30) });
    const right = vector(10, { first: exact(20), second: exact(30) });

    expect(compared("size", left, right)).toBe("less");
    expect(compared("speed", left, right)).toBe("less");
  });

  // Cycle paths are compared by value, not by their order in the vector.
  it("should ignore path declaration order", () => {
    const forward: OptimizationCostVector = {
      ...vector(10, {}),
      pathCycles: [
        { pathId: "a", cycles: exact(10) },
        { pathId: "b", cycles: exact(20) },
      ],
    };
    const reversed: OptimizationCostVector = {
      ...vector(10, {}),
      pathCycles: [
        { pathId: "b", cycles: exact(20) },
        { pathId: "a", cycles: exact(10) },
      ],
    };

    expect(compared("size", forward, reversed)).toBe("equal");
  });

  // Speed compares the worst path first, so a larger artifact may still win.
  it("should order speed candidates by cycles before bytes", () => {
    const smallAndSlow = vector(10, { main: exact(30) });
    const largeAndFast = vector(50, { main: exact(10) });

    expect(compared("speed", largeAndFast, smallAndSlow)).toBe("less");
    expect(compared("speed", smallAndSlow, largeAndFast)).toBe("greater");
  });

  // A cycle tie falls through to resource order and then bytes.
  it("should break a speed cycle tie by resources and then bytes", () => {
    const sameCyclesMoreZeroPage = vector(10, { main: exact(10) }, { residentRam: 0, zeroPage: 2 });
    const sameCyclesLessZeroPage = vector(20, { main: exact(10) }, { residentRam: 9, zeroPage: 1 });

    expect(compared("speed", sameCyclesLessZeroPage, sameCyclesMoreZeroPage)).toBe("less");
  });

  // An unknown term cannot be read as zero or as a win when it decides the
  // comparison.
  it("should treat a decisive unknown cycle term as incomparable", () => {
    const left = vector(10, { main: unknown() });
    const right = vector(10, { main: exact(1) });
    const result = compareOptimizationCosts("size", left, right);

    expect(result.kind).toBe("incomparable");
    if (result.kind !== "incomparable") throw new Error("Expected incomparable costs");
    expect(result.components.length).toBeGreaterThan(0);
  });

  // Two identical unknown terms are still unknown, so they cannot become an exact
  // tie for stable-identity selection.
  it("should not treat two unknown terms as an exact tie", () => {
    const left = vector(10, { main: unknown() });
    const right = vector(10, { main: unknown() });

    expect(compared("size", left, right)).toBe("incomparable");
  });

  // Unknown only blocks the comparison when earlier components tie.
  it("should decide on bytes even when a later cycle term is unknown", () => {
    const fewerBytes = vector(9, { main: unknown() });
    const moreBytes = vector(10, { main: unknown() });

    expect(compared("size", fewerBytes, moreBytes)).toBe("less");
  });

  // A bounded term compares exactly when its whole range lies on one side.
  it("should compare a bounded range against an exact term", () => {
    const below = vector(10, { main: range(1, 3) });
    const above = vector(10, { main: range(6, 9) });
    const exactMiddle = vector(10, { main: exact(5) });

    expect(compared("size", below, exactMiddle)).toBe("less");
    expect(compared("size", above, exactMiddle)).toBe("greater");
  });

  // Overlapping ranges have no provable winner and are explicitly incomparable.
  it("should report an overlapping range as incomparable", () => {
    const overlap = compareOptimizationCosts(
      "size",
      vector(10, { main: range(4, 6) }),
      vector(10, { main: exact(5) }),
    );

    expect(overlap.kind).toBe("incomparable");
    if (overlap.kind !== "incomparable") {
      throw new Error("Expected incomparable costs");
    }
    expect(overlap.components.length).toBeGreaterThan(0);
  });

  // A symbolic term is a bounded formula, never an implicit zero.
  it("should not read a symbolic term bounded above zero as zero", () => {
    const bounded = vector(10, { main: symbolic("n", "n", 1, 2) });
    const zero = vector(10, { main: exact(0) });
    const result = compareOptimizationCosts("size", bounded, zero);

    expect(["greater", "incomparable"]).toContain(result.kind);
  });

  // The same symbolic formula denotes the same comparable path cost.
  it("should compare identical symbolic formulas as equal", () => {
    const left = vector(10, { main: symbolic("n", "n", 1, 2) });
    const right = vector(10, { main: symbolic("n", "n", 1, 2) });

    expect(compared("size", left, right)).toBe("equal");
  });

  // Different path classes have no common scale, so they cannot be compared.
  it("should reject a comparison with a different path class set", () => {
    const left = vector(10, { left: exact(1) });
    const right = vector(10, { right: exact(1) });

    expect(compared("size", left, right)).toBe("incomparable");
  });

  // Identical complete vectors are the only exact tie.
  it("should compare identical complete vectors as equal", () => {
    const resources = { hardwareStack: 3, residentRam: 2, scratch: 4, zeroPage: 1 };
    const left = vector(10, { main: exact(5) }, resources);
    const right = vector(10, { main: exact(5) }, resources);

    expect(compared("size", left, right)).toBe("equal");
    expect(compared("speed", left, right)).toBe("equal");
  });
});

describe("optimization candidate selection", () => {
  // Size chooses the smallest bytes even when another candidate is faster.
  it("should select the smallest size candidate", () => {
    const baseline = candidate("baseline", vector(20, { main: exact(10) }));
    const small = candidate("small", vector(18, { main: exact(20) }));
    const fast = candidate("fast", vector(19, { main: exact(5) }));

    expect(selectOptimizationCandidate("size", baseline, [fast, small])).toEqual({
      candidateId: "small",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "none",
    });
  });

  // Speed chooses the best worst-case cycle vector before bytes.
  it("should select the fastest speed candidate", () => {
    const baseline = candidate("baseline", vector(10, { main: exact(30) }));
    const medium = candidate("medium", vector(10, { main: exact(20) }));
    const fastest = candidate("fastest", vector(50, { main: exact(10) }));

    expect(selectOptimizationCandidate("speed", baseline, [medium, fastest])).toEqual({
      candidateId: "fastest",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "none",
    });
  });

  // The baseline participates as an ordinary candidate and is retained when no
  // alternative is better.
  it("should retain the baseline when it is the best candidate", () => {
    const baseline = candidate("baseline", vector(9, { main: exact(10) }));
    const larger = candidate("larger", vector(10, { main: exact(10) }));

    expect(selectOptimizationCandidate("size", baseline, [larger])).toEqual({
      candidateId: "baseline",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "none",
    });
  });

  // Only an identical complete vector permits the mechanical stable-identity tie
  // break, and discovery order must not change the winner.
  it("should break an exact size tie by the smallest stable identity", () => {
    const cost = vector(10, { main: exact(5) });
    const baseline = candidate("z-baseline", cost);
    const first = candidate("a-first", cost);
    const second = candidate("b-second", cost);

    expect(selectOptimizationCandidate("size", baseline, [second, first])).toEqual({
      candidateId: "a-first",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "stableId",
    });
    expect(selectOptimizationCandidate("size", baseline, [first, second])).toEqual({
      candidateId: "a-first",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "stableId",
    });
  });

  // Balanced selects a candidate only when it is weakly no worse on every component
  // and strictly better somewhere.
  it("should select a balanced candidate that dominates every competitor", () => {
    const baseline = candidate("baseline", vector(10, { main: exact(10) }));
    const better = candidate("better", vector(9, { main: exact(9) }));

    expect(selectOptimizationCandidate("balanced", baseline, [better])).toEqual({
      candidateId: "better",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "none",
    });
  });

  // A strict improvement in one component is enough when no component is worse.
  it("should select a balanced candidate that improves only bytes", () => {
    const baseline = candidate("baseline", vector(10, { main: exact(10) }));
    const smaller = candidate("smaller", vector(9, { main: exact(10) }));

    expect(selectOptimizationCandidate("balanced", baseline, [smaller])).toEqual({
      candidateId: "smaller",
      incomparableComponents: [],
      kind: "selected",
      tieBreak: "none",
    });
  });

  // A tradeoff never becomes a hidden preference: balanced reports no candidate.
  it("should report no balanced choice for a tradeoff against the baseline", () => {
    const baseline = candidate("baseline", vector(10, { main: exact(10) }));
    const tradeoff = candidate("tradeoff", vector(9, { main: exact(11) }));
    const selection = selectOptimizationCandidate("balanced", baseline, [tradeoff]);

    expect(selection.kind).toBe("none");
    if (selection.kind !== "none") throw new Error("Expected no balanced selection");
    expect(selection.incomparableComponents.length).toBeGreaterThan(0);
  });

  // A candidate must dominate every feasible competitor, not only the baseline.
  it("should report no balanced choice when candidates trade off with each other", () => {
    const baseline = candidate("baseline", vector(10, { main: exact(10) }));
    const smaller = candidate("smaller", vector(9, { main: exact(10) }));
    const faster = candidate("faster", vector(10, { main: exact(9) }));
    const selection = selectOptimizationCandidate("balanced", baseline, [smaller, faster]);

    expect(selection.kind).toBe("none");
    if (selection.kind !== "none") throw new Error("Expected no balanced selection");
    expect(selection.incomparableComponents.length).toBeGreaterThan(0);
  });
});
