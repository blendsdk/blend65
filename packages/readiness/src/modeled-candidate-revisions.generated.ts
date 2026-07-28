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
    "packages/readiness/src/bounded-regular-file.ts",
    "packages/readiness/src/canonical-identity.ts",
    "packages/readiness/src/fragment-model.ts",
    "packages/readiness/src/generation-budget.ts",
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
  ]),
  claimedRevision: "sha256:d3bf06430e3b12b44879cf9582d1ad1777e5745dee0986eb6a795b3dd53d8847",
});

/** Generated revision authority for the boundary-transform callable. */
export const MODELED_BOUNDARY_REVISION: GeneratedCandidateRevision = Object.freeze({
  entryPath: "packages/readiness/src/boundary-variants.ts",
  dependencyPaths: Object.freeze([
    "packages/readiness/src/boundary-variants.ts",
    "packages/readiness/src/generator-ir-validator.ts",
    "packages/readiness/src/generator-ir.ts",
  ]),
  claimedRevision: "sha256:d163568b837f6a001ec040b66d9a483cc41cc395020a44f941847288183e257f",
});
