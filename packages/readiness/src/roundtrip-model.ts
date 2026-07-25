import type { BinaryOperator, GenIdentifier, ScalarType, UnaryOperator } from "./generator-ir.js";

/** Surface spelling retained for one rendered integer literal. */
export type LiteralSpellingClass = "decimal" | "hex-dollar" | "hex-prefix" | "binary-prefix";

/** Selects a non-default spelling for one literal expression. */
export interface LiteralSpellingSelection {
  /** Canonical JSON pointer to a literal in the input module. */
  readonly expressionPath: string;
  /** Surface spelling used for the literal magnitude. */
  readonly spelling: LiteralSpellingClass;
}

/** Closed options for deterministic source rendering. */
export interface SourceRenderOptions {
  /** Maximum encoded source size, from 1 byte through 1 MiB. */
  readonly maxSourceBytes: number;
  /** Unique literal spelling selections, capped at 1,024 entries. */
  readonly literalSpellings: readonly LiteralSpellingSelection[];
}

/** Stable diagnostic categories emitted by rendering and independent parsing. */
export type RoundTripDiagnosticCode =
  | "render.input.invalid"
  | "render.spelling.invalid"
  | "render.budget.source-bytes"
  | "roundtrip.input.invalid"
  | "roundtrip.input.invalid-utf8"
  | "roundtrip.input.source-bytes"
  | "roundtrip-unsupported"
  | "roundtrip-mismatch"
  | "roundtrip.boundary";

/** One bounded rendering or inverse diagnostic. */
export interface RoundTripDiagnostic {
  /** Stable machine-readable category. */
  readonly code: RoundTripDiagnosticCode;
  /** Canonical JSON pointer or source-byte path, capped at 256 UTF-8 bytes. */
  readonly path: string;
  /** Human-readable explanation, capped at 512 UTF-8 bytes. */
  readonly message: string;
}

/** A numeric literal in the structure-only round-trip projection. */
export interface RoundTripIntegerLiteralExpression {
  /** Projection discriminator. */
  readonly kind: "integer-literal";
  /** Exact normalized integer value. */
  readonly value: bigint;
  /** Selected source spelling class. */
  readonly spelling: LiteralSpellingClass;
}

/** A boolean literal whose source form must remain `true` or `false`. */
export interface RoundTripBooleanLiteralExpression {
  /** Projection discriminator. */
  readonly kind: "boolean-literal";
  /** Exact boolean source value. */
  readonly value: boolean;
}

/** A name reference in the structure-only projection. */
export interface RoundTripNameExpression {
  /** Projection discriminator. */
  readonly kind: "name";
  /** Referenced identifier. */
  readonly name: GenIdentifier;
}

/** A unary expression in the structure-only projection. */
export interface RoundTripUnaryExpression {
  /** Projection discriminator. */
  readonly kind: "unary";
  /** Prefix operator. */
  readonly operator: UnaryOperator;
  /** Grouped operand. */
  readonly operand: RoundTripExpression;
}

/** A binary expression in the structure-only projection. */
export interface RoundTripBinaryExpression {
  /** Projection discriminator. */
  readonly kind: "binary";
  /** Infix operator. */
  readonly operator: BinaryOperator;
  /** Grouped left operand. */
  readonly left: RoundTripExpression;
  /** Grouped right operand. */
  readonly right: RoundTripExpression;
}

/** A volatile memory read in the structure-only projection. */
export interface RoundTripMemoryReadExpression {
  /** Projection discriminator. */
  readonly kind: "memory-read";
  /** Read width in bytes. */
  readonly width: 1 | 2;
  /** Address expression. */
  readonly address: RoundTripExpression;
}

/** A structurally parsed memory-read call with intentionally invalid arity. */
export interface RoundTripInvalidMemoryReadExpression {
  /** Projection discriminator. */
  readonly kind: "invalid-memory-read";
  /** Exact intrinsic spelling. */
  readonly intrinsic: "peek" | "peekw";
  /** Ordered arguments retained without semantic acceptance. */
  readonly arguments: readonly RoundTripExpression[];
}

/** Closed expression union used only for structural comparison. */
export type RoundTripExpression =
  | RoundTripIntegerLiteralExpression
  | RoundTripBooleanLiteralExpression
  | RoundTripNameExpression
  | RoundTripUnaryExpression
  | RoundTripBinaryExpression
  | RoundTripMemoryReadExpression
  | RoundTripInvalidMemoryReadExpression;

/** One local declaration in a projected function body. */
export interface RoundTripLocalStatement {
  /** Projection discriminator. */
  readonly kind: "local";
  /** Declared identifier. */
  readonly name: GenIdentifier;
  /** Declared scalar type. */
  readonly type: ScalarType;
  /** Initializer projection. */
  readonly initializer: RoundTripExpression;
}

