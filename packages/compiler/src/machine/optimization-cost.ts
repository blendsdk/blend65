/** Exact, bounded, symbolic or honestly unavailable cycle term. */
export type OptimizationCycleMeasurement =
  | { readonly kind: "exact"; readonly value: number }
  | { readonly kind: "range"; readonly minimum: number; readonly maximum: number }
  | {
      readonly kind: "symbolic";
      readonly expression: string;
      readonly variables: readonly {
        readonly name: string;
        readonly minimum: number;
        readonly maximum: number;
      }[];
    }
  | { readonly kind: "unknown" };

/** Complete B/R/T vector used by all modes. */
export interface OptimizationCostVector {
  readonly programBytes: number;
  readonly pathCycles: readonly {
    readonly pathId: string;
    readonly cycles: OptimizationCycleMeasurement;
  }[];
  readonly resources: readonly {
    readonly kind: "standard";
    readonly id: "zeroPage" | "residentRam" | "hardwareStack" | "scratch";
    readonly value: number;
  }[];
}

/** One stable candidate identity and its closed vector. */
export interface OptimizationCandidate {
  readonly id: string;
  readonly cost: OptimizationCostVector;
}

/** One comparison result; no hidden weights or guessed frequency. */
export type CostComparison =
  | { readonly kind: "less" }
  | { readonly kind: "equal" }
  | { readonly kind: "greater" }
  | { readonly kind: "incomparable"; readonly components: readonly string[] };

/** Selection result for size, speed or balanced. */
export type OptimizationSelection =
  | {
      readonly kind: "selected";
      readonly candidateId: string;
      readonly tieBreak: "none" | "stableId";
      readonly incomparableComponents: readonly string[];
    }
  | { readonly kind: "none"; readonly incomparableComponents: readonly string[] };

type Mode = "size" | "speed" | "balanced";
type ResourceId = OptimizationCostVector["resources"][number]["id"];

const RESOURCE_ORDER: readonly ResourceId[] = [
  "zeroPage",
  "residentRam",
  "hardwareStack",
  "scratch",
];

/** Return the comparable numeric bounds of one measurement, or null when unknown. */
function bounds(
  measurement: OptimizationCycleMeasurement,
): { readonly minimum: number; readonly maximum: number } | null {
  if (measurement.kind === "exact")
    return { minimum: measurement.value, maximum: measurement.value };
  if (measurement.kind === "range")
    return { minimum: measurement.minimum, maximum: measurement.maximum };
  if (measurement.kind === "symbolic") {
    if (measurement.variables.length === 0) return null;
    return {
      minimum: Math.min(...measurement.variables.map(({ minimum }) => minimum)),
      maximum: Math.max(...measurement.variables.map(({ maximum }) => maximum)),
    };
  }
  return null;
}

/** Compare two measurements, treating an unknown or overlapping term as incomparable. */
function compareMeasurement(
  left: OptimizationCycleMeasurement,
  right: OptimizationCycleMeasurement,
): number | null {
  if (left.kind === "unknown" || right.kind === "unknown") return null;
  if (
    left.kind === "symbolic" &&
    right.kind === "symbolic" &&
    left.expression === right.expression &&
    JSON.stringify(left.variables) === JSON.stringify(right.variables)
  )
    return 0;
  const leftBounds = bounds(left);
  const rightBounds = bounds(right);
  if (leftBounds === null || rightBounds === null) return null;
  if (leftBounds.maximum < rightBounds.minimum) return -1;
  if (leftBounds.minimum > rightBounds.maximum) return 1;
  if (
    leftBounds.minimum === leftBounds.maximum &&
    rightBounds.minimum === rightBounds.maximum &&
    leftBounds.minimum === rightBounds.minimum
  )
    return 0;
  if (
    left.kind === "range" &&
    right.kind === "range" &&
    left.minimum === right.minimum &&
    left.maximum === right.maximum
  )
    return 0;
  return null;
}

