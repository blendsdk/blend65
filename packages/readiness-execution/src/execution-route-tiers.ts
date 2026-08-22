import type { ExecutionTierV1 } from "@blend65/readiness";

const NO_PREREQUISITES: readonly ExecutionTierV1[] = Object.freeze([]);
const FRONTEND_PREREQUISITE: readonly ExecutionTierV1[] = Object.freeze(["frontend"]);
const EMIT_PREREQUISITES: readonly ExecutionTierV1[] = Object.freeze(["frontend", "compiler-api"]);
const ACME_PREREQUISITES: readonly ExecutionTierV1[] = Object.freeze([
  "frontend",
  "compiler-api",
  "emit",
]);
const VICE_PREREQUISITES: readonly ExecutionTierV1[] = Object.freeze([
  "frontend",
  "compiler-api",
  "emit",
  "acme",
]);
const TIER_INDEX: ReadonlyMap<ExecutionTierV1, number> = new Map([
  ["frontend", 0],
  ["compiler-api", 1],
  ["cli", 2],
  ["emit", 3],
  ["acme", 4],
  ["vice", 5],
]);
const PREREQUISITES: Readonly<Record<ExecutionTierV1, readonly ExecutionTierV1[]>> = Object.freeze({
  frontend: NO_PREREQUISITES,
  "compiler-api": FRONTEND_PREREQUISITE,
  cli: FRONTEND_PREREQUISITE,
  emit: EMIT_PREREQUISITES,
  acme: ACME_PREREQUISITES,
  vice: VICE_PREREQUISITES,
});

/** Compares closed execution tiers by route cost without locale-sensitive collation. */
export function compareExecutionTierV1(left: ExecutionTierV1, right: ExecutionTierV1): number {
  return (
    (TIER_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (TIER_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Returns the immutable prerequisite closure for one terminal execution tier. */
export function getExecutionPrerequisiteTiersV1(tier: ExecutionTierV1): readonly ExecutionTierV1[] {
  return PREREQUISITES[tier];
}
