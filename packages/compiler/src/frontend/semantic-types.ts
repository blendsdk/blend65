import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { EmbeddedValue } from "../assets/asset-types.js";
import type { Block, Expr, Statement, TypeSyntax } from "./syntax.js";
import { bindingIdentityKey } from "./module-graph-types.js";
import type { AnalysisObligation, Binding, BindingId, ModuleGraph } from "./module-graph-types.js";
export {
  ANALYSIS_OBLIGATION_KIND,
  bindingIdentityKey,
  freezeSourceSpan,
} from "./module-graph-types.js";
export type {
  AnalysisObligation,
  Binding,
  BindingId,
  BindingStorage,
  ModuleContribution,
  ModuleGraph,
  ModuleGraphResult,
  ModuleIndex,
  ModuleIndexResult,
  ResolvedImport,
} from "./module-graph-types.js";

/** Scalar types admitted by the first body-analysis slice. */
export type ScalarTypeName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

/** A resolved primitive value type. */
export interface ScalarType {
  /** Type discriminator. */
  readonly kind: "scalar";
  /** Exact source-language primitive name. */
  readonly name: ScalarTypeName;
}

/** One byte-backed type whose declaration identity remains distinct from other enums. */
export interface EnumType {
  /** Type discriminator. */
  readonly kind: "enum";
  /** Declared type name for diagnostics. */
  readonly name: string;
  /** Declaration identity which makes this type nominal. */
  readonly binding: BindingId;
}

/** One field in a resolved nominal struct, including its packed byte offset. */
export interface StructFieldType {
  /** Exact declared field name. */
  readonly name: string;
  /** Resolved field value type. */
  readonly type: SemanticType;
  /** Zero-based byte offset with no inserted padding. */
  readonly offset: number;
}

/** A resolved nominal struct type. */
export interface StructType {
  /** Type discriminator. */
  readonly kind: "struct";
  /** Declaration identity which makes this type nominal. */
  readonly binding: BindingId;
  /** Complete packed byte size. */
  readonly size: number;
  /** Fields in declaration and memory order. */
  readonly fields: readonly StructFieldType[];
}

/** A resolved fixed-size array type. */
export interface ArrayType {
  /** Type discriminator. */
  readonly kind: "array";
  /** Exact element type. */
  readonly element: SemanticType;
  /** Compile-time element count. */
  readonly length: number;
  /** Complete byte size. */
  readonly size: number;
}

/** Exact signature of one ordinary callable value, independent of its possible targets. */
export interface FunctionType {
  /** Type discriminator. */
  readonly kind: "function";
  /** Parameter types, extents and qualifiers in source order. */
  readonly parameters: readonly SignatureParameter[];
  /** Complete result type. */
  readonly returnType: SemanticType;
}

/** A non-callable interrupt entry address accepted only by compatible platform sinks. */
export interface InterruptHandlerType {
  /** Type discriminator. */
  readonly kind: "interrupt-handler";
}

/** Complete value types admitted by semantic analysis. */
export type SemanticType =
  | ScalarType
  | EnumType
  | StructType
  | ArrayType
  | FunctionType
  | InterruptHandlerType;

/** Source-level ordering behavior attached to a profile operation. */
export type ProfileEffect = "pure" | "ordered-wait" | "volatile-read" | "volatile-write";

/** Render a stable structural key for aggregate-type interning. */
export function semanticTypeKey(type: SemanticType): string {
  if (type.kind === "scalar") return type.name;
  if (type.kind === "enum") return `enum:${bindingIdentityKey(type.binding)}`;
  if (type.kind === "struct") return `struct:${bindingIdentityKey(type.binding)}`;
  if (type.kind === "function") {
    const params = type.parameters.map(
      ({ type: parameter, readonly, outerUnsized }) =>
        `${readonly ? "const " : ""}${semanticTypeKey(outerUnsized && parameter.kind === "array" ? parameter.element : parameter)}${outerUnsized ? "[]" : ""}`,
    );
    return `fn(${params.join(",")}):${semanticTypeKey(type.returnType)}`;
  }
  if (type.kind === "interrupt-handler") return "interrupt-handler";
  return `${semanticTypeKey(type.element)}[${type.length}]`;
}