/** Compare path-cycle vectors after checking that both cover the same semantic paths. */
function compareCycles(
  left: OptimizationCostVector,
  right: OptimizationCostVector,
): CostComparison {
  const leftPaths = new Map(left.pathCycles.map(({ pathId, cycles }) => [pathId, cycles]));
  const rightPaths = new Map(right.pathCycles.map(({ pathId, cycles }) => [pathId, cycles]));
  if (
    leftPaths.size !== left.pathCycles.length ||
    rightPaths.size !== right.pathCycles.length ||
    leftPaths.size !== rightPaths.size ||
    [...leftPaths.keys()].some((pathId) => !rightPaths.has(pathId))
  ) {
    const ids = [...new Set([...leftPaths.keys(), ...rightPaths.keys()])].sort();
    return { kind: "incomparable", components: ids.map((pathId) => `T:${pathId}`) };
  }
  // The cycle vector is worst-to-best, independent of declaration order.
  const ordered = (paths: Map<string, OptimizationCycleMeasurement>) =>
    [...paths.entries()].sort(([leftId, leftCycles], [rightId, rightCycles]) => {
      const leftBound = bounds(leftCycles);
      const rightBound = bounds(rightCycles);
      if (leftBound === null || rightBound === null) return leftId.localeCompare(rightId);
      return rightBound.maximum - leftBound.maximum || leftId.localeCompare(rightId);
    });
  const leftOrdered = ordered(leftPaths);
  const rightOrdered = ordered(rightPaths);
  const incomparable: string[] = [];
  for (let index = 0; index < leftOrdered.length; index += 1) {
    const [pathId, leftCycles] = leftOrdered[index]!;
    const [, rightCycles] = rightOrdered[index]!;
    const compared = compareMeasurement(leftCycles, rightCycles);
    if (compared === null) incomparable.push(`T:${pathId}`);
    else if (compared !== 0) return compared < 0 ? { kind: "less" } : { kind: "greater" };
  }
  return incomparable.length > 0
    ? { kind: "incomparable", components: incomparable }
    : { kind: "equal" };
}

/** Return resources in the fixed comparison order, rejecting a different set. */
function resourceValues(cost: OptimizationCostVector): ReadonlyMap<ResourceId, number> | null {
  const values = new Map<ResourceId, number>();
  for (const resource of cost.resources) {
    if (values.has(resource.id)) return null;
    values.set(resource.id, resource.value);
  }
  return values.size === RESOURCE_ORDER.length && RESOURCE_ORDER.every((id) => values.has(id))
    ? values
    : null;
}

/** Compare the fixed resource vector. */
function compareResources(
  left: OptimizationCostVector,
  right: OptimizationCostVector,
): CostComparison {
  const leftValues = resourceValues(left);
  const rightValues = resourceValues(right);
  if (leftValues === null || rightValues === null)
    return {
      kind: "incomparable",
      components: RESOURCE_ORDER.map((id) => `R:${id}`),
    };
  for (const id of RESOURCE_ORDER) {
    const leftValue = leftValues.get(id)!;
    const rightValue = rightValues.get(id)!;
    if (leftValue < rightValue) return { kind: "less" };
    if (leftValue > rightValue) return { kind: "greater" };
  }
  return { kind: "equal" };
}

/** Compare one complete vector under the selected mode's exact order. */
export function compareOptimizationCosts(
  mode: Mode,
  left: OptimizationCostVector,
  right: OptimizationCostVector,
): CostComparison {
  if (mode === "balanced") {
    const bytes = left.programBytes - right.programBytes;
    const resources = compareResources(left, right);
    const cycles = compareCycles(left, right);
    return bytes === 0 && resources.kind === "equal" && cycles.kind === "equal"
      ? { kind: "equal" }
      : {
          kind: "incomparable",
          components: [
            ...(bytes === 0 ? [] : ["B"]),
            ...(resources.kind === "equal"
              ? []
              : resources.kind === "incomparable"
                ? resources.components
                : []),
            ...(cycles.kind === "equal"
              ? []
              : cycles.kind === "incomparable"
                ? cycles.components
                : []),
          ],
        };
  }
  if (mode === "size") {
    if (left.programBytes < right.programBytes) return { kind: "less" };
    if (left.programBytes > right.programBytes) return { kind: "greater" };
    const resources = compareResources(left, right);
    if (resources.kind !== "equal") return resources;
    return compareCycles(left, right);
  }
  const cycles = compareCycles(left, right);
  if (cycles.kind !== "equal") return cycles;
  const resources = compareResources(left, right);
  if (resources.kind !== "equal") return resources;
  if (left.programBytes < right.programBytes) return { kind: "less" };
  if (left.programBytes > right.programBytes) return { kind: "greater" };
  return { kind: "equal" };
}

