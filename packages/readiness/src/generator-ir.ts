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

/** A fixed or parameter-only unsized array type. */
export interface GenArrayType {
  readonly kind: "array-type";
  readonly elementType: ScalarType;
  readonly extent: number | null;
  readonly access: "const" | "mutable";
}

/** A reference to array storage accepted only in a call argument. */
export interface GenArrayReferenceExpression {
  readonly kind: "array-reference";
  readonly type: GenArrayType;
  readonly name: GenIdentifier;
}

/** A scalar read from one generated array. */
export interface GenIndexExpression {
  readonly kind: "index";
  readonly type: ScalarType;
  readonly target: GenIdentifier;
  readonly index: GenStructuredExpression;
}

/** A call to one scalar-returning generated function. */
export interface GenCallExpression {
  readonly kind: "call";
  readonly type: ScalarType;
  readonly callee: GenIdentifier;
  readonly arguments: readonly (GenStructuredExpression | GenArrayReferenceExpression)[];
}

/** Closed expression union for generated programs. */
export type GenExpression =
  | GenLiteralExpression
  | GenNameExpression
  | GenUnaryExpression
  | GenBinaryExpression
  | GenMemoryReadExpression;

/** A structured unary expression whose operand may contain calls or indexing. */
export interface GenStructuredUnaryExpression {
  readonly kind: "unary";
  readonly type: ScalarType;
  readonly operator: UnaryOperator;
  readonly operand: GenStructuredExpression;
}

/** A structured binary expression whose operands may contain calls or indexing. */
export interface GenStructuredBinaryExpression {
  readonly kind: "binary";
  readonly type: ScalarType;
  readonly operator: BinaryOperator;
  readonly left: GenStructuredExpression;
  readonly right: GenStructuredExpression;
}

/** A structured volatile read whose address may be computed by structured expressions. */
export interface GenStructuredMemoryReadExpression {
  readonly kind: "memory-read";
  readonly type: "byte" | "word";
  readonly width: 1 | 2;
  readonly address: GenStructuredExpression;
}

/** Closed expression union for structured generated programs. */
export type GenStructuredExpression =
  | GenLiteralExpression
  | GenNameExpression
  | GenStructuredUnaryExpression
  | GenStructuredBinaryExpression
  | GenStructuredMemoryReadExpression
  | GenIndexExpression
  | GenCallExpression;

/** A fixed local array declaration. */
export interface GenArrayDeclaration {
  readonly kind: "array";
  readonly name: GenIdentifier;
  readonly elementType: ScalarType;
  readonly extent: number;
  readonly initializer: readonly GenStructuredExpression[];
}

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

/** A writable indexed assignment target. */
export interface GenIndexAssignmentTarget {
  readonly kind: "index-target";
  readonly type: ScalarType;
  readonly target: GenIdentifier;
  readonly index: GenStructuredExpression;
}

/** A structured assignment to a scalar name or indexed array element. */
export interface GenStructuredAssignStatement {
  readonly kind: "assign";
  readonly target: GenIdentifier | GenIndexAssignmentTarget;
  readonly value: GenStructuredExpression;
}

/** A structured scalar local declaration. */
export interface GenStructuredLocalStatement {
  readonly kind: "local";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
  readonly initializer: GenStructuredExpression;
}

/** A structured volatile write. */
export interface GenStructuredMemoryWriteStatement {
  readonly kind: "memory-write";
  readonly width: 1 | 2;
  readonly address: GenStructuredExpression;
  readonly value: GenStructuredExpression;
}

