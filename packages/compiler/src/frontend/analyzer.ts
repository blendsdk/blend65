import { projectDiagnostic as errorDiagnostic } from "../project/diagnostics.js";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";
import { isScalarType, RESERVED_BUILTIN_NAMES, SCALAR_TYPES } from "./constants.js";
import { AggregateRegistry, semanticTypeName } from "./aggregates.js";
import { assembleModuleAnalysis } from "./analysis-result.js";
import {
  diagnoseArrayInitialization,
  isDirectAggregateLiteral,
  uninitializedReadDiagnostic,
  updateInitializedState,
} from "./aggregate-initialization.js";
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
import { collectDeclarationIndex, prepareModuleBindings } from "./module-bindings.js";
import type { FunctionInfo } from "./module-bindings.js";
import { captureBranchFacts, mergeScalarFacts, snapshotScalarFacts } from "./flow-facts.js";
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

/** Direct scalar and structured-flow analyzer over an already resolved module graph. */
class ModuleAnalyzer {
  readonly diagnostics: ProjectDiagnostic[] = [];
  readonly obligations: AnalysisObligation[] = [];
  readonly bindings: SemanticBinding[];
  readonly declarations: AnalyzedDeclaration[] = [];
  readonly calls: CallEdge[] = [];
  readonly sources: ReadonlyMap<string, SourceRecord>;
  readonly bindingByKey: Map<string, SemanticBinding>;
  readonly stateByKey: Map<string, ValueState>;
  readonly functionByKey: Map<string, FunctionInfo>;
  readonly declarationByKey: Map<string, Declaration>;
  readonly moduleScopes: Map<string, Map<string, ValueState>>;
  readonly qualified: Map<string, ValueState>;
  readonly importsBySource: Map<string, Map<string, ValueState>>;
  readonly aggregates: AggregateRegistry;
  readonly expressions: ScalarExpressionAnalyzer;

  constructor(
    readonly snapshot: ProjectSnapshot,
    readonly graph: ModuleGraph,
  ) {
    this.sources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
    this.declarationByKey = collectDeclarationIndex(graph);
    this.aggregates = new AggregateRegistry(graph, this.declarationByKey, {
      diagnose: (diagnostic) => this.diagnostics.push(diagnostic),
      defer: (span, message) => this.addObligation(span, message),
      sourceText: (span) => sourceText(this.sources, span),
    });
    const prepared = prepareModuleBindings(graph, this.declarationByKey, this.aggregates);
    this.bindings = prepared.bindings;
    this.bindingByKey = prepared.bindingByKey;
    this.stateByKey = prepared.stateByKey;
    this.functionByKey = prepared.functionByKey;
    this.moduleScopes = prepared.moduleScopes;
    this.qualified = prepared.qualified;
    this.importsBySource = prepared.importsBySource;
    this.expressions = new ScalarExpressionAnalyzer(
      {
        resolveName: (name, context) => resolveScalarName(name, context, this.qualified),
        resolveType: (type, context) => this.resolveType(type, context.module, null, context.scope),
        signature: (binding) =>
          this.functionByKey.get(bindingIdentityKey(binding))?.signature ?? null,
        isFunction: (binding) => this.functionByKey.has(bindingIdentityKey(binding)),
        diagnose: (diagnostic) => this.diagnostics.push(diagnostic),
        defer: (span, message) => this.addObligation(span, message),
        call: (edge) => this.calls.push(edge),
        sourceText: (span) => sourceText(this.sources, span),
        read: (place, span) => {
          const diagnostic = uninitializedReadDiagnostic(place, span, this.stateByKey);
          if (diagnostic !== null) this.diagnostics.push(diagnostic);
        },
      },
      this.aggregates,
    );
  }

