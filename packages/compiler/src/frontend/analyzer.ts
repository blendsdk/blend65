import { projectDiagnostic as errorDiagnostic } from "../project/diagnostics.js";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";
import { RESERVED_BUILTIN_NAMES, SCALAR_TYPES } from "./constants.js";
import { AggregateRegistry } from "./aggregates.js";
import { BodyAnalyzer } from "./analyzer-body.js";
import { assembleModuleAnalysis } from "./analysis-result.js";
import { uninitializedReadDiagnostic } from "./aggregate-initialization.js";
import { recursionDiagnostics } from "./call-cycles.js";
import { ComptimeBudget } from "./comptime-budget.js";
import type { ComptimeBudgetLimits } from "./comptime-budget.js";
import { ComptimeEvaluator } from "./comptime.js";
import { visitExpressionBindings } from "./comptime-dependencies.js";
import { initializerBytes } from "./constant-bytes.js";
import { orderScalarDeclarations } from "./effects.js";
import {
  clearMutableFacts,
  moduleValueScope,
  resolveScalarName,
  sourceText,
  summarizeTypedBlock,
} from "./flow.js";
import { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import { checkStatusStack } from "./status-stack.js";
import { analyzeScalarLocal, analyzeScalarModuleVariable } from "./analyzer-scalars.js";
import { collectDeclarationIndex, prepareModuleBindings } from "./module-bindings.js";
import { checkedPlacement } from "./placement.js";
import { addProfileBindings } from "./profile-bindings.js";
import { prepareFunctionParameters } from "./function-parameters.js";
import { diagnoseUnusedDeclarations, diagnoseDeclarationResources } from "./source-advisories.js";
import type { FunctionInfo } from "./module-bindings.js";
import type { FrontendProfile } from "./profile.js";
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
  TypedExpr,
  TypedVariableStatement,
  FunctionSignature,
} from "./semantic-types.js";
import type {
  Declaration,
  FunctionDeclaration,
  TypeSyntax,
  VariableDeclaration,
} from "./syntax.js";
import type { EmbeddedValue } from "../assets/asset-types.js";

/** Direct scalar and structured-flow analyzer over an already resolved module graph. */
class ModuleAnalyzer {
  /** Source binding references by owning function; the empty owner denotes module/type roots. */
  private readonly references = new Map<string, Set<string>>();
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
  private readonly evaluator: ComptimeEvaluator;
  private readonly body: BodyAnalyzer;
  /** Immutable packed constants, encoded once when their declaration is published. */
  private readonly constantAggregates = new Map<string, readonly number[]>();
  readonly profileSignatures = new Map<string, FunctionSignature>();

