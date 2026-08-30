/** Git ancestor before failure-reduction production code entered the repository. */
export const rd05PreimplementationAncestor = "7f1f9944890143c4e381173b055b42f048f0666f";

/** New readiness production modules that require per-file branch coverage. */
export const rd05CoverageFiles = Object.freeze([
  "src/failure-campaign-budget.ts",
  "src/failure-claim-witness.ts",
  "src/failure-contracts.ts",
  "src/failure-envelope.ts",
  "src/failure-envelope-codec.ts",
  "src/failure-envelope-history.ts",
  "src/failure-envelope-identity.ts",
  "src/failure-envelope-malformed-history.ts",
  "src/failure-envelope-model.ts",
  "src/failure-envelope-records.ts",
  "src/failure-envelope-transform-history.ts",
  "src/failure-identity.ts",
  "src/failure-reducer.ts",
  "src/failure-reduction-internals.ts",
  "src/failure-transform-catalog.ts",
  "src/failure-trace-authority.ts",
  "src/failure-transformation-drafts.ts",
  "src/failure-transformation-model.ts",
  "src/malformed-diagnostic-case.ts",
  "src/reduction-candidate-validation.ts",
  "src/reduction-candidate.ts",
  "src/reduction-value.ts",
  "src/utf8-byte-boundaries.ts",
]);

/** Existing readiness modules with explicitly reviewed failure-reduction changes. */
export const rd05ParticipatingExistingFiles = Object.freeze([
  "src/canonical-identity.ts",
  "src/published-diagnostic-case.ts",
  "src/published-oracle-campaign.ts",
  "src/published-oracle-context.ts",
  "src/published-oracle-evaluation.ts",
  "src/published-oracle-state.ts",
]);

/** Generated or barrel files reviewed through freshness checks instead of runtime coverage. */
export const rd05ReviewOnlyExclusions = Object.freeze([
  "src/index.ts",
  "src/oracle-candidate-revisions.generated.ts",
  "src/publication-authority-revision.generated.ts",
  "src/published-oracle.ts",
]);
