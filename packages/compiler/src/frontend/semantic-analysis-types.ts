import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { BindingId, AnalysisObligation, ModuleGraph } from "./module-graph-types.js";
import type {
  TypedExpr,
  TypedBlock,
  SemanticType,
  SemanticBinding,
  ProfileEffect,
} from "./semantic-types.js";

/** A declaration whose admitted scalar body was checked. */
export interface TypedDeclaration {
  /** Accepted declaration discriminator. */
  readonly kind: "typed";
  /** Stable declaration identity. */
  readonly binding: BindingId;
  /** Resolved declared or return type. */
  readonly type: SemanticType;
  /** Converted module initializer, or null. */
  readonly initializer: TypedExpr | null;
  /** Typed function body, or null for a module variable. */
  readonly body: TypedBlock | null;
  /** Maximum balanced function-local processor-status saves. */
  readonly statusStackPeak?: number;
  /** Validated source placement constraints for an emitted object. */
  readonly placement?: PlacementConstraints | null;
  /** Packaged constant excluded from the resident image. */
  readonly loadable?: boolean;
  /** Mutable source storage was declared inside a zero-page block. */
  readonly zeropage?: boolean;
}

/** Closed, source-proved constraints passed unchanged toward final placement. */
export interface PlacementConstraints {
  /** Fixed first-byte address, when written. */
  readonly at: number | null;
  /** Required power-of-two first-byte alignment. */
  readonly align: number;
  /** Required single-window size, when written. */
  readonly noCross: number | null;
  /** Selected-profile region identity, when written. */
  readonly region: string | null;
}

/** A declaration retained without a usable typed value. */
export interface UnusableDeclaration {
  /** Whether source was rejected or awaits a later admitted implementation. */
  readonly kind: "poison" | "unchecked";
  /** Stable declaration identity. */
  readonly binding: BindingId;
  /** Complete source bytes. */
  readonly span: SourceSpan;
}

/** One checked or retained module declaration. */
export type AnalyzedDeclaration = TypedDeclaration | UnusableDeclaration;

/** One direct ordinary-function call edge. */
export interface CallEdge {
  /** Function containing the call. */
  readonly caller: BindingId;
  /** Resolved called function. */
  readonly callee: BindingId;
  /** Complete call-expression bytes. */
  readonly span: SourceSpan;
}

/** Result of scalar body and structured-flow analysis over a resolved module graph. */
export interface ModuleAnalysisResult {
  /** Reachable modules inherited from the resolved graph. */
  readonly modules: ModuleGraph["modules"];
  /** Module, parameter, and local bindings in deterministic source order. */
  readonly bindings: readonly SemanticBinding[];
  /** Scalar type records used by checked declarations. */
  readonly types: readonly SemanticType[];
  /** Checked and retained declarations in deterministic source order. */
  readonly declarations: readonly AnalyzedDeclaration[];
  /** Actual direct call edges in source order. */
  readonly calls: readonly CallEdge[];
  /** Proving diagnostics in stable source/span/code order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Remaining valid-language implementation work. */
  readonly obligations: readonly AnalysisObligation[];
  /** Whether body/type/flow checking completed without an error or obligation. */
  readonly complete: boolean;
}

/** A symbolic place published by effect analysis without checker-only permission provenance. */
export interface EffectPlace {
  /** Root declaration identity. */
  readonly binding: BindingId;
  /** Ordered field and index path from the root. */
  readonly path: readonly (string | TypedExpr)[];
  /** Whether writes through this place are forbidden. */
  readonly readonly: boolean;
}

/** Finite externally visible effects of one ordinary function. */
export interface EffectSummary {
  /** Function whose transitive behavior is summarized. */
  readonly function: BindingId;
  /** Module or aggregate-parameter places which may be read. */
  readonly reads: readonly EffectPlace[];
  /** Module or aggregate-parameter places which may be written. */
  readonly writes: readonly EffectPlace[];
  /** Ordered profile-operation behaviors reached directly or through callees. */
  readonly operationEffects: readonly Exclude<ProfileEffect, "pure">[];
  /** Whether volatile raw memory or an ordered profile operation may occur. */
  readonly opaque: boolean;
}

/** Completed effect and startup-schedule facts for one module analysis. */
export interface EffectAnalysisResult {
  /** One transitive summary per checked ordinary function. */
  readonly effects: readonly EffectSummary[];
  /** Runtime module initializers in proved execution order. */
  readonly initializerOrder: readonly BindingId[];
  /** Proving failures discovered while ordering initializers. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}