  constructor(
    readonly snapshot: ProjectSnapshot,
    readonly graph: ModuleGraph,
    readonly profile: FrontendProfile | null,
    readonly embeddedValues: ReadonlyMap<string, EmbeddedValue>,
    budgetLimits?: ComptimeBudgetLimits,
  ) {
    this.sources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
    this.declarationByKey = collectDeclarationIndex(graph);
    this.aggregates = new AggregateRegistry(graph, this.declarationByKey, {
      reference: (binding) => this.recordReference(null, binding),
      diagnose: (diagnostic) => this.diagnostics.push(diagnostic),
      defer: (span, message) => this.addObligation(span, message),
      sourceText: (span) => sourceText(this.sources, span),
      embeddedExtent: (initializer) =>
        this.embeddedValues.get(
          `${initializer.span.sourceId}:${initializer.span.start}:${initializer.span.end}`,
        )?.type.length ?? null,
    });
    const prepared = prepareModuleBindings(graph, this.declarationByKey, this.aggregates);
    this.bindings = prepared.bindings;
    this.bindingByKey = prepared.bindingByKey;
    this.stateByKey = prepared.stateByKey;
    this.functionByKey = prepared.functionByKey;
    this.moduleScopes = prepared.moduleScopes;
    this.qualified = prepared.qualified;
    this.importsBySource = prepared.importsBySource;
    this.evaluator = new ComptimeEvaluator(
      new ComptimeBudget(budgetLimits),
      (binding) => this.stateByKey.get(bindingIdentityKey(binding))?.known ?? null,
      (diagnostic) => this.diagnostics.push(diagnostic),
      (binding) => this.constantAggregates.get(bindingIdentityKey(binding)) ?? null,
    );
    addProfileBindings(this.profile, this.graph, this);
    this.expressions = new ScalarExpressionAnalyzer(
      {
        profileId: this.profile?.id ?? null,
        resolveName: (name, context) => {
          const state = resolveScalarName(name, context, this.qualified);
          if (state !== null) this.recordReference(context.caller, state.binding.id);
          return state;
        },
        resolveType: (type, context) => this.resolveType(type, context.module, null, context.scope),
        signature: (binding) =>
          this.functionByKey.get(bindingIdentityKey(binding))?.signature ??
          this.profileSignatures.get(bindingIdentityKey(binding)) ??
          null,
        isFunction: (binding) =>
          this.functionByKey.has(bindingIdentityKey(binding)) ||
          this.profileSignatures.has(bindingIdentityKey(binding)),
        functionMode: (binding) =>
          this.functionByKey.get(bindingIdentityKey(binding))?.declaration.mode ?? null,
        comptimeCall: (expression) => this.evaluateComptimeExpression(expression, expression.type),
        diagnose: (diagnostic) => this.diagnostics.push(diagnostic),
        defer: (span, message) => this.addObligation(span, message),
        call: (edge) => this.calls.push(edge),
        sourceText: (span) => sourceText(this.sources, span),
        read: (place, span) => {
          const diagnostic = uninitializedReadDiagnostic(place, span, this.stateByKey);
          if (diagnostic !== null) this.diagnostics.push(diagnostic);
        },
        embeddedValue: (expression) =>
          this.embeddedValues.get(
            `${expression.span.sourceId}:${expression.span.start}:${expression.span.end}`,
          ) ?? null,
      },
      this.aggregates,
    );
    this.body = new BodyAnalyzer({
      diagnostics: this.diagnostics,
      expressions: this.expressions,
      sources: this.sources,
      bindingByKey: this.bindingByKey,
      functionByKey: this.functionByKey,
      analyzeLocal: (declaration, scope, context) => this.analyzeLocal(declaration, scope, context),
      addObligation: (span, message) => this.addObligation(span, message),
    });
  }

