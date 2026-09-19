import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { Block, Expr, ModuleHeader, Statement, SyntaxUnit, TypeSyntax } from "./syntax.js";

/** Stable reasons why a later analysis stage cannot yet finish. */
export const ANALYSIS_OBLIGATION_KIND = Object.freeze({
  /** Source syntax remains incomplete. */
  syntax: "syntax",
  /** The admitted compiler slice does not implement the source form yet. */
  implementation: "implementation",
  /** A named source dependency is unavailable. */
  dependency: "dependency",
  /** A target profile must provide the requested declaration. */
  profile: "profile",
  /** An asset must be loaded before analysis can finish. */
  asset: "asset",
  /** A defensive analysis bound was reached. */
  analysisLimit: "analysis-limit",
} as const);

/** One explicit reason why analysis is incomplete without inventing a diagnostic. */
export interface AnalysisObligation {
  /** Stable obligation category. */
  readonly kind: (typeof ANALYSIS_OBLIGATION_KIND)[keyof typeof ANALYSIS_OBLIGATION_KIND];
  /** Responsible source region, or null when no source location exists. */
  readonly span: SourceSpan | null;
  /** Human-readable description of the remaining work. */
  readonly message: string;
}

/** One source file contributing declarations to a named module. */
export interface ModuleContribution {
  /** Exact project-relative source identity. */
  readonly sourceId: string;
  /** Header discovered without parsing the source body. */
  readonly header: ModuleHeader;
}

/** All source contributions grouped by exact, case-sensitive module name. */
export interface ModuleIndex {
  /** Modules sorted by the UTF-8 bytes of their names. */
  readonly modules: readonly {
    /** Exact qualified module name. */
    readonly name: string;
    /** Contributions sorted by the UTF-8 bytes of their source identities. */
    readonly contributions: readonly ModuleContribution[];
  }[];
}

/** Result of header-only module discovery. */
export interface ModuleIndexResult {
  /** Usable index of every successfully discovered header. */
  readonly index: ModuleIndex;
  /** Proving header diagnostics in deterministic order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Whether every source header was checked successfully. */
  readonly complete: boolean;
  /** Remaining non-diagnostic work needed for completion. */
  readonly obligations: readonly AnalysisObligation[];
}

/** Stable declaration identity based only on source facts. */
export interface BindingId {
  /** Source containing the declaration. */
  readonly sourceId: string;
  /** Complete declaration span. */
  readonly span: SourceSpan;
}

/** Render a stable map key for one source-based binding identity. */
export function bindingIdentityKey(binding: BindingId): string {
  return `${binding.sourceId}:${binding.span.start}:${binding.span.end}`;
}

/** Copy and freeze a source span for an independently immutable result graph. */
export function freezeSourceSpan(span: SourceSpan): SourceSpan {
  return Object.freeze({ sourceId: span.sourceId, start: span.start, end: span.end });
}

/** Storage role known before body type analysis. */
export type BindingStorage = "module" | "local" | "parameter" | "constant" | "function" | "type";

/** One declaration admitted into a module scope. */
export interface Binding {
  /** Stable source-based declaration identity. */
  readonly id: BindingId;
  /** Unqualified declaration name. */
  readonly name: string;
  /** Module-qualified presentation name, or null for a local binding. */
  readonly qualifiedName: string | null;
  /** Complete declaration span. */
  readonly declaration: SourceSpan;
  /** Whether other modules may name the declaration. */
  readonly exported: boolean;
  /** Declaration's storage role. */
  readonly storage: BindingStorage;
}

/** One resolved named import and its source-local spelling. */
export interface ResolvedImport {
  /** Complete imported item span. */
  readonly sourceSpan: SourceSpan;
  /** Name visible in the importing module. */
  readonly alias: string;
  /** Identity of the exported target declaration. */
  readonly binding: BindingId;
}

/** Parsed source graph reachable from the selected entry module. */
export interface ModuleGraph {
  /** Reachable modules in deterministic name order. */
  readonly modules: readonly {
    /** Exact qualified module name. */
    readonly name: string;
    /** Parsed contributions in deterministic source order. */
    readonly units: readonly SyntaxUnit[];
  }[];
  /** Admitted module declarations in source-span order. */
  readonly bindings: readonly Binding[];
  /** Resolved named imports in source-span order. */
  readonly imports: readonly ResolvedImport[];
  /** Accepted program entry declaration, or null. */
  readonly entry: BindingId | null;
}

/** Result of selecting and resolving a source module graph. */
export interface ModuleGraphResult {
  /** Intermediate graph, or null when no selected graph can be formed. */
  readonly graph: ModuleGraph | null;
  /** Proving module diagnostics in deterministic order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Whether every module-graph obligation completed without error. */
  readonly complete: boolean;
  /** Remaining non-diagnostic work needed for completion. */
  readonly obligations: readonly AnalysisObligation[];
}

