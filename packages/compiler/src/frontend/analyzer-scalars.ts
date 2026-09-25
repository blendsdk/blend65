import { projectDiagnostic as errorDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { diagnoseArrayInitialization, updateInitializedState } from "./aggregate-initialization.js";
import { RESERVED_BUILTIN_NAMES } from "./constants.js";
import { duplicateDeclarationDiagnostic } from "./flow.js";
import { bindingIdentityKey, freezeSourceSpan } from "./semantic-types.js";
import type {
  AnalyzedDeclaration,
  ScalarExpressionContext,
  ScalarScope,
  ScalarValueState,
  SemanticBinding,
  SemanticType,
  TypedExpr,
  TypedVariableStatement,
} from "./semantic-types.js";
import type { VariableDeclaration } from "./syntax.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";

/** The existing analyzer services needed to check one local declaration. */
export interface ScalarLocalHost {
  /** Recursive expression checker shared with other declarations. */
  readonly expressions: ScalarExpressionAnalyzer;
  /** Proving diagnostics in source order. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Original source records used to locate duplicate declarations. */
  readonly sources: ReadonlyMap<string, SourceRecord>;
  /** Mutable reaching states keyed by declaration identity. */
  readonly stateByKey: Map<string, ScalarValueState>;
  /** Resolve a declared type in the current lexical scope. */
  readonly resolveType: (
    declaration: VariableDeclaration,
    context: ScalarExpressionContext,
  ) => SemanticType | null;
  /** Count errors without treating warnings as rejection. */
  readonly errorCount: () => number;
  /** Bind a checked local without inventing target storage. */
  readonly createBinding: (
    name: string,
    span: SourceSpan,
    storage: "local" | "constant",
    type: SemanticType,
    loadable?: boolean,
  ) => SemanticBinding;
}

/** Services needed to check one module variable or constant. */
export interface ScalarModuleHost {
  /** Expression checker shared with function bodies. */
  readonly expressions: ScalarExpressionAnalyzer;
  /** Ordered diagnostics for this analysis run. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Resolve the declaration's written type. */
  readonly resolveType: (declaration: VariableDeclaration, module: string) => SemanticType | null;
  /** Count diagnostics which reject a declaration. */
  readonly errorCount: () => number;
  /** Count obligations which keep a declaration unchecked. */
  readonly obligationCount: () => number;
  /** Evaluate and meter one typed scalar constant before publishing it. */
  readonly evaluateConstant?: (initializer: TypedExpr, type: SemanticType) => TypedExpr | null;
}

/** Check one module initializer while preserving exact const versus runtime context. */
export function analyzeScalarModuleVariable(
  declaration: VariableDeclaration,
  module: string,
  state: ScalarValueState,
  scope: ScalarScope,
  host: ScalarModuleHost,
): AnalyzedDeclaration {
  const before = host.errorCount();
  const obligationsBefore = host.obligationCount();
  const type = host.resolveType(declaration, module);
  let initializer = null;
  if (declaration.initializer !== null && type !== null) {
    const result = host.expressions.analyze(declaration.initializer, type, {
      scope,
      module,
      sourceId: declaration.span.sourceId,
      caller: null,
      constantContext: declaration.declarationKind === "const",
    });
    initializer = result.node;
    if (
      declaration.declarationKind === "const" &&
      initializer !== null &&
      host.evaluateConstant !== undefined
    ) {
      initializer = host.evaluateConstant(initializer, type);
    }
    state.known = initializer?.constant ?? null;
    updateInitializedState(state, result.node);
    if (
      declaration.declarationKind === "const" &&
      (type.kind === "scalar" || type.kind === "enum") &&
      initializer !== null &&
      initializer.constant === null
    ) {
      host.diagnostics.push(
        errorDiagnostic(
          "E10191",
          "Expression must be compile-time evaluable — const initializer is not constant",
          declaration.initializer.span,
        ),
      );
    }
  } else if (declaration.declarationKind === "const") {
    host.diagnostics.push(
      errorDiagnostic(
        "E10190",
        `Const declaration '${declaration.name}' requires an initializer`,
        declaration.nameSpan,
      ),
    );
  }
  if (type !== null) {
    diagnoseArrayInitialization(declaration, type, initializer, (diagnostic) =>
      host.diagnostics.push(diagnostic),
    );
  }
  if (host.obligationCount() !== obligationsBefore) {
    return Object.freeze({ kind: "unchecked", binding: state.binding.id, span: declaration.span });
  }
  if (
    type === null ||
    host.errorCount() !== before ||
    (declaration.initializer !== null && initializer === null)
  ) {
    return Object.freeze({ kind: "poison", binding: state.binding.id, span: declaration.span });
  }
  return Object.freeze({
    kind: "typed",
    binding: state.binding.id,
    type,
    initializer,
    body: null,
  });
}

/** Check a local initializer before introducing its new lexical binding. */
export function analyzeScalarLocal(
  declaration: VariableDeclaration,
  scope: ScalarScope,
  context: ScalarExpressionContext,
  host: ScalarLocalHost,
): TypedVariableStatement | null {
  const before = host.errorCount();
  const type = host.resolveType(declaration, context);
  let initializer = null;
  if (declaration.initializer !== null && type !== null) {
    const result = host.expressions.analyze(declaration.initializer, type, {
      ...context,
      constantContext: declaration.declarationKind === "const",
    });
    initializer = result.node;
  }
  if (scope.values.has(declaration.name)) {
    const first = scope.values.get(declaration.name)!;
    host.diagnostics.push(
      duplicateDeclarationDiagnostic(
        declaration.name,
        declaration.nameSpan,
        first,
        host.sources.get(first.nameSpan.sourceId),
      ),
    );
    return null;
  }
  if (RESERVED_BUILTIN_NAMES.has(declaration.name)) {
    host.diagnostics.push(
      errorDiagnostic(
        "E10212",
        `Cannot redeclare reserved built-in '${declaration.name}'`,
        declaration.nameSpan,
      ),
    );
    return null;
  }
  if (declaration.declarationKind === "const" && declaration.initializer === null) {
    host.diagnostics.push(
      errorDiagnostic(
        "E10190",
        `Const declaration '${declaration.name}' requires an initializer`,
        declaration.nameSpan,
      ),
    );
  }
  if (
    declaration.declarationKind === "const" &&
    (type?.kind === "scalar" || type?.kind === "enum") &&
    declaration.initializer !== null &&
    initializer !== null &&
    initializer.constant === null
  ) {
    host.diagnostics.push(
      errorDiagnostic(
        "E10191",
        "Expression must be compile-time evaluable — const initializer is not constant",
        declaration.initializer.span,
      ),
    );
  }
  if (type !== null) {
    diagnoseArrayInitialization(declaration, type, initializer, (diagnostic) =>
      host.diagnostics.push(diagnostic),
    );
  }
  if (
    type === null ||
    host.errorCount() !== before ||
    (declaration.initializer !== null && initializer === null)
  ) {
    return null;
  }
  const binding = host.createBinding(
    declaration.name,
    declaration.span,
    declaration.declarationKind === "const" ? "constant" : "local",
    type,
    declaration.loadable,
  );
  const state: ScalarValueState = {
    binding,
    nameSpan: freezeSourceSpan(declaration.nameSpan),
    readonly: declaration.declarationKind === "const",
    known: initializer?.constant ?? null,
    addressOrigins: initializer?.addressOrigins,
    addressPlaces: initializer?.addressPlaces,
    initialized: false,
    initializedRanges: Object.freeze([]),
    initializedPaths: Object.freeze([]),
  };
  updateInitializedState(state, initializer);
  scope.values.set(declaration.name, state);
  host.stateByKey.set(bindingIdentityKey(binding.id), state);
  if (declaration.loadable) return null;
  return Object.freeze({
    kind: "variable",
    span: freezeSourceSpan(declaration.span),
    name: declaration.name,
    binding: binding.id,
    type,
    initializer,
  });
}