/** One projected assignment. */
export interface RoundTripAssignStatement {
  /** Projection discriminator. */
  readonly kind: "assign";
  /** Assigned identifier. */
  readonly target: GenIdentifier;
  /** Assigned value projection. */
  readonly value: RoundTripExpression;
}

/** One projected volatile memory write. */
export interface RoundTripMemoryWriteStatement {
  /** Projection discriminator. */
  readonly kind: "memory-write";
  /** Write width in bytes. */
  readonly width: 1 | 2;
  /** Address projection. */
  readonly address: RoundTripExpression;
  /** Value projection. */
  readonly value: RoundTripExpression;
}

/** A structurally parsed memory-write call with intentionally invalid arity. */
export interface RoundTripInvalidMemoryWriteStatement {
  /** Projection discriminator. */
  readonly kind: "invalid-memory-write";
  /** Exact intrinsic spelling. */
  readonly intrinsic: "poke" | "pokew";
  /** Ordered arguments retained without semantic acceptance. */
  readonly arguments: readonly RoundTripExpression[];
}

/** One projected function return. */
export interface RoundTripReturnStatement {
  /** Projection discriminator. */
  readonly kind: "return";
  /** Optional returned scalar expression. */
  readonly value?: RoundTripExpression;
}

/** Closed statement union for the rendered subset. */
export type RoundTripStatement =
  | RoundTripLocalStatement
  | RoundTripAssignStatement
  | RoundTripMemoryWriteStatement
  | RoundTripInvalidMemoryWriteStatement
  | RoundTripReturnStatement;

/** One projected function parameter. */
export interface RoundTripParameter {
  /** Parameter identifier. */
  readonly name: GenIdentifier;
  /** Parameter scalar type. */
  readonly type: ScalarType;
}

/** One projected module constant. */
export interface RoundTripConst {
  /** Projection discriminator. */
  readonly kind: "const";
  /** Constant identifier. */
  readonly name: GenIdentifier;
  /** Declared scalar type. */
  readonly type: ScalarType;
  /** Value projection. */
  readonly value: RoundTripExpression;
}

/** One projected function declaration. */
export interface RoundTripFunction {
  /** Projection discriminator. */
  readonly kind: "function";
  /** Function identifier. */
  readonly name: GenIdentifier;
  /** Ordered parameter projections. */
  readonly parameters: readonly RoundTripParameter[];
  /** Explicit return type. */
  readonly returnType: ScalarType | "void";
  /** Ordered function body. */
  readonly body: readonly RoundTripStatement[];
}

/** Structure-only representation independently produced from source and IR. */
export interface RoundTripModule {
  /** Projection discriminator. */
  readonly kind: "module";
  /** Ordered qualified module-name components. */
  readonly path: readonly GenIdentifier[];
  /** Ordered constant declarations. */
  readonly constants: readonly RoundTripConst[];
  /** Ordered function declarations. */
  readonly functions: readonly RoundTripFunction[];
}

/** Successful deterministic render. */
export interface SourceRenderSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Canonical LF source text. */
  readonly source: string;
  /** Isolated UTF-8 bytes for the source. */
  readonly sourceBytes: Uint8Array;
  /** Successful operations carry no diagnostics. */
  readonly diagnostics: readonly [];
}

/** Failed deterministic render. */
export interface SourceRenderFailure {
  /** Failure discriminator. */
  readonly ok: false;
  /** Bounded deterministic diagnostics. */
  readonly diagnostics: readonly RoundTripDiagnostic[];
}

/** Closed renderer result. */
export type SourceRenderResult = SourceRenderSuccess | SourceRenderFailure;

/** Successful projection or independent parse. */
export interface RoundTripProjectionSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Complete structure-only projection. */
  readonly projection: RoundTripModule;
  /** Successful operations carry no diagnostics. */
  readonly diagnostics: readonly [];
}

/** Failed projection or independent parse. */
export interface RoundTripProjectionFailure {
  /** Failure discriminator. */
  readonly ok: false;
  /** Bounded deterministic diagnostics. */
  readonly diagnostics: readonly RoundTripDiagnostic[];
}

/** Closed projection/parser result. */
export type RoundTripParseResult = RoundTripProjectionSuccess | RoundTripProjectionFailure;

/** Successful end-to-end independent validation. */
export interface RoundTripValidationSuccess extends RoundTripProjectionSuccess {
  /** Canonical LF source text. */
  readonly source: string;
  /** Isolated UTF-8 bytes for the source. */
  readonly sourceBytes: Uint8Array;
}

/** Closed end-to-end validation result. */
export type RoundTripValidationResult = RoundTripValidationSuccess | RoundTripProjectionFailure;
