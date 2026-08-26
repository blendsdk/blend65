/** Git ancestor before failure-reduction production code entered the repository. */
export const rd05PreimplementationAncestor = "7f1f9944890143c4e381173b055b42f048f0666f";

/** New readiness production modules that require per-file branch coverage. */
export const rd05CoverageFiles = Object.freeze([
  "src/failure-campaign-budget.ts",
  "src/failure-contracts.ts",
  "src/failure-identity.ts",
]);

/** Existing readiness modules with explicitly reviewed failure-reduction changes. */
export const rd05ParticipatingExistingFiles = Object.freeze(["src/canonical-identity.ts"]);

/** Generated or barrel files reviewed through freshness checks instead of runtime coverage. */
export const rd05ReviewOnlyExclusions = Object.freeze(["src/index.ts"]);