/** A graph binding enriched with the type accepted by body analysis. */
export interface SemanticBinding extends Binding {
  /** Resolved type, or null when the declaration cannot supply one. */
  readonly type: SemanticType | null;
  /** A source function's entry kind; profile operations have no source body. */
  readonly functionMode?: "ordinary" | "comptime" | "interrupt";
  /** A parameter carries its outer array extent separately from the element type. */
  readonly outerUnsized?: true;
  /** Target-neutral operation behavior for a profile-supplied function. */
  readonly operationEffect?: ProfileEffect;
  /** This constant is packaged separately and has no resident storage address. */
  readonly loadable?: boolean;
  /** An explicit source placement materializes even a scalar constant. */
  readonly materialized?: boolean;
  /** Source declaration is a mutable zero-page member. */
  readonly zeropage?: boolean;
}

/** Create an immutable local or parameter binding from source identity alone. */
export function createSemanticBodyBinding(
  name: string,
  declaration: SourceSpan,
  storage: "local" | "parameter" | "constant",
  type: SemanticType,
): SemanticBinding {
  const span = Object.freeze({ ...declaration });
  return Object.freeze({
    id: Object.freeze({ sourceId: span.sourceId, span }),
    name,
    qualifiedName: null,
    declaration: span,
    exported: false,
    storage,
    type,
  });
}

/** Fixed-width integer behavior retained for later lowering. */
export interface IntegerFacts {
  /** Runtime operand width. */
  readonly width: 8 | 16;
  /** Whether the width uses two's-complement signed interpretation. */
  readonly signed: boolean;
  /** Whether ordinary runtime evaluation wraps at this width. */
  readonly wrap: boolean;
}

/** A symbolic writable or readable source location. */
export interface Place {
  /** Root declaration identity. */
  readonly binding: BindingId;
  /** Ordered field and index path from the root. */
  readonly path: readonly (string | TypedExpr)[];
  /** Whether writes through this place are forbidden. */
  readonly readonly: boolean;
  /** Source of read-only permission, when writes are forbidden. */
  readonly readonlyOrigin: "constant" | "parameter" | null;
  /** Exact half-open byte interval relative to the root object, or null for dynamic selection. */
  readonly byteRange?: InitializedRange | null;
}

/** One parameter in a resolved direct-call signature. */
export interface SignatureParameter {
  /** Value type expected by the callee. */
  readonly type: SemanticType;
  /** The caller also supplies the complete outer element count as one word. */
  readonly outerUnsized?: true;
  /** Whether aggregate writes through the parameter are forbidden. */
  readonly readonly: boolean;
}

/** Complete source-level signature of an ordinary direct call. */
export interface FunctionSignature {
  /** Parameters in source order. */
  readonly parameters: readonly SignatureParameter[];
  /** Declared function result type. */
  readonly returnType: SemanticType;
}

/** Conversion performed after an expression computes its own value. */
export type ConversionKind =
  | "identity"
  | "zero-extend"
  | "sign-extend"
  | "truncate"
  | "reinterpret";

/** Observable steps of a simple value-producing assignment. */
export const SIMPLE_ASSIGNMENT_EVALUATION = Object.freeze([
  "place",
  "rhs",
  "store",
  "result",
] as const);

/** Observable steps of a compound value-producing assignment. */
export const COMPOUND_ASSIGNMENT_EVALUATION = Object.freeze([
  "place",
  "old-read",
  "rhs",
  "operation",
  "store",
  "result",
] as const);

/**
 * A typed expression retaining the original syntax shape and ordered children.
 * Fields which only apply to one syntax kind are absent on other kinds.
 */
