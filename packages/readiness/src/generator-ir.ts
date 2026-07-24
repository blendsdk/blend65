declare const GEN_IDENTIFIER_BRAND: unique symbol;

/**
 * An allowlisted source identifier that has passed generator validation.
 *
 * The brand is compile-time-only; runtime trust always comes from validation.
 */
export type GenIdentifier = string & {
  readonly [GEN_IDENTIFIER_BRAND]: true;
};

/** Scalar value types supported by the independent generator IR. */
export type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";

/** Unary operators representable by the independent generator IR. */
export type UnaryOperator = "-" | "~" | "!";

/** Binary operators representable by the independent generator IR. */
export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "&"
  | "|"
  | "^"
  | "<<"
  | ">>"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">=";

/** A typed literal expression. */
export interface GenLiteralExpression {
  readonly kind: "literal";
  readonly type: ScalarType;
  readonly value: bigint;
}

/** A typed reference to a declaration visible in the current generator scope. */
export interface GenNameExpression {
  readonly kind: "name";
  readonly type: ScalarType;
  readonly name: GenIdentifier;
}

/** A typed unary expression. */
export interface GenUnaryExpression {
  readonly kind: "unary";
  readonly type: ScalarType;
  readonly operator: UnaryOperator;
  readonly operand: GenExpression;
}

/** A typed binary expression. */
export interface GenBinaryExpression {
  readonly kind: "binary";
  readonly type: ScalarType;
  readonly operator: BinaryOperator;
  readonly left: GenExpression;
  readonly right: GenExpression;
}

/** A byte- or word-width volatile memory read. */
export interface GenMemoryReadExpression {
  readonly kind: "memory-read";
  readonly type: "byte" | "word";
  readonly width: 1 | 2;
  readonly address: GenExpression;
}

/** Closed expression union for generated programs. */
export type GenExpression =
  | GenLiteralExpression
  | GenNameExpression
  | GenUnaryExpression
  | GenBinaryExpression
  | GenMemoryReadExpression;

/** A typed local declaration statement. */
export interface GenLocalStatement {
  readonly kind: "local";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
  readonly initializer: GenExpression;
}

/** An assignment to a previously declared name. */
export interface GenAssignStatement {
  readonly kind: "assign";
  readonly target: GenIdentifier;
  readonly value: GenExpression;
}

/** A byte- or word-width volatile memory write. */
export interface GenMemoryWriteStatement {
  readonly kind: "memory-write";
  readonly width: 1 | 2;
  readonly address: GenExpression;
  readonly value: GenExpression;
}

/** A function return, optionally carrying a scalar result. */
export interface GenReturnStatement {
  readonly kind: "return";
  readonly value?: GenExpression;
}

/** Closed statement union for generated functions. */
export type GenStatement =
  | GenLocalStatement
  | GenAssignStatement
  | GenMemoryWriteStatement
  | GenReturnStatement;

/** One typed function parameter. */
export interface GenParameter {
  readonly name: GenIdentifier;
  readonly type: ScalarType;
}

/** One immutable named scalar constant. */
export interface GenConst {
  readonly kind: "const";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
  readonly value: GenExpression;
}

/** One generated function with an ordered parameter list and body. */
export interface GenFunction {
  readonly kind: "function";
  readonly name: GenIdentifier;
  readonly parameters: readonly GenParameter[];
  readonly returnType: ScalarType | "void";
  readonly body: readonly GenStatement[];
}

/** One logical generated module, independent of host filesystem paths. */
export interface GenModule {
  readonly kind: "module";
  readonly path: readonly GenIdentifier[];
  readonly constants: readonly GenConst[];
  readonly functions: readonly GenFunction[];
}

/** Resource dimension enforced during generated-case construction. */
export type GenerationBudgetDimension =
  | "modules"
  | "declarations"
  | "ir-nodes"
  | "statements"
  | "expression-depth"
  | "loop-work"
  | "source-bytes"
  | "attempts";

/** Stable diagnostic categories returned by generation operations. */
export type GenerationDiagnosticCode =
  | "generation-input-invalid"
  | "generation-type-invalid"
  | "generation-budget"
  | "generation-invariant"
  | "neighbor-invalid";

/** Machine-readable generation failure with a stable JSON-pointer path. */
export interface GenerationDiagnostic {
  readonly code: GenerationDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly dimension?: GenerationBudgetDimension;
}

