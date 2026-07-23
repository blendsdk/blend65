import { compareOrdinal, compareStringTuples } from "./authority-order.js";
import type { ReadinessBlockingReason } from "./model.js";

const KIND_ORDER = {
  "blocked-errata": 0,
  "unresolved-source-conflict": 1,
  "unbound-handler": 2,
  "unbound-evidence-capability": 3,
} as const;

/** Returns readiness blockers in their stable public order. */
export function sortBlockingReasons(
  reasons: readonly ReadinessBlockingReason[],
): readonly ReadinessBlockingReason[] {
  return [...reasons].sort(
    (left, right) =>
      KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
      compareOrdinal(left.identity, right.identity) ||
      compareStringTuples(left.sourcePaths, right.sourcePaths),
  );
}

/** Produces lexical unique source paths without mutating the input. */
export function uniquePaths(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)].sort(compareOrdinal);
}
