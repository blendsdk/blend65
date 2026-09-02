/** Git ancestor before failure-reduction production code entered the repository. */
export const rd05PreimplementationAncestor = "7f1f9944890143c4e381173b055b42f048f0666f";

/** New execution production modules that require per-file branch coverage. */
export const rd05CoverageFiles = Object.freeze([
  "src/execution-predicate-contracts.ts",
  "src/execution-report-predicate-association.ts",
  "src/execution-report-provenance.ts",
  "src/execution-route-evidence.ts",
  "src/execution-tool-discovery.ts",
  "src/failure-candidate-route-state.ts",
  "src/failure-confirmation-checkpoints.ts",
  "src/failure-confirmation-comparison.ts",
  "src/failure-confirmation-context.ts",
  "src/failure-confirmation-evaluation.ts",
  "src/failure-confirmation-tools.ts",
  "src/failure-confirmation.ts",
  "src/failure-envelope-from-report-position.ts",
  "src/failure-execution-immutable.ts",
  "src/failure-execution-internals.ts",
  "src/failure-execution-isolation.ts",
  "src/failure-execution-observation.ts",
  "src/failure-execution-operation.ts",
  "src/failure-execution-types.ts",
  "src/failure-predicate-evidence-model.ts",
  "src/failure-predicate-evidence.ts",
  "src/failure-route-adapter.ts",
]);

/** Existing execution modules with explicitly reviewed failure-reduction changes. */
export const rd05ParticipatingExistingFiles = Object.freeze([
  "src/execution-authority-report-publication.ts",
  "src/execution-authority-report.ts",
  "src/execution-diagnostic-classifier.ts",
  "src/execution-envelope.ts",
  "src/execution-live-handlers.ts",
  "src/execution-orchestration.ts",
  "src/execution-readiness-cli.ts",
  "src/execution-route-adapters.ts",
  "src/execution-route-authority.ts",
  "src/execution-route-worker-request.ts",
  "src/execution-supervisor.ts",
  "src/execution-vice-build.ts",
  "src/execution-vice-control-host.ts",
  "src/execution-vice-evaluation.ts",
  "src/execution-vice-runtime.ts",
  "src/execution-worker-executor.ts",
]);

/** Generated, barrel, or specification-support files reviewed outside runtime coverage. */
export const rd05ReviewOnlyExclusions = Object.freeze([
  "src/execution-handler-catalog.generated.ts",
  "src/failure-candidate-execution-spec-support.ts",
  "src/index.ts",
]);
