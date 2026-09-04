/** Structured execution tiers exercised before emulator acceptance. */
export const STRUCTURED_EXECUTION_TIERS = ["frontend", "compiler-api", "emit", "acme"] as const;

/** Existing route prerequisites for each structured execution tier. */
export const STRUCTURED_ROUTE_PREREQUISITES = {
  frontend: [],
  "compiler-api": ["frontend"],
  emit: ["frontend", "compiler-api"],
  acme: ["frontend", "compiler-api", "emit"],
} as const;

/** Exact semantic outcomes accepted from the existing handlers for the combined program. */
export const STRUCTURED_TIER_RESULT_CODES = {
  frontend: ["pass", "diagnostic-mismatch", "compiler-ice"],
  "compiler-api": ["pass", "diagnostic-mismatch", "compiler-ice"],
  emit: ["pass", "diagnostic-mismatch", "unexpected-emission", "compiler-ice", "emission-failure"],
  acme: ["pass", "emission-failure", "assembler-failure", "tier-unavailable"],
} as const;

/** Bounded existing execution policy used by the public route tests. */
export const STRUCTURED_EXECUTION_POLICY = {
  revision: "execution-policy-v1",
  budget: {
    operationMs: 1_000,
    launchAttemptMs: 1_000,
    routeMs: 10_000,
    cleanupGraceMs: 1_000,
    outputBytes: 1_048_576,
    evidenceBytes: 16_777_216,
    instructions: 10_000_000,
    cycles: 100_000_000,
    launchAttempts: 2,
  },
} as const;

/** Primary semantic rule carried by each route for the combined structured program. */
export const STRUCTURED_PRIMARY_RULE_ID =
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end";
