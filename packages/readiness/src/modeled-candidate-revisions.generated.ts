import type { Sha256Digest } from "./model-registry-model.js";

/** Checked-in dependency authority for one freshness-gated candidate entrypoint. */
export interface GeneratedCandidateRevision {
  /** Exact production entry module. */
  readonly entryPath: string;
  /** Lexically ordered complete production-module dependency closure. */
  readonly dependencyPaths: readonly string[];
  /** Revision derived from the exact checked-in closure bytes. */
  readonly claimedRevision: Sha256Digest;
}

/** Generated revision authority shared by the three modeled generator callables. */
export const MODELED_GENERATOR_REVISION: GeneratedCandidateRevision = Object.freeze({
  entryPath: "packages/readiness/src/modeled-generators.ts",
  dependencyPaths: Object.freeze([
    "packages/readiness/src/boundary-variants.ts",
    "packages/readiness/src/canonical-identity.ts",
    "packages/readiness/src/fragment-model.ts",
    "packages/readiness/src/generation-budget.ts",
    "packages/readiness/src/generator-input-inspection.ts",
    "packages/readiness/src/generator-ir-expression-parser.ts",
    "packages/readiness/src/generator-ir-legacy-semantics.ts",
    "packages/readiness/src/generator-ir-parser-common.ts",
    "packages/readiness/src/generator-ir-validator.ts",
    "packages/readiness/src/generator-ir.ts",
    "packages/readiness/src/limits.ts",
    "packages/readiness/src/model-registry-model.ts",
    "packages/readiness/src/model.ts",
    "packages/readiness/src/modeled-case-builder.ts",
    "packages/readiness/src/modeled-construction-templates.ts",
    "packages/readiness/src/modeled-generator-facts.ts",
    "packages/readiness/src/modeled-generator-model.ts",
    "packages/readiness/src/modeled-generator-suite.ts",
    "packages/readiness/src/modeled-generators.ts",
    "packages/readiness/src/modeled-operation-registry.ts",
    "packages/readiness/src/programmatic-input.ts",
    "packages/readiness/src/rule-model-input.ts",
    "packages/readiness/src/rule-model-registry.ts",
    "packages/readiness/src/rule-model-validator.ts",
    "packages/readiness/src/strict-json.ts",
    "packages/readiness/src/structured-ir-call-graph.ts",
    "packages/readiness/src/structured-ir-diagnostics.ts",
    "packages/readiness/src/structured-ir-input.ts",
    "packages/readiness/src/structured-ir-semantic-diagnostics.ts",
    "packages/readiness/src/structured-ir-semantic-types.ts",
    "packages/readiness/src/structured-ir-semantics.ts",
    "packages/readiness/src/structured-ir-usage.ts",
    "packages/readiness/src/structured-ir-validation.ts",
  ]),
  claimedRevision: "sha256:007abb1d91cbfd94be588e2c7a063a07b32f19359d23b1f60dd5a38ccbad0793",
});

/** Generated revision authority for the boundary-transform callable. */
export const MODELED_BOUNDARY_REVISION: GeneratedCandidateRevision = Object.freeze({
  entryPath: "packages/readiness/src/boundary-variants.ts",
  dependencyPaths: Object.freeze([
    "packages/readiness/src/boundary-variants.ts",
    "packages/readiness/src/generator-input-inspection.ts",
    "packages/readiness/src/generator-ir-expression-parser.ts",
    "packages/readiness/src/generator-ir-legacy-semantics.ts",
    "packages/readiness/src/generator-ir-parser-common.ts",
    "packages/readiness/src/generator-ir-validator.ts",
    "packages/readiness/src/generator-ir.ts",
    "packages/readiness/src/structured-ir-call-graph.ts",
    "packages/readiness/src/structured-ir-diagnostics.ts",
    "packages/readiness/src/structured-ir-semantic-diagnostics.ts",
    "packages/readiness/src/structured-ir-semantic-types.ts",
    "packages/readiness/src/structured-ir-semantics.ts",
  ]),
  claimedRevision: "sha256:0ed259a48f4d0880138bf2437fd6a842a27cd6bedbc4bb7b9c08bc94a98ee4d0",
});