/** Return whether left is weakly no worse and strictly better somewhere. */
function dominates(left: OptimizationCandidate, right: OptimizationCandidate): boolean {
  if (left.cost.programBytes > right.cost.programBytes) return false;
  let strict = left.cost.programBytes < right.cost.programBytes;
  const leftResources = resourceValues(left.cost);
  const rightResources = resourceValues(right.cost);
  if (leftResources === null || rightResources === null) return false;
  for (const id of RESOURCE_ORDER) {
    const leftValue = leftResources.get(id)!;
    const rightValue = rightResources.get(id)!;
    if (leftValue > rightValue) return false;
    strict ||= leftValue < rightValue;
  }
  const leftPaths = new Map(left.cost.pathCycles.map(({ pathId, cycles }) => [pathId, cycles]));
  const rightPaths = new Map(right.cost.pathCycles.map(({ pathId, cycles }) => [pathId, cycles]));
  if (
    leftPaths.size !== rightPaths.size ||
    [...leftPaths.keys()].some((pathId) => !rightPaths.has(pathId))
  )
    return false;
  for (const [pathId, leftCycles] of leftPaths) {
    const compared = compareMeasurement(leftCycles, rightPaths.get(pathId)!);
    if (compared === null || compared > 0) return false;
    strict ||= compared < 0;
  }
  return strict;
}

/** Select one candidate without inventing a preference for a real tradeoff. */
export function selectOptimizationCandidate(
  mode: Mode,
  baseline: OptimizationCandidate,
  candidates: readonly OptimizationCandidate[],
): OptimizationSelection {
  const all = [baseline, ...candidates];
  if (mode === "balanced") {
    const winner = all.find(
      (candidate) =>
        candidate !== baseline &&
        dominates(candidate, baseline) &&
        all.every((other) => other === candidate || dominates(candidate, other)),
    );
    if (winner !== undefined)
      return {
        kind: "selected",
        candidateId: winner.id,
        tieBreak: "none",
        incomparableComponents: [],
      };
    if (all.every((other) => other === baseline || dominates(baseline, other)))
      return {
        kind: "selected",
        candidateId: baseline.id,
        tieBreak: "none",
        incomparableComponents: [],
      };
    return {
      kind: "none",
      incomparableComponents: ["B", ...RESOURCE_ORDER.map((id) => `R:${id}`)],
    };
  }
  let best = baseline;
  let tied: OptimizationCandidate[] = [baseline];
  const incomparable: string[] = [];
  for (const candidate of candidates) {
    const compared = compareOptimizationCosts(mode, best.cost, candidate.cost);
    if (compared.kind === "incomparable") {
      incomparable.push(...compared.components);
      continue;
    }
    if (compared.kind === "less") continue;
    if (compared.kind === "greater") {
      best = candidate;
      tied = [candidate];
      continue;
    }
    tied.push(candidate);
  }
  if (incomparable.length > 0 && best === baseline)
    return { kind: "none", incomparableComponents: [...new Set(incomparable)].sort() };
  const exactTied = [best, ...tied.filter((candidate) => candidate !== best)].filter(
    (candidate) => compareOptimizationCosts(mode, best.cost, candidate.cost).kind === "equal",
  );
  const sortedIds = [...new Set(exactTied.map(({ id }) => id))].sort();
  return {
    kind: "selected",
    candidateId: sortedIds[0]!,
    tieBreak: sortedIds.length > 1 ? "stableId" : "none",
    incomparableComponents: [],
  };
}