export interface TypedExpr {
  /** Original syntax discriminator. */
  readonly kind: Expr["kind"];
  /** Complete source bytes for the expression. */
  readonly span: SourceSpan;
  /** Resolved value type. */
  readonly type: SemanticType;
  /** Proved value in this expression's semantic context, when known. */
  readonly constant: bigint | boolean | null;
  /** Directly referenced declaration, when this node names one. */
  readonly binding: BindingId | null;
  /** Symbolic source place, when the expression denotes one. */
  readonly place: Place | null;
  /** This borrowed parameter has a caller-supplied outer element count. */
  readonly outerUnsized?: true;
  /** Local homes on which an address-valued result depends, even after integer conversion. */
  readonly addressOrigins?: readonly BindingId[] | undefined;
  /** Storage places contributing to an address value, including read-only provenance. */
  readonly addressPlaces?: readonly Place[] | undefined;
  /** Conversion applied at this expression boundary. */
  readonly conversion: ConversionKind | null;
  /** Fixed-width integer behavior, or null for non-integers. */
  readonly integer: IntegerFacts | null;
  /** Exact literal value retained by number and Boolean nodes. */
  readonly value?: bigint | boolean | TypedExpr;
  /** Name spelling retained by name nodes. */
  readonly name?: string;
  /** Source module qualifier retained by a resolved qualified reference. */
  readonly qualifiedModule?: {
    /** Exact dotted module name. */
    readonly name: string;
    /** Source bytes containing the module qualifier. */
    readonly span: SourceSpan;
  };
  /** Exact operator retained by unary, binary, and assignment nodes. */
  readonly operator?: string;
  /** Unary/cast value operand, or the retained source type used by a type query. */
  readonly operand?: TypedExpr | TypeSyntax;
  /** Left operand of a binary expression. */
  readonly left?: TypedExpr;
  /** Right operand of a binary expression. */
  readonly right?: TypedExpr;
  /** Conditional test. */
  readonly condition?: TypedExpr;
  /** Selected true arm. */
  readonly whenTrue?: TypedExpr;
  /** Selected false arm. */
  readonly whenFalse?: TypedExpr;
  /** Assignment target evaluated exactly once. */
  readonly target?: TypedExpr;
  /** Call target evaluated before its arguments. */
  readonly callee?: TypedExpr;
  /** Exact source spelling of a call target for later proving diagnostics. */
  readonly calleeDisplay?: string;
  /** Call arguments in source order. */
  readonly arguments?: readonly TypedExpr[];
  /** Resolved direct-call signature. */
  readonly signature?: FunctionSignature;
  /** Indexed or selected aggregate object. */
  readonly object?: TypedExpr;
  /** Typed array ordinal. */
  readonly index?: TypedExpr;
  /** Selected struct field spelling. */
  readonly member?: string;
  /** Struct literal fields in source order. */
  readonly fields?: readonly { readonly name: string; readonly value: TypedExpr }[];
  /** Explicit array literal elements in source order. */
  readonly elements?: readonly TypedExpr[];
  /** Remaining-element fill value, when written. */
  readonly fill?: TypedExpr | null;
  /** Exact target bytes from a compile-time encoded string, with no terminator. */
  readonly encodedBytes?: readonly number[];
  /** Half-open element ranges proved initialized by an array literal. */
  readonly initialized?: readonly InitializedRange[];
  /** Resolved type inspected by sizeof or offsetof. */
  readonly operandType?: SemanticType;
  /** Source field spelling retained by offsetof. */
  readonly field?: string;
  /** Volatile raw-memory access facts retained for lowering. */
  readonly memory?: MemoryAccess | null;
  /** Validated compile-time asset value retained without copying its bytes. */
  readonly embedded?: EmbeddedValue;
  /** Original type spelling retained by cast nodes. */
  readonly targetType?: TypeSyntax;
  /** Observable evaluation structure for ordered expressions. */
  readonly evaluation?:
    | "left-to-right"
    | "short-circuit"
    | "selected-arm"
    | readonly ("place" | "old-read" | "rhs" | "operation" | "store" | "result")[];
}

/** One half-open range of array elements with defined initializer values. */
export interface InitializedRange {
  /** First initialized element. */
  readonly start: number;
  /** One past the final initialized element. */
  readonly end: number;
}

/** Symbolic effect facts for one raw-memory intrinsic call. */
export interface MemoryAccess {
  /** Raw memory operations may not be removed, duplicated, or reordered. */
  readonly volatile: true;
  /** Whether the operation reads or writes memory. */
  readonly access: "read" | "write";
  /** Number of bytes accessed. */
  readonly width: 1 | 2;
  /** Required order for two-byte accesses. */
  readonly byteOrder: "low-first";
}

/** A typed local declaration statement. */
export interface TypedVariableStatement {
  /** Statement discriminator. */
  readonly kind: "variable";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Declared source name. */
  readonly name: string;
  /** Stable local binding identity. */
  readonly binding: BindingId;
  /** Resolved declaration type. */
  readonly type: SemanticType;
  /** Converted initializer, or null when omitted. */
  readonly initializer: TypedExpr | null;
}

/** A typed expression statement. */
export interface TypedExpressionStatement {
  /** Statement discriminator. */
  readonly kind: "expression-statement";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Expression evaluated for its effects. */
  readonly expression: TypedExpr;
}

/** A typed nested block used as a statement. */
export interface TypedBlockStatement extends TypedBlock {
  /** Statement discriminator. */
  readonly kind: "block";
}

/** A typed structured conditional statement. */
export interface TypedIfStatement {
  /** Statement discriminator. */
  readonly kind: "if";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Boolean branch condition. */
  readonly condition: TypedExpr;
  /** True branch. */
  readonly then: TypedBlock;
  /** False block or else-if chain. */
  readonly otherwise: TypedBlock | TypedIfStatement | null;
}