/** A structured return with an optional scalar expression. */
export interface GenStructuredReturnStatement {
  readonly kind: "return";
  readonly value?: GenStructuredExpression;
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

/** A call to one void generated function. */
export interface GenCallStatement {
  readonly kind: "call-statement";
  readonly callee: GenIdentifier;
  readonly arguments: readonly (GenStructuredExpression | GenArrayReferenceExpression)[];
}

/** A closed conditional with explicit ordered branches. */
export interface GenIfStatement {
  readonly kind: "if";
  readonly condition: GenStructuredExpression;
  readonly thenBody: readonly GenStructuredStatement[];
  readonly elseBody: readonly GenStructuredStatement[];
}

/** A pre-condition loop. */
export interface GenWhileStatement {
  readonly kind: "while";
  readonly condition: GenStructuredExpression;
  readonly body: readonly GenStructuredStatement[];
}

/** A post-condition loop. */
export interface GenDoWhileStatement {
  readonly kind: "do-while";
  readonly body: readonly GenStructuredStatement[];
  readonly condition: GenStructuredExpression;
}

/** A finite integer loop whose domain is fixed before execution. */
export interface GenForStatement {
  readonly kind: "for";
  readonly counter: GenIdentifier;
  readonly counterType: Exclude<ScalarType, "boolean">;
  readonly start: GenStructuredExpression;
  readonly direction: "until" | "to" | "downto";
  readonly end: GenStructuredExpression;
  readonly step: bigint;
  readonly body: readonly GenStructuredStatement[];
}

/** Closed statement union for generated functions. */
export type GenStatement =
  | GenLocalStatement
  | GenAssignStatement
  | GenMemoryWriteStatement
  | GenReturnStatement;

/** Closed statement union for structured generated programs. */
export type GenStructuredStatement =
  | GenStructuredLocalStatement
  | GenArrayDeclaration
  | GenStructuredAssignStatement
  | GenStructuredMemoryWriteStatement
  | GenStructuredReturnStatement
  | GenCallStatement
  | GenIfStatement
  | GenWhileStatement
  | GenDoWhileStatement
  | GenForStatement;

/** One historical scalar parameter retained for byte-identical v1 replay. */
export interface GenParameter {
  readonly name: GenIdentifier;
  readonly type: ScalarType;
}

/** One explicitly discriminated scalar parameter. */
export interface GenScalarParameter {
  readonly kind: "scalar-parameter";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
}

/** One fixed or unsized array parameter. */
export interface GenArrayParameter {
  readonly kind: "array-parameter";
  readonly name: GenIdentifier;
  readonly type: GenArrayType;
}

/** Closed parameter union for structured generated functions. */
export type GenStructuredParameter = GenParameter | GenScalarParameter | GenArrayParameter;

/** Oracle-only placement for generated array storage. */
export interface GenArrayPlacementFixtureV1 {
  readonly revision: "structured-array-placement-v1";
  readonly bindings: readonly {
    readonly arrayName: GenIdentifier;
    readonly baseAddress: number;
  }[];
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

/** One structured function with scalar or array parameters and statements. */
export interface GenStructuredFunction {
  readonly kind: "function";
  readonly name: GenIdentifier;
  readonly parameters: readonly GenStructuredParameter[];
  readonly returnType: ScalarType | "void";
  readonly body: readonly GenStructuredStatement[];
}

/** One structured generated module. */
export interface GenStructuredModule {
  readonly kind: "module";
  readonly path: readonly GenIdentifier[];
  readonly constants: readonly GenConst[];
  readonly functions: readonly GenStructuredFunction[];
}

/** Result of closing an unknown value into structured generator IR. */
export type StructuredIrValidationResult =
  | {
      readonly ok: true;
      readonly module: GenStructuredModule;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

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

/** Structural limits for real programs with nested statements. */
export interface StructuredGenerationBudgetV2 extends GenerationBudget {
  /** Exact structured budget schema. */
  readonly schemaVersion: 2;
  /** Maximum one-based statement nesting depth. */
  readonly maxStatementDepth: number;
}

/** All resource dimensions carried by a structured generation result. */
export type StructuredGenerationBudgetDimensionV2 = GenerationBudgetDimension | "statement-depth";

/** Result of validating and snapshotting one structured budget. */
export type StructuredGenerationBudgetResultV2 =
  | {
      readonly ok: true;
      readonly budget: StructuredGenerationBudgetV2;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

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
