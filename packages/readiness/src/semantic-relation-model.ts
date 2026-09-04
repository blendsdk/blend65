import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import type { StructuredGeneratedModeledCaseV1 } from "./modeled-generator-model.js";
import type { StructuredGenerationBudgetV2 } from "./generator-ir.js";
import type {
  MemoryFixtureV1,
  OracleBudgetV1,
  OracleObservationV1,
  OracleResultV1,
  OracleSuite,
  Rd02ReplayProvenanceV1,
  SemanticRelationId,
} from "./oracle-model.js";
import type { StructuredLoopTraceEntryV2 } from "./structured-oracle-evaluator.js";

/** Closed request accepted by the version-one semantic-relation transform. */
export interface SemanticRelationRequestV1 {
  /** Protocol version. */
  readonly schemaVersion: 1;
  /** Exact transform handler identity. */
  readonly handlerId: "transform.semantic-relations";
  /** Relation selected for this invocation. */
  readonly relationId: SemanticRelationId;
  /** Complete replay identity for the source case. */
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  /** Exact replay-regenerated source case. */
  readonly sourceCase: GeneratedModeledCase;
  /** Unique function evaluated before and after transformation. */
  readonly entryFunction: string;
  /** Canonical JSON pointer selecting one relation operand. */
  readonly selectionPath: string;
  /** Relation-specific closed rewrite variant. */
  readonly variantId: string;
  /** Explicit initial memory fixture. */
  readonly memory: MemoryFixtureV1;
  /** Caller-selected limits bounded by the fixed oracle maxima. */
  readonly budget: OracleBudgetV1;
}

/** Closed request accepted by the structured loop-unrolling relation. */
export interface SemanticRelationRequestV2 {
  /** Protocol version. */
  readonly schemaVersion: 2;
  /** Exact transform handler identity. */
  readonly handlerId: "transform.semantic-relations";
  /** Structured relation selected for this invocation. */
  readonly relationId: "relation.loop-unrolling";
  /** Complete replay identity copied from authenticated case authority. */
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  /** Exact authenticated structured source case. */
  readonly sourceCase: StructuredGeneratedModeledCaseV1;
  /** Unique function evaluated before and after transformation. */
  readonly entryFunction: string;
  /** Canonical top-level statement pointer selecting one finite loop. */
  readonly selectionPath: string;
  /** Exact closed unrolling variant. */
  readonly variantId: "unroll-exact-domain-v1";
  /** Explicit initial memory fixture. */
  readonly memory: MemoryFixtureV1;
  /** Caller-selected limits bounded by the oracle maxima. */
  readonly budget: OracleBudgetV1;
  /** Structured source and transformed-program generation limits. */
  readonly generationBudget: StructuredGenerationBudgetV2;
}

/** Successful relation proof retaining both immutable cases and observations. */
export interface SemanticRelationModeledResultV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Modeled-result discriminator shared with raw oracle results. */
  readonly outcome: "modeled";
  /** Relation proven by this result. */
  readonly relationId: SemanticRelationId;
  /** Replay-verified immutable source case. */
  readonly sourceCase: GeneratedModeledCase;
  /** Independently revalidated immutable transformed case. */
  readonly transformedCase: GeneratedModeledCase;
  /** Source-side observation under the relation-owned projection. */
  readonly sourceObservation: OracleObservationV1;
  /** Transformed-side observation under the relation-owned projection. */
  readonly transformedObservation: OracleObservationV1;
  /** Accepted observation, exactly equal to `transformedObservation`. */
  readonly observation: OracleObservationV1;
  /** Successful results carry no diagnostics. */
  readonly diagnostics: readonly [];
}

/** Closed result of one semantic-relation invocation. */
export type SemanticRelationResultV1 =
  | SemanticRelationModeledResultV1
  | Exclude<OracleResultV1, { readonly ok: true; readonly outcome: "modeled" }>;

/** Successful structured loop-unrolling proof retaining the exact ordered domain. */
export interface SemanticRelationModeledResultV2 {
  readonly ok: true;
  readonly outcome: "modeled";
  readonly relationId: "relation.loop-unrolling";
  readonly sourceCase: StructuredGeneratedModeledCaseV1;
  readonly transformedCase: StructuredGeneratedModeledCaseV1;
  readonly sourceObservation: OracleObservationV1;
  readonly transformedObservation: OracleObservationV1;
  readonly observation: OracleObservationV1;
  readonly iterationDomain: readonly StructuredLoopTraceEntryV2[];
  readonly diagnostics: readonly [];
}

/** Closed result of one structured loop-unrolling invocation. */
export type SemanticRelationResultV2 =
  | SemanticRelationModeledResultV2
  | {
      readonly ok: true;
      readonly outcome: "proof-incomplete";
      readonly relationId: "relation.loop-unrolling";
      readonly reason: "volatile-effect-order-unproven";
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "relation-inapplicable";
      readonly relationId: "relation.loop-unrolling";
      readonly diagnostics: readonly [];
    }
  | Exclude<
      OracleResultV1,
      | { readonly ok: true; readonly outcome: "modeled" }
      | { readonly ok: true; readonly outcome: "relation-inapplicable" }
    >;

/** Candidate source-authoring semantic-relation handler. */
export type SemanticRelationHandlerV1 = (
  suite: OracleSuite,
  request: unknown,
) => SemanticRelationResultV1 | SemanticRelationResultV2;