/** Result of closing an unknown value into a validated immutable generator module. */
export type IrValidationResult =
  | {
      readonly ok: true;
      readonly module: GenModule;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** A named executable predicate over validated generator modules. */
export interface NamedModelPredicate {
  readonly predicateId: string;
  readonly evaluate: (module: GenModule) => boolean;
}

/** One operation intended to invalidate exactly one named predicate. */
export interface InvalidNeighborOperation {
  readonly neighborId: string;
  readonly targetPredicateId: string;
  readonly diagnosticFamily: string;
  readonly apply: (module: GenModule) => GenModule;
}

/** Result of applying and independently proving one invalid-neighbor operation. */
export type NeighborResult =
  | {
      readonly ok: true;
      readonly module: GenModule;
      readonly neighborId: string;
      readonly violatedPredicateId: string;
      readonly diagnosticFamily: string;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Closed boundary families emitted by the boundary-variant transform. */
export type BoundaryVariantKind =
  | "empty"
  | "minimum"
  | "maximum"
  | "nearest-below"
  | "nearest-above"
  | "spelling"
  | "nesting";

/** Source spelling families available to a generated boundary case. */
export type BoundarySpelling = "literal" | "const" | "local" | "parameter";

/** One typed boundary descriptor. */
export interface BoundaryVariant {
  readonly kind: BoundaryVariantKind;
  readonly type: ScalarType;
  readonly value: bigint | boolean | null;
  readonly spelling?: BoundarySpelling;
  readonly nestingDepth?: number;
}

/** Closed input accepted by the boundary-variant transform. */
export interface BoundaryVariantInput {
  readonly type: ScalarType;
  readonly spellings: readonly BoundarySpelling[];
  readonly minNestingDepth: number;
  readonly maxNestingDepth: number;
  readonly allowEmpty: boolean;
}

/** Result of deterministic boundary expansion. */
export type BoundaryVariantResult =
  | {
      readonly ok: true;
      readonly variants: readonly BoundaryVariant[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Positive structural limits for one generated case. */
export interface GenerationBudget {
  readonly maxModules: number;
  readonly maxDeclarations: number;
  readonly maxIrNodes: number;
  readonly maxStatements: number;
  readonly maxExpressionDepth: number;
  readonly maxLoopWork: bigint;
  readonly maxSourceBytes: number;
  readonly maxAttempts: number;
}

/** Result of validating and snapshotting a structural budget. */
export type GenerationBudgetResult =
  | {
      readonly ok: true;
      readonly budget: GenerationBudget;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Immutable accumulated usage across every structural budget dimension. */
export type GenerationUsage = Readonly<Record<GenerationBudgetDimension, bigint>>;

/** Result of one transactional budget-tracker step. */
export type GenerationBudgetStepResult =
  | {
      readonly ok: true;
      readonly usage: GenerationUsage;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Transactional structural accounting for one generated case. */
export interface GenerationBudgetTracker {
  /**
   * Adds one non-negative amount without retaining partial state on failure.
   *
   * @example
   * ```ts
   * tracker.consume("statements", 1);
   * ```
   */
  consume(
    dimension: GenerationBudgetDimension,
    amount: number | bigint,
  ): GenerationBudgetStepResult;

  /**
   * Recounts a completed module and compares it with incremental usage.
   *
   * @example
   * ```ts
   * tracker.finalize(module, renderedBytes, attempts);
   * ```
   */
  finalize(module: GenModule, sourceBytes: number, attempts: number): GenerationBudgetStepResult;

  /**
   * Returns a fresh immutable usage snapshot.
   *
   * @example
   * ```ts
   * const before = tracker.snapshot();
   * ```
   */
  snapshot(): GenerationUsage;
}

/**
 * Reports whether a value is an allowlisted generator identifier.
 *
 * @param value Candidate identifier.
 * @returns Whether the value follows the generator identifier grammar.
 *
 * @example
 * ```ts
 * if (isGenIdentifier("main")) {
 *   // The identifier may now be used in a generator node.
 * }
 * ```
 */
export function isGenIdentifier(value: unknown): value is GenIdentifier {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(value);
}

/**
 * Reports whether a value names a supported scalar type.
 *
 * @param value Candidate scalar type.
 * @returns Whether the value belongs to the closed scalar set.
 *
 * @example
 * ```ts
 * isScalarType("word");
 * ```
 */
export function isScalarType(value: unknown): value is ScalarType {
  return (
    value === "boolean" ||
    value === "byte" ||
    value === "sbyte" ||
    value === "word" ||
    value === "sword"
  );
}