/** Scalar types admitted by the first body-analysis slice. */
export type ScalarTypeName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

/** A resolved primitive value type. */
export interface ScalarType {
  /** Type discriminator. */
  readonly kind: "scalar";
  /** Exact source-language primitive name. */
  readonly name: ScalarTypeName;
}

/** Semantic types known by the scalar analysis slice. */
export type SemanticType = ScalarType;

/** A graph binding enriched with the type accepted by body analysis. */
export interface SemanticBinding extends Binding {
  /** Resolved type, or null when the declaration cannot supply one. */
  readonly type: SemanticType | null;
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
}

/** One parameter in a resolved direct-call signature. */
export interface SignatureParameter {
  /** Value type expected by the callee. */
  readonly type: SemanticType;
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
  /** Conversion applied at this expression boundary. */
  readonly conversion: ConversionKind | null;
  /** Fixed-width integer behavior, or null for non-integers. */
  readonly integer: IntegerFacts | null;
  /** Exact literal value retained by number and Boolean nodes. */
  readonly value?: bigint | boolean | TypedExpr;
  /** Name spelling retained by name nodes. */
  readonly name?: string;
  /** Exact operator retained by unary, binary, and assignment nodes. */
  readonly operator?: string;
  /** Unary or cast operand. */
  readonly operand?: TypedExpr;
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
  /** Call arguments in source order. */
  readonly arguments?: readonly TypedExpr[];
  /** Resolved direct-call signature. */
  readonly signature?: FunctionSignature;
  /** Original type spelling retained by cast nodes. */
  readonly targetType?: TypeSyntax;
  /** Observable evaluation structure for ordered expressions. */
  readonly evaluation?:
    | "left-to-right"
    | "short-circuit"
    | "selected-arm"
    | readonly ("place" | "old-read" | "rhs" | "operation" | "store" | "result")[];
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
  | TypedForStatement
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
}

/** One lexical value scope used by direct expression lookup. */
export interface ScalarScope {
  /** Enclosing lexical scope. */
  readonly parent: ScalarScope | null;
  /** Names introduced directly in this scope. */
  readonly values: Map<string, ScalarValueState>;
}

/** Reaching values captured at one control-flow split. */
export type ScalarFactSnapshot = ReadonlyMap<ScalarValueState, bigint | boolean | null>;

/** Capture mutable reaching values without cloning declarations or scopes. */
export function snapshotScalarFacts(scope: ScalarScope): ScalarFactSnapshot {
  const facts = new Map<ScalarValueState, bigint | boolean | null>();
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) {
      if (!state.readonly && !facts.has(state)) facts.set(state, state.known);
    }
  }
  return facts;
}

/** Restore mutable reaching values before checking an alternative path. */
export function restoreScalarFacts(snapshot: ScalarFactSnapshot): void {
  for (const [state, known] of snapshot) state.known = known;
}

/** Capture only facts already present at a split, excluding branch-local declarations. */
export function captureBranchFacts(snapshot: ScalarFactSnapshot): ScalarFactSnapshot {
  return new Map([...snapshot.keys()].map((state) => [state, state.known]));
}

/** Keep a reaching value only when every alternative proves the same value. */
export function mergeScalarFacts(
  baseline: ScalarFactSnapshot,
  alternatives: readonly ScalarFactSnapshot[],
): void {
  for (const [state, fallback] of baseline) {
    const first = alternatives[0]?.get(state) ?? fallback;
    state.known = alternatives.every((facts) => facts.get(state) === first) ? first : null;
  }
}

/** Forget mutable facts after an operation with unknown writes or repeated execution. */
export function clearMutableScalarFacts(scope: ScalarScope): void {
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) if (!state.readonly) state.known = null;
  }
}

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
  /** Resolve a source name under the current scopes. */
  resolveName(name: string, context: ScalarExpressionContext): ScalarValueState | null;
  /** Resolve a source type and report an unknown type when needed. */
  resolveType(type: TypeSyntax | null): SemanticType | null;
  /** Return a direct function signature for a resolved binding. */
  signature(binding: BindingId): FunctionSignature | null;
  /** Append a proving diagnostic. */
  diagnose(diagnostic: ProjectDiagnostic): void;
  /** Retain a valid expression belonging to a later slice. */
  defer(span: SourceSpan, message: string): void;
  /** Retain one actual direct call edge. */
  call(edge: CallEdge): void;
  /** Read exact source bytes for a diagnostic expression. */
  sourceText(span: SourceSpan): string;
}