/** A typed pre-test loop. */
export interface TypedWhileStatement {
  /** Statement discriminator. */
  readonly kind: "while";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Boolean continuation condition. */
  readonly condition: TypedExpr;
  /** Repeated body. */
  readonly body: TypedBlock;
}

/** A typed post-test loop whose body executes before its condition. */
export interface TypedDoWhileStatement {
  /** Statement discriminator. */
  readonly kind: "do-while";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Repeated body. */
  readonly body: TypedBlock;
  /** Boolean continuation condition. */
  readonly condition: TypedExpr;
}

/** One typed switch arm with source-ordered constant labels. */
export interface TypedSwitchClause {
  /** Case values, or null for the default arm. */
  readonly values: readonly TypedExpr[] | null;
  /** Statements executed when this arm is entered. */
  readonly body: TypedBlock;
  /** Whether execution continues directly into the next arm. */
  readonly fallthrough: boolean;
  /** Complete arm bytes. */
  readonly span: SourceSpan;
}

/** A typed single-evaluation multi-way branch. */
export interface TypedSwitchStatement {
  /** Statement discriminator. */
  readonly kind: "switch";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Selector evaluated exactly once. */
  readonly value: TypedExpr;
  /** Source-ordered case and optional default arms. */
  readonly clauses: readonly TypedSwitchClause[];
}

/** A typed ordinary three-clause loop. */
export interface TypedForStatement {
  /** Statement discriminator. */
  readonly kind: "for";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Initializer evaluated once. */
  readonly initializer: TypedVariableStatement | readonly TypedExpr[] | null;
  /** Boolean continuation condition; null means true. */
  readonly condition: TypedExpr | null;
  /** Ordered update expressions. */
  readonly update: readonly TypedExpr[] | null;
  /** Repeated body. */
  readonly body: TypedBlock;
  /** Target used by continue. */
  readonly continueTarget: "update";
  /** Target used by break. */
  readonly breakTarget: "exit";
}

/** A typed structured exit statement. */
export interface TypedExitStatement {
  /** Exit discriminator. */
  readonly kind: "break" | "continue" | "return";
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Returned value; present only for return. */
  readonly value?: TypedExpr | null;
}

/** Typed statements admitted by scalar structured-flow analysis. */
export type TypedStatement =
  | TypedVariableStatement
  | TypedExpressionStatement
  | TypedBlockStatement
  | TypedIfStatement
  | TypedWhileStatement
  | TypedDoWhileStatement
  | TypedForStatement
  | TypedSwitchStatement
  | TypedExitStatement;

/** A typed brace-delimited source block. */
export interface TypedBlock {
  /** Block discriminator. */
  readonly kind: Block["kind"];
  /** Complete source bytes. */
  readonly span: SourceSpan;
  /** Typed statements in source order. */
  readonly statements: readonly TypedStatement[];
}

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

/** Source syntax accepted by the scalar flow checker. */
export type ScalarStatementSyntax = Statement;

/** Mutable reaching fact used only while scalar expressions are checked. */
export interface ScalarValueState {
  /** Published immutable binding facts. */
  readonly binding: SemanticBinding;
  /** Exact declaration-name bytes. */
  readonly nameSpan: SourceSpan;
  /** Whether assignment through this name is forbidden. */
  readonly readonly: boolean;
  /** Conservatively proved reaching value. */
  known: bigint | boolean | null;
  /** Local homes whose address contributes to this stored scalar value. */
  addressOrigins?: readonly BindingId[] | undefined;
  /** Addressed storage places retained by this scalar value. */
  addressPlaces?: readonly Place[] | undefined;
  /** Whether a scalar or complete aggregate value is definitely initialized. */
  initialized: boolean;
  /** Definitely initialized array-element ranges, when the binding is an array. */
  initializedRanges: readonly InitializedRange[];
  /** Exact scalar field paths definitely initialized by focused writes. */
  initializedPaths: readonly string[];
  /** A stored Boolean's guarded destination, if a producer proved one. */
  conditionalEffect?: ScalarConditionalEffect | null;
}

/** Correlation between a stored Boolean result and a captured destination range. */
export interface ScalarConditionalEffect {
  /** Stable identity of the result produced by the guarded operation. */
  readonly resultId: string;
  /** Destination whose captured range becomes initialized on true. */
  readonly destination: ScalarValueState;
  /** Exact half-open range captured when the guarded operation ran. */
  readonly capturedRange: InitializedRange;
}

