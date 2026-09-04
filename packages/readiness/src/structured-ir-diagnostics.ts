import type {
  GenerationDiagnostic,
  StructuredGenerationBudgetDimensionV2,
} from "./generator-ir.js";

/** Stable semantic or resource reason for a structured rejection. */
export type StructuredGenerationReasonV2 =
  | "input-invalid"
  | "input-limit"
  | "budget-exceeded"
  | "array-size-zero"
  | "array-constant-index-out-of-range"
  | "array-index-tier-mismatch"
  | "array-extent-resource-limit"
  | "array-parameter-element-mismatch"
  | "array-parameter-extent-mismatch"
  | "array-parameter-access-mismatch"
  | "array-const-write"
  | "array-unsized-local"
  | "condition-not-boolean"
  | "function-return-path-missing"
  | "call-arity-mismatch"
  | "call-argument-type-mismatch"
  | "call-context-invalid"
  | "call-cycle"
  | "name-unresolved"
  | "name-conflict"
  | "expression-type-mismatch"
  | "initializer-type-mismatch"
  | "assignment-type-mismatch"
  | "memory-operand-type-mismatch"
  | "return-type-mismatch"
  | "loop-counter-read-only"
  | "constant-expression-not-constant"
  | "constant-dependency-cycle"
  | "constant-value-out-of-range"
  | "constant-zero-divisor"
  | "array-scalar-context-invalid"
  | "loop-counter-type"
  | "loop-step-invalid"
  | "loop-bound-out-of-range"
  | "loop-work-exceeded"
  | "statement-depth-exceeded";

/** Reviewed diagnostic families represented by structured invalid neighbors. */
export type StructuredDiagnosticFamilyV2 =
  | "array-size-at-least-one"
  | "array-index-constant-out-of-range"
  | "array-index-byte-required"
  | "array-index-word-required"
  | "array-parameter-element-type"
  | "array-parameter-fixed-extent"
  | "array-parameter-access"
  | "const-array-parameter-write"
  | "const-array-to-mutable-parameter"
  | "array-local-requires-fixed-extent"
  | "condition-boolean"
  | "all-code-paths-return"
  | "loop-step-positive"
  | "loop-bound-in-counter-range";

/** One closed structured validation diagnostic. */
export interface StructuredGenerationDiagnosticV2 {
  /** Stable generation diagnostic category. */
  readonly code: GenerationDiagnostic["code"];
  /** RFC 6901 pointer to the rejected value. */
  readonly path: string;
  /** Bounded developer-facing explanation. */
  readonly message: string;
  /** Exact structured reason for the rejection. */
  readonly reason: StructuredGenerationReasonV2;
  /** Resource dimension when one configured budget was exceeded. */
  readonly dimension?: StructuredGenerationBudgetDimensionV2;
  /** Reviewed invalid-neighbor family, when one exists. */
  readonly diagnosticFamily?: StructuredDiagnosticFamilyV2;
  /** Frozen compiler diagnostic code, when one is specified. */
  readonly expectedCompilerDiagnosticCode?: string;
}

/**
 * Creates one immutable structured diagnostic with a bounded message.
 *
 * @param code Stable broad generation category.
 * @param reason Exact structured failure reason.
 * @param path RFC 6901 pointer to the rejected value.
 * @param message Developer-facing explanation.
 * @param additions Optional resource or compiler-diagnostic metadata.
 * @returns Immutable diagnostic safe to publish to callers.
 */
export function structuredDiagnostic(
  code: GenerationDiagnostic["code"],
  reason: StructuredGenerationReasonV2,
  path: string,
  message: string,
  additions: Partial<
    Pick<
      StructuredGenerationDiagnosticV2,
      "dimension" | "diagnosticFamily" | "expectedCompilerDiagnosticCode"
    >
  > = {},
): StructuredGenerationDiagnosticV2 {
  return Object.freeze({ code, reason, path, message: message.slice(0, 256), ...additions });
}