  /** Analyze every reachable declaration and assemble a frozen phase result. */
  analyze(): ModuleAnalysisResult {
    const work = orderScalarDeclarations(this.graph);
    for (const { module, declaration } of work) {
      if (declaration.kind === "function" && declaration.mode === "comptime") {
        this.analyzeDeclaration(module, declaration);
      }
    }
    const dependencies = this.evaluator.constantDependencies(this.bindingByKey);
    for (const { module, declaration } of orderScalarDeclarations(this.graph, dependencies)) {
      if (declaration.kind === "function" && declaration.mode === "comptime") continue;
      this.analyzeDeclaration(module, declaration);
    }
    this.diagnostics.push(...recursionDiagnostics(this.calls, this.bindings));
    if (this.errorCount() === 0 && this.obligations.length === 0) {
      this.diagnostics.push(
        ...diagnoseUnusedDeclarations(this.stateByKey, this.functionByKey, this.references),
      );
      this.diagnostics.push(...diagnoseDeclarationResources(this.stateByKey, this.profile));
    }
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
    if (declaration.kind === "poison") return;
    if (declaration.kind === "unchecked") {
      this.addObligation(
        declaration.span,
        "Source declaration is not implemented by the scalar frontend slice",
      );
      return;
    }
    if (declaration.kind === "zeropage") {
      for (const variable of declaration.variables) this.analyzeDeclaration(module, variable);
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
    if (declaration.kind === "enum" || declaration.kind === "struct") {
      if (state.binding.type === null) {
        this.retainUnusable(
          declaration.kind === "struct" && this.aggregates.isDeferredStruct(state.binding.id)
            ? "unchecked"
            : "poison",
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
    else if (declaration.kind === "function") this.analyzeFunction(module, declaration, state);
  }

  /** Replace a successful compile-time expression with its complete retained value. */
  private evaluateComptimeExpression(
    initializer: TypedExpr,
    type: SemanticType,
    rootName = `${initializer.span.sourceId}:${initializer.span.start}`,
  ): TypedExpr | null {
    if (type.kind === "array" || type.kind === "struct") {
      let invokesComptime = false;
      visitExpressionBindings(initializer, (binding) => {
        invokesComptime ||=
          this.functionByKey.get(bindingIdentityKey(binding))?.declaration.mode === "comptime";
      });
      if (!invokesComptime) return initializer;
    }
    const value = this.evaluator.evaluateRoot(initializer, type, rootName);
    if (value === null) return null;
    if (typeof value === "object") {
      return Object.freeze({
        ...initializer,
        encodedBytes: Object.freeze([...value]),
        ...(type.kind === "array"
          ? { initialized: Object.freeze([{ start: 0, end: type.length }]) }
          : {}),
      });
    }
    return Object.freeze({ ...initializer, constant: value });
  }

  /** Check a module variable or constant initializer. */
  private analyzeModuleVariable(
    module: string,
    declaration: VariableDeclaration,
    state: ValueState,
  ): void {
    const scope = moduleValueScope(
      this.moduleScopes.get(module),
      this.importsBySource.get(declaration.span.sourceId),
    );
    const placement = checkedPlacement(
      declaration.placement,
      { scope, module, sourceId: declaration.span.sourceId, caller: null, constantContext: true },
      this.expressions,
      this.diagnostics,
      declaration.name,
    );
    const analyzed = analyzeScalarModuleVariable(declaration, module, state, scope, {
      expressions: this.expressions,
      diagnostics: this.diagnostics,
      resolveType: (item, owner) => this.resolveType(item.type, owner, item.initializer),
      errorCount: () => this.errorCount(),
      obligationCount: () => this.obligations.length,
      evaluateConstant: (initializer, type) => {
        return this.evaluateComptimeExpression(initializer, type, `${module}.${declaration.name}`);
      },
    });
    if (
      declaration.declarationKind === "const" &&
      analyzed.kind === "typed" &&
      analyzed.initializer !== null &&
      (analyzed.type.kind === "array" || analyzed.type.kind === "struct")
    ) {
      this.retainConstantAggregate(analyzed.binding, analyzed.initializer, analyzed.type);
    }
    this.declarations.push(
      declaration.placement !== null && placement === null
        ? Object.freeze({ kind: "poison", binding: state.binding.id, span: declaration.span })
        : analyzed.kind === "typed"
          ? Object.freeze({
              ...analyzed,
              placement,
              loadable: declaration.loadable,
              zeropage: declaration.zeropage,
            })
          : analyzed,
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
    const placement = checkedPlacement(
      declaration.placement,
      { scope, module, sourceId: declaration.span.sourceId, caller: null, constantContext: true },
      this.expressions,
      this.diagnostics,
      declaration.name,
    );
    const parameterBindings = prepareFunctionParameters(declaration, signature, scope, {
      sources: this.sources,
      diagnostics: this.diagnostics,
      stateByKey: this.stateByKey,
      createBinding: (name, span, storage, type, loadable, outerUnsized) =>
        this.createBodyBinding(name, span, storage, type, loadable, outerUnsized),
    });
    clearMutableFacts(scope);
    const body =
      returnType === null
        ? null
        : this.body.analyzeBlock(
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
          declaration.span,
        ),
      );
    }
    const statusStack = body === null ? null : checkStatusStack(body, declaration.name);
    if (statusStack !== null) this.diagnostics.push(...statusStack.diagnostics);
    if (this.obligations.length !== obligationsBefore) {
      this.retainUnusable("unchecked", state.binding.id, declaration.span);
      return;
    }
    if (returnType === null || body === null || this.errorCount() !== before) {
      this.retainUnusable("poison", state.binding.id, declaration.span);
      return;
    }
    if (declaration.mode === "comptime") {
      this.evaluator.registerFunction({
        binding: state.binding.id,
        parameters: Object.freeze(parameterBindings),
        body,
      });
    } else {
      this.declarations.push(
        Object.freeze({
          kind: "typed",
          binding: state.binding.id,
          type: returnType,
          initializer: null,
          body,
          statusStackPeak: statusStack?.peak ?? 0,
          placement,
        }),
      );
    }
  }

  /** Analyze a local initializer before introducing the new binding. */
  private analyzeLocal(
    declaration: VariableDeclaration,
    scope: Scope,
    context: ExpressionContext,
  ): TypedVariableStatement | null {
    const inComptime =
      context.caller !== null &&
      this.functionByKey.get(bindingIdentityKey(context.caller))?.declaration.mode === "comptime";
    const analyzed = analyzeScalarLocal(declaration, scope, context, {
      evaluateConstant: (initializer, type) =>
        inComptime
          ? initializer
          : this.evaluateComptimeExpression(
              initializer,
              type,
              `${context.module}.${declaration.name}`,
            ),
      expressions: this.expressions,
      diagnostics: this.diagnostics,
      sources: this.sources,
      stateByKey: this.stateByKey,
      resolveType: (item, active) =>
        this.resolveType(item.type, active.module, item.initializer, active.scope),
      errorCount: () => this.errorCount(),
      createBinding: (name, span, storage, type, loadable) =>
        this.createBodyBinding(name, span, storage, type, loadable),
    });
    if (
      !inComptime &&
      declaration.declarationKind === "const" &&
      analyzed?.initializer !== null &&
      analyzed !== null
    ) {
      this.retainConstantAggregate(analyzed.binding, analyzed.initializer, analyzed.type);
    }
    return analyzed;
  }

  /** Pack a published immutable aggregate once; unavailable roots are never cached. */
  private retainConstantAggregate(
    binding: BindingId,
    initializer: TypedExpr,
    type: SemanticType,
  ): void {
    if (type.kind !== "array" && type.kind !== "struct") return;
    const bytes = initializer.embedded?.bytes ?? initializerBytes(initializer, type);
    if (bytes !== null) this.constantAggregates.set(bindingIdentityKey(binding), bytes);
  }

  /** Add one local or parameter binding using only source identity. */
  private createBodyBinding(
    name: string,
    declaration: SourceSpan,
    storage: "local" | "parameter" | "constant",
    type: SemanticType,
    loadable = false,
    outerUnsized?: true,
  ): SemanticBinding {
    const ordinary = createSemanticBodyBinding(name, declaration, storage, type);
    const binding =
      loadable || outerUnsized
        ? Object.freeze({
            ...ordinary,
            ...(loadable ? { loadable: true } : {}),
            ...(outerUnsized ? { outerUnsized: true as const } : {}),
          })
        : ordinary;
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
  /** Retain a source dependency independently of target execution and storage. */
  private recordReference(caller: BindingId | null, binding: BindingId): void {
    const owner = caller === null ? "" : bindingIdentityKey(caller);
    const targets = this.references.get(owner) ?? new Set<string>();
    targets.add(bindingIdentityKey(binding));
    this.references.set(owner, targets);
  }
}

/**
 * Analyze scalar bodies, direct calls, and structured flow over a resolved graph.
 * @example analyzeModules(snapshot, graph).diagnostics
 */
export function analyzeModules(
  snapshot: ProjectSnapshot,
  graph: ModuleGraph,
  profile: FrontendProfile | null = null,
  embeddedValues: ReadonlyMap<string, EmbeddedValue> = new Map(),
  budgetLimits?: ComptimeBudgetLimits,
): ModuleAnalysisResult {
  return new ModuleAnalyzer(snapshot, graph, profile, embeddedValues, budgetLimits).analyze();
}