/** One lexical value scope used by direct expression lookup. */
export interface ScalarScope {
  /** Enclosing lexical scope. */
  readonly parent: ScalarScope | null;
  /** Names introduced directly in this scope. */
  readonly values: Map<string, ScalarValueState>;
}

/** Reaching facts captured at one control-flow split. */
export interface ScalarValueFact {
  /** Conservatively proved scalar value. */
  readonly known: bigint | boolean | null;
  /** Local address dependencies that survive this control-flow edge. */
  readonly addressOrigins?: readonly BindingId[] | undefined;
  /** Addressed storage places surviving this control-flow edge. */
  readonly addressPlaces?: readonly Place[] | undefined;
  /** Whether the complete value is definitely initialized. */
  readonly initialized: boolean;
  /** Definitely initialized array ranges. */
  readonly initializedRanges: readonly InitializedRange[];
  /** Exact scalar field paths initialized on every incoming path. */
  readonly initializedPaths: readonly string[];
  /** Guarded write retained only when all paths agree on its result and range. */
  readonly conditionalEffect?: ScalarConditionalEffect | null;
}

/** Reaching values captured at one control-flow split. */
export type ScalarFactSnapshot = ReadonlyMap<ScalarValueState, ScalarValueFact>;

/** Constant-versus-runtime context for one expression check. */
export interface ScalarExpressionContext {
  /** Active lexical scope. */
  readonly scope: ScalarScope;
  /** Owning module name. */
  readonly module: string;
  /** Source containing this expression. */
  readonly sourceId: string;
  /** Function containing this expression, or null for a module initializer. */
  readonly caller: BindingId | null;
  /** Whether arithmetic remains exact until final range validation. */
  readonly constantContext: boolean;
  /** Case-label context uses its own canonical non-constant diagnostic. */
  readonly caseContext?: boolean;
  /** Whether the expression is being resolved as a place rather than read as a value. */
  readonly placeContext?: boolean;
  /** A metadata-only query may inspect a packaged value without reading resident bytes. */
  readonly compileTimeQuery?: boolean;
  /** Whether direct integer operators compute in the array-ordinal promotion domain. */
  readonly ordinalContext?: boolean;
}

/** Typed expression plus its pre-wrap mathematical value when known. */
export interface ScalarExpressionResult {
  /** Typed syntax, or null after an unrecoverable expression error. */
  readonly node: TypedExpr | null;
  /** Exact mathematical value before an ordinary runtime-width wrap. */
  readonly exact: bigint | boolean | null;
}

/** Narrow callbacks used by direct expression recursion during module analysis. */
export interface ScalarExpressionHost {
  /** Selected profile identity, or null while source remains profile-independent. */
  readonly profileId?: string | null;
  /** Resolve a source name under the current scopes. */
  resolveName(name: string, context: ScalarExpressionContext): ScalarValueState | null;
  /** Resolve a source type and report an unknown type when needed. */
  resolveType(type: TypeSyntax | null, context: ScalarExpressionContext): SemanticType | null;
  /** Return a direct function signature for a resolved binding. */
  signature(binding: BindingId): FunctionSignature | null;
  /** Return whether a binding denotes a function whose signature may still be pending. */
  isFunction(binding: BindingId): boolean;
  /** Return the source entry kind for a declared function, when one exists. */
  functionMode?(binding: BindingId): "ordinary" | "comptime" | "interrupt" | null;
  /** Append a proving diagnostic. */
  diagnose(diagnostic: ProjectDiagnostic): void;
  /** Retain a valid expression belonging to a later slice. */
  defer(span: SourceSpan, message: string): void;
  /** Retain one actual direct call edge. */
  call(edge: CallEdge): void;
  /** Read exact source bytes for a diagnostic expression. */
  sourceText(span: SourceSpan): string;
  /** Report a function-local read which is not definitely initialized. */
  read(place: Place, span: SourceSpan): void;
  /** Return a prevalidated embedded value for this exact call expression. */
  embeddedValue(expression: Expr): EmbeddedValue | null;
}

/** Direct callbacks required while aggregate types are resolved. */
export interface AggregateRegistryHost {
  /** Append a proving diagnostic. */
  diagnose(diagnostic: ProjectDiagnostic): void;
  /** Retain a valid source form outside the admitted aggregate slice. */
  defer(span: SourceSpan, message: string): void;
  /** Read exact source bytes for a diagnostic. */
  sourceText(span: SourceSpan): string;
}