  /** Analyze every reachable declaration and assemble a frozen phase result. */
  analyze(): ModuleAnalysisResult {
    for (const { module, declaration } of orderScalarDeclarations(this.graph)) {
      this.analyzeDeclaration(module, declaration);
    }
    this.diagnostics.push(...recursionDiagnostics(this.calls, this.bindings));
    return assembleModuleAnalysis(
      this.graph,
      this.aggregates,
      this.bindings,
      this.declarations,
      this.calls,
      this.diagnostics,
      this.obligations,
    );
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
    const sourceBinding = this.graph.bindings.find(
      (binding) =>
        binding.id.sourceId === declaration.span.sourceId &&
        binding.id.span.start === declaration.span.start &&
        binding.id.span.end === declaration.span.end,
    );
    const state =
      sourceBinding === undefined
        ? undefined
        : this.stateByKey.get(bindingIdentityKey(sourceBinding.id));
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
      if (state.binding.type === null) {
        this.retainUnusable(
          this.aggregates.isDeferredStruct(state.binding.id) ? "unchecked" : "poison",
          state.binding.id,
          declaration.span,
        );
      } else {
        this.declarations.push(
          Object.freeze({
            kind: "typed",
            binding: state.binding.id,
            type: state.binding.type,
            initializer: null,
            body: null,
          }),
        );
      }
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
    const type = this.resolveType(declaration.type, module, declaration.initializer);
    const scope = moduleValueScope(
      this.moduleScopes.get(module),
      this.importsBySource.get(declaration.span.sourceId),
    );
    let initializer: TypedExpr | null = null;
    if (declaration.initializer !== null && type !== null) {
      const aggregateCopy =
        type.kind !== "scalar" && !isDirectAggregateLiteral(type, declaration.initializer);
      const result = this.expressions.analyze(declaration.initializer, type, {
        scope,
        module,
        sourceId: declaration.span.sourceId,
        caller: null,
        constantContext: declaration.declarationKind === "const",
      });
      if (aggregateCopy) {
        if (result.node !== null) {
          this.addObligation(
            declaration.initializer.span,
            "Whole aggregate initialization and copy lowering remain pending",
          );
        }
      } else {
        initializer = result.node;
        state.known = result.node?.constant ?? null;
        updateInitializedState(state, result.node);
      }
      if (
        declaration.declarationKind === "const" &&
        type.kind === "scalar" &&
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
    } else if (declaration.declarationKind === "const") {
      this.diagnostics.push(
        errorDiagnostic(
          "E10190",
          `Const declaration '${declaration.name}' requires an initializer`,
          declaration.nameSpan,
        ),
      );
    }
    if (type !== null) {
      diagnoseArrayInitialization(declaration, type, initializer, (diagnostic) =>
        this.diagnostics.push(diagnostic),
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
    const signature = this.aggregates.functionSignature(declaration, module, true);
    if (signature === null) {
      this.retainUnusable(
        this.obligations.length !== obligationsBefore ? "unchecked" : "poison",
        state.binding.id,
        declaration.span,
      );
      return;
    }
    const returnType = signature.returnType;
    const scope: Scope = {
      parent: moduleValueScope(
        this.moduleScopes.get(module),
        this.importsBySource.get(declaration.span.sourceId),
      ),
      values: new Map(),
    };
    for (const parameter of declaration.parameters) {
      const type = this.resolveType(parameter.type, module, null);
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
        initialized: true,
        initializedRanges:
          type.kind === "array"
            ? Object.freeze([{ start: 0, end: type.length }])
            : Object.freeze([]),
        initializedPaths: Object.freeze([]),
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
      const loopEntry = snapshotScalarFacts(scope);
      const body = this.analyzeBlock(
        statement.body,
        scope,
        module,
        caller,
        returnType,
        loopDepth + 1,
      );
      const bodyFacts = captureBranchFacts(loopEntry);
      mergeScalarFacts(loopEntry, [loopEntry, bodyFacts]);
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
          isScalarType(returnType) && returnType.name === "void" ? null : returnType,
          context,
        ).node;
      if (isScalarType(returnType) && returnType.name === "void" && statement.value !== null) {
        const name = this.bindingByKey.get(bindingIdentityKey(caller))?.name ?? "<function>";
        this.diagnostics.push(
          errorDiagnostic(
            "E10173",
            `Cannot return a value from void function '${name}'`,
            statement.span,
          ),
        );
      } else if (
        (!isScalarType(returnType) || returnType.name !== "void") &&
        statement.value === null
      ) {
        const name = this.bindingByKey.get(bindingIdentityKey(caller))?.name ?? "<function>";
        this.diagnostics.push(
          errorDiagnostic(
            "E10174",
            `Missing return value — function '${name}' returns '${semanticTypeName(returnType)}' but this 'return' has no expression`,
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
    const type = this.resolveType(declaration.type, context.module, declaration.initializer, scope);
    let initializer: TypedExpr | null = null;
    if (declaration.initializer !== null && type !== null) {
      const aggregateCopy =
        type.kind !== "scalar" && !isDirectAggregateLiteral(type, declaration.initializer);
      const result = this.expressions.analyze(declaration.initializer, type, {
        ...context,
        constantContext: declaration.declarationKind === "const",
      });
      if (aggregateCopy) {
        if (result.node !== null) {
          this.addObligation(
            declaration.initializer.span,
            "Whole aggregate initialization and copy lowering remain pending",
          );
        }
      } else {
        initializer = result.node;
      }
    }
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
      type?.kind === "scalar" &&
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
    if (type !== null) {
      diagnoseArrayInitialization(declaration, type, initializer, (diagnostic) =>
        this.diagnostics.push(diagnostic),
      );
    }
    if (
      type === null ||
      this.errorCount() !== before ||
      (declaration.initializer !== null && initializer === null)
    )
      return null;
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
      initialized: false,
      initializedRanges: Object.freeze([]),
      initializedPaths: Object.freeze([]),
    };
    updateInitializedState(state, initializer);
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

  /** Resolve an admitted scalar, nominal struct, or fixed array type. */
  private resolveType(
    type: TypeSyntax | null,
    module: string,
    initializer: VariableDeclaration["initializer"],
    scope?: Scope,
  ): SemanticType | null {
    return this.aggregates.resolveType(type, module, initializer, true, scope);
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
