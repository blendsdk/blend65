/** Public route-planning entry point and its exact passive input contract. */
export { planExecutionRoutesV1 } from "./execution-route-planner.js";
export type { PlanExecutionRoutesInputV1 } from "./execution-route-planner.js";
export {
  deriveExecutionFixtureDigestV1,
  renderExecutionEnvelopeV1,
  validateExecutionFixtureReadbackV1,
  validateRenderedExecutionSourceV1,
} from "./execution-envelope.js";
export type {
  ExecutionFixtureReadbackV1,
  ExecutionValidatedSourceV1,
} from "./execution-envelope.js";
export {
  deriveFinalExecutionIdentityV1,
  derivePrebuildExecutionIdentityV1,
} from "./execution-identity.js";
export {
  resolveExecutionCaseObservationLayoutV1,
  resolveExecutionObservationLayoutV1,
} from "./execution-observation-layout.js";
export {
  classifyExecutionDiagnosticEvidenceV1,
  classifyInvalidCaseEmissionV1,
} from "./execution-evidence-classifiers.js";
export type {
  ExecutionDiagnosticExpectationV1,
  ExecutionEmissionPresenceV1,
} from "./execution-evidence-classifiers.js";
