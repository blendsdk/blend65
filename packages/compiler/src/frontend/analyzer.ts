import { projectDiagnostic, sortDiagnostics } from "../project/diagnostics.js";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";
import {
  scalarDeclarationType,
  scalarFunctionSignature,
  scalarSyntaxType,
  RESERVED_BUILTIN_NAMES,
  SCALAR_TYPES,
} from "./constants.js";
import { orderScalarDeclarations, recursionDiagnostics } from "./effects.js";
import {
  analyzeStructuredFor,
  analyzeStructuredIf,
  clearMutableFacts,
  conditionDiagnostic,
  duplicateDeclarationDiagnostic,
  moduleValueScope,
  resolveScalarName,
  sourceText,
  summarizeTypedBlock,
} from "./flow.js";
import { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import {
  ANALYSIS_OBLIGATION_KIND,
  bindingIdentityKey,
  createSemanticBodyBinding,
  freezeSourceSpan,
} from "./semantic-types.js";
import type {
  AnalysisObligation,
  AnalyzedDeclaration,
  BindingId,
  CallEdge,
  FunctionSignature,
  ModuleAnalysisResult,
  ModuleGraph,
  ScalarExpressionContext as ExpressionContext,
  ScalarScope as Scope,
  ScalarValueState as ValueState,
  SemanticBinding,
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type {
  Block,
  Declaration,
  FunctionDeclaration,
  Statement,
  TypeSyntax,
  VariableDeclaration,
} from "./syntax.js";

/** Function declaration facts collected before any body is checked. */
interface FunctionInfo {
  readonly declaration: FunctionDeclaration;
  readonly binding: SemanticBinding;
  readonly signature: FunctionSignature | null;
  readonly module: string;
}

/** Compare exact source facts without locale-sensitive ordering. */
function compareSpans(left: SourceSpan, right: SourceSpan): number {
  return (
    Buffer.compare(Buffer.from(left.sourceId), Buffer.from(right.sourceId)) ||
    left.start - right.start ||
    left.end - right.end
  );
}

/** Build an error diagnostic with the shared immutable project shape. */
function errorDiagnostic(code: string, message: string, span: SourceSpan): ProjectDiagnostic {
  return projectDiagnostic(code, message, span);
}

/** Direct scalar and structured-flow analyzer over an already resolved module graph. */
class ModuleAnalyzer {
  readonly diagnostics: ProjectDiagnostic[] = [];
  readonly obligations: AnalysisObligation[] = [];
  readonly bindings: SemanticBinding[] = [];
  readonly declarations: AnalyzedDeclaration[] = [];
  readonly calls: CallEdge[] = [];
  readonly sources: ReadonlyMap<string, SourceRecord>;
  readonly bindingByKey = new Map<string, SemanticBinding>();
  readonly stateByKey = new Map<string, ValueState>();
  readonly functionByKey = new Map<string, FunctionInfo>();
  readonly declarationByKey = new Map<string, Declaration>();
  readonly moduleScopes = new Map<string, Map<string, ValueState>>();
  readonly qualified = new Map<string, ValueState>();
  readonly importsBySource = new Map<string, Map<string, ValueState>>();
  readonly expressions: ScalarExpressionAnalyzer;

  constructor(
    readonly snapshot: ProjectSnapshot,
    readonly graph: ModuleGraph,
  ) {
    this.sources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
    this.expressions = new ScalarExpressionAnalyzer({
      resolveName: (name, context) => resolveScalarName(name, context, this.qualified),
      resolveType: (type) => this.resolveType(type),
      signature: (binding) =>
        this.functionByKey.get(bindingIdentityKey(binding))?.signature ?? null,
      diagnose: (diagnostic) => this.diagnostics.push(diagnostic),
      defer: (span, message) => this.addObligation(span, message),
      call: (edge) => this.calls.push(edge),
      sourceText: (span) => sourceText(this.sources, span),
    });
    this.collectDeclarations();
    this.prepareModuleBindings();
  }

  /** Analyze every reachable declaration and assemble a frozen phase result. */
  analyze(): ModuleAnalysisResult {
    for (const { module, declaration } of orderScalarDeclarations(this.graph)) {
      this.analyzeDeclaration(module, declaration);
    }
    this.diagnostics.push(...recursionDiagnostics(this.calls, this.bindings));
    const diagnostics = sortDiagnostics(this.diagnostics);
    const bindings = Object.freeze(
      [...this.bindings].sort((a, b) => compareSpans(a.declaration, b.declaration)),
    );
    const declarations = Object.freeze(
      [...this.declarations].sort((a, b) => {
        const left = a.kind === "typed" ? a.binding.span : a.span;
        const right = b.kind === "typed" ? b.binding.span : b.span;
        return compareSpans(left, right);
      }),
    );
    const calls = Object.freeze([...this.calls].sort((a, b) => compareSpans(a.span, b.span)));
    const obligations = Object.freeze(
      [...this.obligations].sort((a, b) => {
        if (a.span === null) return b.span === null ? 0 : 1;
        if (b.span === null) return -1;
        return compareSpans(a.span, b.span);
      }),
    );
    return Object.freeze({
      modules: this.graph.modules,
      bindings,
      types: Object.freeze(Object.values(SCALAR_TYPES)),
      declarations,
      calls,
      diagnostics,
      obligations,
      complete:
        obligations.length === 0 && diagnostics.every(({ severity }) => severity !== "error"),
    });
  }

  /** Associate parsed declarations with the source-span identities created by module resolution. */
  private collectDeclarations(): void {
    for (const module of this.graph.modules) {
      for (const unit of module.units) {
        for (const declaration of unit.declarations) {
          const binding = this.graph.bindings.find(
            (candidate) =>
              candidate.qualifiedName ===
                ("name" in declaration ? `${module.name}.${declaration.name}` : null) &&
              candidate.id.sourceId === declaration.span.sourceId &&
              candidate.id.span.start === declaration.span.start &&
              candidate.id.span.end === declaration.span.end,
          );
          if (binding !== undefined)
            this.declarationByKey.set(bindingIdentityKey(binding.id), declaration);
        }
      }
    }
  }

  /** Resolve declaration headers first so body lookup is independent of source order. */
  private prepareModuleBindings(): void {
    for (const binding of this.graph.bindings) {
      const declaration = this.declarationByKey.get(bindingIdentityKey(binding.id));
      const type = declaration === undefined ? null : scalarDeclarationType(declaration);
      const semantic = Object.freeze({ ...binding, type });
      const state: ValueState = {
        binding: semantic,
        nameSpan:
          declaration !== undefined && "nameSpan" in declaration
            ? declaration.nameSpan
            : binding.declaration,
        readonly: binding.storage === "constant",
        known: null,
      };
      this.bindings.push(semantic);
      this.bindingByKey.set(bindingIdentityKey(semantic.id), semantic);
      this.stateByKey.set(bindingIdentityKey(semantic.id), state);
      if (semantic.qualifiedName !== null) {
        this.qualified.set(semantic.qualifiedName, state);
        const moduleName = semantic.qualifiedName.slice(0, -(semantic.name.length + 1));
        const scope = this.moduleScopes.get(moduleName) ?? new Map<string, ValueState>();
        scope.set(semantic.name, state);
        this.moduleScopes.set(moduleName, scope);
      }
      if (declaration?.kind === "function") {
        this.functionByKey.set(bindingIdentityKey(semantic.id), {
          declaration,
          binding: semantic,
          signature: scalarFunctionSignature(declaration),
          module: semantic.qualifiedName?.slice(0, -(semantic.name.length + 1)) ?? "",
        });
      }
    }
    for (const resolvedImport of this.graph.imports) {
      const target = this.stateByKey.get(bindingIdentityKey(resolvedImport.binding));
      if (target === undefined) continue;
      const aliases =
        this.importsBySource.get(resolvedImport.sourceSpan.sourceId) ??
        new Map<string, ValueState>();
      aliases.set(resolvedImport.alias, target);
      this.importsBySource.set(resolvedImport.sourceSpan.sourceId, aliases);
    }
  }

  /** Analyze one module declaration without allowing a failed sibling to hide later facts. */
  private analyzeDeclaration(module: string, declaration: Declaration): void {
    if (declaration.kind === "poison" || declaration.kind === "unchecked") {
      this.addObligation(
        declaration.span,
        "Source declaration is not implemented by the scalar frontend slice",
      );
      return;
    }
    const state = this.qualified.get(`${module}.${declaration.name}`);
    if (state === undefined) return;
    if (RESERVED_BUILTIN_NAMES.has(declaration.name)) {
      this.diagnostics.push(
        errorDiagnostic(
          "E10212",
          `Cannot redeclare reserved built-in '${declaration.name}'`,
          declaration.nameSpan,
        ),
      );
      this.retainUnusable("poison", state.binding.id, declaration.span);
      return;
    }
    if (declaration.kind === "struct") {
      this.addObligation(
        declaration.span,
        "Struct semantics are not implemented by the scalar frontend slice",
      );
      this.retainUnusable("unchecked", state.binding.id, declaration.span);
      return;
    }
    if (declaration.kind === "variable") this.analyzeModuleVariable(module, declaration, state);
    else this.analyzeFunction(module, declaration, state);
  }

  /** Check a module variable or constant initializer. */
  private analyzeModuleVariable(
    module: string,
    declaration: VariableDeclaration,
    state: ValueState,
  ): void {
    const before = this.errorCount();
    const obligationsBefore = this.obligations.length;
    const type = this.resolveType(declaration.type);
    const scope = moduleValueScope(
      this.moduleScopes.get(module),
      this.importsBySource.get(declaration.span.sourceId),
    );
    let initializer: TypedExpr | null = null;
    if (declaration.initializer !== null && type !== null) {
      const result = this.expressions.analyze(declaration.initializer, type, {
        scope,
        module,
        sourceId: declaration.span.sourceId,
        caller: null,
        constantContext: declaration.declarationKind === "const",
      });
      initializer = result.node;
      state.known = result.node?.constant ?? null;
      if (
        declaration.declarationKind === "const" &&
        result.node !== null &&
        result.node.constant === null
      ) {
        this.diagnostics.push(
          errorDiagnostic(
            "E10191",
            "Expression must be compile-time evaluable — const initializer is not constant",
            declaration.initializer.span,
          ),
        );
      }
    } else if (declaration.declarationKind === "const") {
      this.diagnostics.push(
        errorDiagnostic(
          "E10190",
          `Const declaration '${declaration.name}' requires an initializer`,
          declaration.nameSpan,
        ),
      );
    }
    if (this.obligations.length !== obligationsBefore) {
      this.retainUnusable("unchecked", state.binding.id, declaration.span);
      return;
    }
    if (
      type === null ||
      this.errorCount() !== before ||
      (declaration.initializer !== null && initializer === null)
    ) {
      this.retainUnusable("poison", state.binding.id, declaration.span);
      return;
    }
    this.declarations.push(
      Object.freeze({ kind: "typed", binding: state.binding.id, type, initializer, body: null }),
    );
  }

  /** Check one ordinary function signature, lexical scope, body, and return completeness. */
  private analyzeFunction(
    module: string,
    declaration: FunctionDeclaration,
    state: ValueState,
  ): void {
    const before = this.errorCount();
    const obligationsBefore = this.obligations.length;
    const returnType = this.resolveType(declaration.returnType);
    const scope: Scope = {
      parent: moduleValueScope(
        this.moduleScopes.get(module),
        this.importsBySource.get(declaration.span.sourceId),
      ),
      values: new Map(),
    };
    for (const parameter of declaration.parameters) {
      const type = this.resolveType(parameter.type);
      if (type === null) continue;
      const duplicate = scope.values.get(parameter.name);
      if (duplicate !== undefined) {
        this.diagnostics.push(
          duplicateDeclarationDiagnostic(
            parameter.name,
            parameter.nameSpan,
            duplicate,
            this.sources.get(duplicate.nameSpan.sourceId),
          ),
        );
        continue;
      }
      const binding = this.createBodyBinding(parameter.name, parameter.span, "parameter", type);
      const valueState: ValueState = {
        binding,
        nameSpan: freezeSourceSpan(parameter.nameSpan),
        readonly: parameter.readonly,
        known: null,
      };
      scope.values.set(parameter.name, valueState);
      this.stateByKey.set(bindingIdentityKey(binding.id), valueState);
    }
    clearMutableFacts(scope);
    const body =
      returnType === null
        ? null
        : this.analyzeBlock(
            declaration.body,
            scope,
            module,
            state.binding.id,
            returnType,
            0,
            false,
          );
    if (body !== null && returnType !== SCALAR_TYPES.void && summarizeTypedBlock(body).normal) {
      this.diagnostics.push(
        errorDiagnostic(
          "E10102",
          `Not all code paths return a value in function '${declaration.name}'`,
          declaration.nameSpan,
        ),
      );
    }
    if (this.obligations.length !== obligationsBefore) {
      this.retainUnusable("unchecked", state.binding.id, declaration.span);
      return;
    }
    if (returnType === null || body === null || this.errorCount() !== before) {
      this.retainUnusable("poison", state.binding.id, declaration.span);
      return;
    }
    this.declarations.push(
      Object.freeze({
        kind: "typed",
        binding: state.binding.id,
        type: returnType,
        initializer: null,
        body,
      }),
    );
  }

  /** Analyze a block, optionally sharing its scope with function parameters. */
  private analyzeBlock(
    block: Block,
    parent: Scope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
    nested = true,
  ): TypedBlock {
    const scope: Scope = nested ? { parent, values: new Map() } : parent;
    const statements: TypedStatement[] = [];
    for (const statement of block.statements) {
      const typed = this.analyzeStatement(statement, scope, module, caller, returnType, loopDepth);
      if (typed !== null) statements.push(typed);
    }
    return Object.freeze({
      kind: "block",
      span: freezeSourceSpan(block.span),
      statements: Object.freeze(statements),
    });
  }

  /** Analyze one structured statement while retaining source order. */
  private analyzeStatement(
    statement: Statement,
    scope: Scope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ): TypedStatement | null {
    const context: ExpressionContext = {
      scope,
      module,
      sourceId: statement.span.sourceId,
      caller,
      constantContext: false,
    };
    if (statement.kind === "variable") return this.analyzeLocal(statement, scope, context);
    if (statement.kind === "expression-statement") {
      const expression = this.expressions.analyze(statement.expression, null, context).node;
      return expression === null
        ? null
        : Object.freeze({
            kind: "expression-statement",
            span: freezeSourceSpan(statement.span),
            expression,
          });
    }
    if (statement.kind === "block")
      return this.analyzeBlock(statement, scope, module, caller, returnType, loopDepth);
    if (statement.kind === "if")
      return analyzeStructuredIf(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.expressions,
        this.structuredFlowHost(),
      );
    if (statement.kind === "while") {
      clearMutableFacts(scope);
      const condition = this.expressions.analyze(statement.condition, null, context).node;
      if (condition !== null) this.addConditionDiagnostic(condition, statement.condition.span);
      const body = this.analyzeBlock(
        statement.body,
        scope,
        module,
        caller,
        returnType,
        loopDepth + 1,
      );
      clearMutableFacts(scope);
      return condition === null
        ? null
        : Object.freeze({ kind: "while", span: freezeSourceSpan(statement.span), condition, body });
    }
    if (statement.kind === "for")
      return analyzeStructuredFor(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.expressions,
        this.structuredFlowHost(),
      );
    if (statement.kind === "return") {
      let value: TypedExpr | null = null;
      if (statement.value !== null)
        value = this.expressions.analyze(
          statement.value,
          returnType.name === "void" ? null : returnType,
          context,
        ).node;
      if (returnType.name === "void" && statement.value !== null) {
        const name = this.bindingByKey.get(bindingIdentityKey(caller))?.name ?? "<function>";
        this.diagnostics.push(
          errorDiagnostic(
            "E10173",
            `Cannot return a value from void function '${name}'`,
            statement.span,
          ),
        );
      } else if (returnType.name !== "void" && statement.value === null) {
        const name = this.bindingByKey.get(bindingIdentityKey(caller))?.name ?? "<function>";
        this.diagnostics.push(
          errorDiagnostic(
            "E10174",
            `Missing return value — function '${name}' returns '${returnType.name}' but this 'return' has no expression`,
            statement.span,
          ),
        );
      }
      return Object.freeze({ kind: "return", span: freezeSourceSpan(statement.span), value });
    }
    if (statement.kind === "break" || statement.kind === "continue") {
      if (loopDepth === 0) {
        this.diagnostics.push(
          errorDiagnostic(
            "E10063",
            `'${statement.kind}' can only be used inside a loop body`,
            statement.span,
          ),
        );
      }
      return Object.freeze({ kind: statement.kind, span: freezeSourceSpan(statement.span) });
    }
    this.addObligation(statement.span, "Statement is not implemented by the scalar frontend slice");
    return null;
  }

  /** Analyze a local initializer before introducing the new binding. */
  private analyzeLocal(
    declaration: VariableDeclaration,
    scope: Scope,
    context: ExpressionContext,
  ): TypedVariableStatement | null {
    const before = this.errorCount();
    const type = this.resolveType(declaration.type);
    const initializer =
      declaration.initializer === null || type === null
        ? null
        : this.expressions.analyze(declaration.initializer, type, {
            ...context,
            constantContext: declaration.declarationKind === "const",
          }).node;
    if (scope.values.has(declaration.name)) {
      const first = scope.values.get(declaration.name)!;
      this.diagnostics.push(
        duplicateDeclarationDiagnostic(
          declaration.name,
          declaration.nameSpan,
          first,
          this.sources.get(first.nameSpan.sourceId),
        ),
      );
      return null;
    }
    if (RESERVED_BUILTIN_NAMES.has(declaration.name)) {
      this.diagnostics.push(
        errorDiagnostic(
          "E10212",
          `Cannot redeclare reserved built-in '${declaration.name}'`,
          declaration.nameSpan,
        ),
      );
      return null;
    }
    if (declaration.declarationKind === "const" && declaration.initializer === null) {
      this.diagnostics.push(
        errorDiagnostic(
          "E10190",
          `Const declaration '${declaration.name}' requires an initializer`,
          declaration.nameSpan,
        ),
      );
    }
    if (
      declaration.declarationKind === "const" &&
      declaration.initializer !== null &&
      initializer !== null &&
      initializer.constant === null
    ) {
      this.diagnostics.push(
        errorDiagnostic(
          "E10191",
          "Expression must be compile-time evaluable — const initializer is not constant",
          declaration.initializer.span,
        ),
      );
    }
    if (type === null || this.errorCount() !== before) return null;
    const binding = this.createBodyBinding(
      declaration.name,
      declaration.span,
      declaration.declarationKind === "const" ? "constant" : "local",
      type,
    );
    const state: ValueState = {
      binding,
      nameSpan: freezeSourceSpan(declaration.nameSpan),
      readonly: declaration.declarationKind === "const",
      known: initializer?.constant ?? null,
    };
    scope.values.set(declaration.name, state);
    this.stateByKey.set(bindingIdentityKey(binding.id), state);
    return Object.freeze({
      kind: "variable",
      span: freezeSourceSpan(declaration.span),
      name: declaration.name,
      binding: binding.id,
      type,
      initializer,
    });
  }

  /** Bind structured-flow callbacks directly to this analysis instance. */
  private structuredFlowHost() {
    return {
      analyzeBlock: (
        block: Block,
        scope: Scope,
        module: string,
        caller: BindingId,
        returnType: SemanticType,
        loopDepth: number,
      ) => this.analyzeBlock(block, scope, module, caller, returnType, loopDepth),
      analyzeLocal: (declaration: VariableDeclaration, scope: Scope, context: ExpressionContext) =>
        this.analyzeLocal(declaration, scope, context),
      diagnose: (diagnostic: ProjectDiagnostic) => this.diagnostics.push(diagnostic),
    };
  }

  /** Add one local or parameter binding using only source identity. */
  private createBodyBinding(
    name: string,
    declaration: SourceSpan,
    storage: "local" | "parameter" | "constant",
    type: SemanticType,
  ): SemanticBinding {
    const binding = createSemanticBodyBinding(name, declaration, storage, type);
    this.bindings.push(binding);
    this.bindingByKey.set(bindingIdentityKey(binding.id), binding);
    return binding;
  }
  /** Resolve an admitted named scalar type and diagnose an unknown spelling. */
  private resolveType(type: TypeSyntax | null): SemanticType | null {
    if (type?.kind === "named-type") {
      const resolved = scalarSyntaxType(type);
      if (resolved !== null) return resolved;
    }
    if (type?.kind === "named-type") {
      this.diagnostics.push(errorDiagnostic("E10241", `Unknown type '${type.name}'`, type.span));
    } else if (type !== null) {
      this.addObligation(type.span, "Type form is not implemented by the scalar frontend slice");
    }
    return null;
  }
  /** Append a condition diagnostic only when the expression is not Boolean. */
  private addConditionDiagnostic(expression: TypedExpr, span: SourceSpan): void {
    const diagnostic = conditionDiagnostic(expression, span);
    if (diagnostic !== null) this.diagnostics.push(diagnostic);
  }
  /** Add one immutable implementation obligation. */
  private addObligation(span: SourceSpan, message: string): void {
    this.obligations.push(
      Object.freeze({
        kind: ANALYSIS_OBLIGATION_KIND.implementation,
        span: freezeSourceSpan(span),
        message,
      }),
    );
  }

  /** Retain a rejected or pending declaration without exposing typed contents. */
  private retainUnusable(kind: "poison" | "unchecked", binding: BindingId, span: SourceSpan): void {
    this.declarations.push(Object.freeze({ kind, binding, span: freezeSourceSpan(span) }));
  }
  /** Count current errors so warnings do not poison an otherwise checked declaration. */
  private errorCount(): number {
    return this.diagnostics.filter(({ severity }) => severity === "error").length;
  }
}

/**
 * Analyze scalar bodies, direct calls, and structured flow over a resolved graph.
 * @example analyzeModules(snapshot, graph).diagnostics
 */
export function analyzeModules(
  snapshot: ProjectSnapshot,
  graph: ModuleGraph,
): ModuleAnalysisResult {
  return new ModuleAnalyzer(snapshot, graph).analyze();
}
