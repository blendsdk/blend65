import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type {
  BindingId,
  EffectAnalysisResult,
  EffectPlace,
  EffectSummary,
  ModuleAnalysisResult,
  ModuleGraph,
  ProfileEffect,
  SemanticBinding,
  TypedBlock,
  TypedDeclaration,
  TypedExpr,
  TypedStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type { Declaration, Expr, VariableDeclaration } from "./syntax.js";

/** One source declaration paired with its resolved module. */
export interface ScalarDeclarationWork {
  /** Module which owns the declaration. */
  readonly module: string;
  /** Parsed declaration to analyze. */
  readonly declaration: Declaration;
}

/** A declaration work item known to own a scalar constant. */
interface ScalarConstantWork extends ScalarDeclarationWork {
  readonly declaration: VariableDeclaration & { readonly declarationKind: "const" };
}

/** Return whether a declaration is a compile-time scalar constant. */
function isConstantDeclaration(
  declaration: Declaration,
): declaration is VariableDeclaration & { readonly declarationKind: "const" } {
  return declaration.kind === "variable" && declaration.declarationKind === "const";
}

/** Narrow a work item to a compile-time scalar constant. */
function isConstantWork(item: ScalarDeclarationWork): item is ScalarConstantWork {
  return isConstantDeclaration(item.declaration);
}

/** Collect value names read by the admitted scalar expression forms. */
function expressionNames(expression: Expr): readonly string[] {
  switch (expression.kind) {
    case "name":
      return [expression.name];
    case "unary":
    case "cast":
      return expressionNames(expression.operand);
    case "binary":
      return [...expressionNames(expression.left), ...expressionNames(expression.right)];
    case "conditional":
      return [
        ...expressionNames(expression.condition),
        ...expressionNames(expression.whenTrue),
        ...expressionNames(expression.whenFalse),
      ];
    case "assignment":
      return [...expressionNames(expression.target), ...expressionNames(expression.value)];
    case "call":
      return [
        ...expressionNames(expression.callee),
        ...expression.arguments.flatMap((argument) => expressionNames(argument)),
      ];
    default:
      return [];
  }
}

/**
 * Analyze compile-time constants before their users while preserving source
 * order for runtime declarations and functions.
 */
export function orderScalarDeclarations(graph: ModuleGraph): readonly ScalarDeclarationWork[] {
  const work: ScalarDeclarationWork[] = graph.modules.flatMap((module) =>
    module.units.flatMap((unit) =>
      unit.declarations.map((declaration) => ({ module: module.name, declaration })),
    ),
  );
  const constants = work.filter(isConstantWork);
  const byQualifiedName = new Map(
    constants.map((item) => [`${item.module}.${item.declaration.name}`, item]),
  );
  const imports = new Map(
    graph.imports.map((item) => [
      `${item.sourceSpan.sourceId}\0${item.alias}`,
      bindingIdentityKey(item.binding),
    ]),
  );
  const byBinding = new Map(
    constants.flatMap((item) => {
      const binding = graph.bindings.find(
        (candidate) =>
          candidate.qualifiedName === `${item.module}.${item.declaration.name}` &&
          candidate.id.sourceId === item.declaration.span.sourceId &&
          candidate.id.span.start === item.declaration.span.start,
      );
      return binding === undefined ? [] : [[bindingIdentityKey(binding.id), item] as const];
    }),
  );
  const ordered: ScalarDeclarationWork[] = [];
  const visited = new Set<ScalarDeclarationWork>();
  const active = new Set<ScalarDeclarationWork>();

  const visit = (item: ScalarDeclarationWork): void => {
    if (visited.has(item) || active.has(item)) return;
    active.add(item);
    const declaration = item.declaration;
    if (isConstantDeclaration(declaration) && declaration.initializer !== null) {
      for (const name of expressionNames(declaration.initializer)) {
        const imported = imports.get(`${declaration.span.sourceId}\0${name}`);
        const dependency =
          (imported === undefined ? undefined : byBinding.get(imported)) ??
          byQualifiedName.get(`${item.module}.${name}`);
        if (dependency !== undefined) visit(dependency);
      }
    }
    active.delete(item);
    visited.add(item);
    ordered.push(item);
  };

  for (const item of constants) visit(item);
  return Object.freeze([
    ...ordered,
    ...work.filter(({ declaration }) => !isConstantDeclaration(declaration)),
  ]);
}

/** One direct call retained while a function or initializer is scanned. */
interface EffectCall {
  /** Resolved callee identity. */
  readonly callee: BindingId;
  /** Typed arguments in source order. */
  readonly arguments: readonly TypedExpr[];
  /** Complete call expression used as transitive provenance. */
  readonly span: SourceSpan;
}

/** Mutable facts used only while one typed region is scanned. */
interface EffectFacts {
  readonly reads: Map<string, EffectPlace>;
  readonly readOrigins: Map<string, SourceSpan[]>;
  readonly writes: Map<string, EffectPlace>;
  readonly calls: EffectCall[];
  readonly operationEffects: Set<Exclude<ProfileEffect, "pure">>;
  opaque: boolean;
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/** Render one place as a deterministic deduplication key. */
function effectPlaceKey(place: EffectPlace): string {
  const path = place.path
    .map((part) =>
      typeof part === "string"
        ? `.${part}`
        : `[${part.span.sourceId}:${part.span.start}:${part.span.end}]`,
    )
    .join("");
  return `${bindingIdentityKey(place.binding)}${path}:${place.readonly ? "r" : "w"}`;
}

/** Publish only the source-visible place fields promised by effect summaries. */
function effectPlace(place: {
  readonly binding: BindingId;
  readonly path: readonly (string | TypedExpr)[];
  readonly readonly: boolean;
}): EffectPlace {
  return Object.freeze({
    binding: place.binding,
    path: Object.freeze([...place.path]),
    readonly: place.readonly,
  });
}

function addPlace(target: Map<string, EffectPlace>, place: EffectPlace): void {
  target.set(effectPlaceKey(place), place);
}

/** Retain a visible read and each distinct source location which proves it. */
function addRead(facts: EffectFacts, place: EffectPlace, origins: readonly SourceSpan[]): void {
  const key = effectPlaceKey(place);
  addPlace(facts.reads, place);
  const existing = facts.readOrigins.get(key) ?? [];
  for (const origin of origins) {
    if (
      !existing.some(
        (candidate) =>
          candidate.sourceId === origin.sourceId &&
          candidate.start === origin.start &&
          candidate.end === origin.end,
      )
    ) {
      existing.push(Object.freeze({ ...origin }));
    }
  }
  facts.readOrigins.set(key, existing);
}

/** Return whether a place can affect callers or module initialization. */
function isVisibleEffect(
  place: EffectPlace,
  bindings: ReadonlyMap<string, SemanticBinding>,
): boolean {
  const binding = bindings.get(bindingIdentityKey(place.binding));
  return (
    binding?.storage === "module" ||
    (binding?.storage === "parameter" && binding.type !== null && binding.type.kind !== "scalar")
  );
}

/** Scan index expressions needed to compute an aggregate place exactly once. */
function scanPlacePath(
  place: { readonly path: readonly (string | TypedExpr)[] },
  facts: EffectFacts,
  bindings: ReadonlyMap<string, SemanticBinding>,
): void {
  for (const part of place.path) {
    if (typeof part !== "string") scanExpression(part, facts, bindings);
  }
}

/** Scan one typed expression for direct reads, writes, calls, and volatile access. */
function scanExpression(
  expression: TypedExpr,
  facts: EffectFacts,
  bindings: ReadonlyMap<string, SemanticBinding>,
): void {
  if (expression.kind === "assignment" && expression.target !== undefined) {
    const target = expression.target;
    if (target.place !== null) {
      scanPlacePath(target.place, facts, bindings);
      const place = effectPlace(target.place);
      if (expression.operator !== "=" && isVisibleEffect(place, bindings)) {
        addRead(facts, place, [target.span]);
      }
      if (isVisibleEffect(place, bindings)) addPlace(facts.writes, place);
    } else {
      scanExpression(target, facts, bindings);
    }
    const value = expression.value;
    if (typeof value === "object" && value !== null && "kind" in value) {
      scanExpression(value, facts, bindings);
    }
    return;
  }

  if (expression.kind === "call") {
    const arguments_ = expression.arguments ?? [];
    arguments_.forEach((argument, index) => {
      const parameter = expression.signature?.parameters[index];
      if (parameter !== undefined && parameter.type.kind !== "scalar" && argument.place !== null) {
        scanPlacePath(argument.place, facts, bindings);
      } else {
        scanExpression(argument, facts, bindings);
      }
    });
    if (expression.memory !== undefined && expression.memory !== null) facts.opaque = true;
    if (expression.callee?.binding !== null && expression.callee?.binding !== undefined) {
      const operationEffect = bindings.get(
        bindingIdentityKey(expression.callee.binding),
      )?.operationEffect;
      if (operationEffect !== undefined && operationEffect !== "pure") {
        facts.operationEffects.add(operationEffect);
        facts.opaque = true;
      }
      facts.calls.push(
        Object.freeze({
          callee: expression.callee.binding,
          arguments: Object.freeze(arguments_),
          span: Object.freeze({ ...expression.span }),
        }),
      );
    }
    return;
  }

  if (
    expression.kind === "binary" &&
    expression.evaluation === "short-circuit" &&
    expression.left !== undefined &&
    expression.right !== undefined
  ) {
    scanExpression(expression.left, facts, bindings);
    const left = expression.left.constant;
    const evaluatesRight =
      typeof left !== "boolean" ||
      (expression.operator === "&&" ? left : expression.operator === "||" ? !left : true);
    if (evaluatesRight) scanExpression(expression.right, facts, bindings);
    return;
  }

  if (
    expression.kind === "conditional" &&
    expression.condition !== undefined &&
    expression.whenTrue !== undefined &&
    expression.whenFalse !== undefined
  ) {
    scanExpression(expression.condition, facts, bindings);
    const condition = expression.condition.constant;
    if (condition === true) scanExpression(expression.whenTrue, facts, bindings);
    else if (condition === false) scanExpression(expression.whenFalse, facts, bindings);
    else {
      scanExpression(expression.whenTrue, facts, bindings);
      scanExpression(expression.whenFalse, facts, bindings);
    }
    return;
  }

  if (expression.place !== null) {
    scanPlacePath(expression.place, facts, bindings);
    const place = effectPlace(expression.place);
    if (isVisibleEffect(place, bindings)) addRead(facts, place, [expression.span]);
    return;
  }

  if (expression.operand !== undefined && "constant" in expression.operand) {
    scanExpression(expression.operand, facts, bindings);
  }
  if (expression.left !== undefined) scanExpression(expression.left, facts, bindings);
  if (expression.right !== undefined) scanExpression(expression.right, facts, bindings);
  if (expression.condition !== undefined) scanExpression(expression.condition, facts, bindings);
  if (expression.whenTrue !== undefined) scanExpression(expression.whenTrue, facts, bindings);
  if (expression.whenFalse !== undefined) scanExpression(expression.whenFalse, facts, bindings);
  if (expression.object !== undefined) scanExpression(expression.object, facts, bindings);
  if (expression.index !== undefined) scanExpression(expression.index, facts, bindings);
  for (const field of expression.fields ?? []) scanExpression(field.value, facts, bindings);
  for (const element of expression.elements ?? []) scanExpression(element, facts, bindings);
  if (expression.fill !== undefined && expression.fill !== null) {
    scanExpression(expression.fill, facts, bindings);
  }
}

/** Scan one typed statement while preserving its source evaluation order. */
function scanStatement(
  statement: TypedStatement,
  facts: EffectFacts,
  bindings: ReadonlyMap<string, SemanticBinding>,
): void {
  if (statement.kind === "variable") {
    if (statement.initializer !== null) scanExpression(statement.initializer, facts, bindings);
  } else if (statement.kind === "expression-statement") {
    scanExpression(statement.expression, facts, bindings);
  } else if (statement.kind === "block") {
    scanBlock(statement, facts, bindings);
  } else if (statement.kind === "if") {
    scanExpression(statement.condition, facts, bindings);
    if (statement.condition.constant === true) scanBlock(statement.then, facts, bindings);
    else if (statement.condition.constant === false) {
      if (statement.otherwise !== null) scanStatement(statement.otherwise, facts, bindings);
    } else {
      scanBlock(statement.then, facts, bindings);
      if (statement.otherwise !== null) scanStatement(statement.otherwise, facts, bindings);
    }
  } else if (statement.kind === "while") {
    scanExpression(statement.condition, facts, bindings);
    if (statement.condition.constant !== false) scanBlock(statement.body, facts, bindings);
  } else if (statement.kind === "for") {
    if (statement.initializer !== null) {
      if (isTypedExpressionList(statement.initializer)) {
        for (const expression of statement.initializer) scanExpression(expression, facts, bindings);
      } else if (statement.initializer.initializer !== null) {
        scanExpression(statement.initializer.initializer, facts, bindings);
      }
    }
    if (statement.condition !== null) scanExpression(statement.condition, facts, bindings);
    if (statement.condition?.constant !== false) {
      scanBlock(statement.body, facts, bindings);
      for (const expression of statement.update ?? []) scanExpression(expression, facts, bindings);
    }
  } else if (
    statement.kind === "return" &&
    statement.value !== undefined &&
    statement.value !== null
  ) {
    scanExpression(statement.value, facts, bindings);
  }
}

/** Narrow a typed for initializer without relying on mutable-array inference. */
function isTypedExpressionList(
  initializer: TypedVariableStatement | readonly TypedExpr[],
): initializer is readonly TypedExpr[] {
  return Array.isArray(initializer);
}

/** Scan every statement in one typed block. */
function scanBlock(
  block: TypedBlock,
  facts: EffectFacts,
  bindings: ReadonlyMap<string, SemanticBinding>,
): void {
  for (const statement of block.statements) scanStatement(statement, facts, bindings);
}

function emptyFacts(): EffectFacts {
  return {
    reads: new Map(),
    readOrigins: new Map(),
    writes: new Map(),
    calls: [],
    operationEffects: new Set(),
    opaque: false,
  };
}

/** Return whether an index expression depends on a callee-local parameter. */
function expressionUsesBindings(expression: TypedExpr, bindings: ReadonlySet<string>): boolean {
  const pending: TypedExpr[] = [expression];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.binding !== null && bindings.has(bindingIdentityKey(current.binding))) return true;
    const value = current.value;
    if (typeof value === "object" && value !== null && "kind" in value) pending.push(value);
    const operand = current.operand;
    if (operand !== undefined && "constant" in operand) pending.push(operand);
    for (const child of [
      current.left,
      current.right,
      current.condition,
      current.whenTrue,
      current.whenFalse,
      current.target,
      current.callee,
      current.object,
      current.index,
      current.fill ?? undefined,
    ]) {
      if (child !== undefined) pending.push(child);
    }
    for (const argument of current.arguments ?? []) pending.push(argument);
    for (const field of current.fields ?? []) pending.push(field.value);
    for (const element of current.elements ?? []) pending.push(element);
  }
  return false;
}

/** Substitute a callee aggregate parameter with its caller argument place. */
function substitutePlace(
  place: EffectPlace,
  call: EffectCall,
  parameters: readonly SemanticBinding[],
): EffectPlace {
  const index = parameters.findIndex(
    (parameter) => bindingIdentityKey(parameter.id) === bindingIdentityKey(place.binding),
  );
  const argument = index < 0 ? undefined : call.arguments[index];
  if (argument?.place === null || argument?.place === undefined) return place;
  const parameterKeys = new Set(parameters.map(({ id }) => bindingIdentityKey(id)));
  const stablePath = place.path.every(
    (part) => typeof part === "string" || !expressionUsesBindings(part, parameterKeys),
  );
  return effectPlace({
    binding: argument.place.binding,
    path: stablePath ? [...argument.place.path, ...place.path] : argument.place.path,
    readonly: argument.place.readonly,
  });
}

function orderedPlaces(places: ReadonlyMap<string, EffectPlace>): readonly EffectPlace[] {
  return Object.freeze(
    [...places.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([, place]) => place),
  );
}

/** Find parameter bindings contained by one function declaration span. */
function functionParameters(
  functionBinding: SemanticBinding,
  bindings: readonly SemanticBinding[],
): readonly SemanticBinding[] {
  return Object.freeze(
    bindings
      .filter(
        (binding) =>
          binding.storage === "parameter" &&
          binding.id.sourceId === functionBinding.id.sourceId &&
          binding.declaration.start >= functionBinding.declaration.start &&
          binding.declaration.end <= functionBinding.declaration.end,
      )
      .sort((left, right) => left.declaration.start - right.declaration.start),
  );
}

/** Internal effect summary paired with source provenance for each transitive read. */
interface ExpandedEffect {
  readonly summary: EffectSummary;
  readonly readOrigins: ReadonlyMap<string, readonly SourceSpan[]>;
}

/** Expand direct function facts through the finite direct-call graph. */
function transitiveSummary(
  key: string,
  direct: ReadonlyMap<string, EffectFacts>,
  parameters: ReadonlyMap<string, readonly SemanticBinding[]>,
  functions: ReadonlyMap<string, SemanticBinding>,
  memo: Map<string, ExpandedEffect>,
  active: ReadonlySet<string>,
): ExpandedEffect {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const functionBinding = functions.get(key)!;
  const facts = direct.get(key) ?? emptyFacts();
  const reads = new Map(facts.reads);
  const readOrigins = new Map<string, SourceSpan[]>(facts.readOrigins);
  const writes = new Map(facts.writes);
  const operationEffects = new Set(facts.operationEffects);
  let opaque = facts.opaque;
  const nextActive = new Set(active);
  nextActive.add(key);
  for (const call of facts.calls) {
    const calleeKey = bindingIdentityKey(call.callee);
    if (!functions.has(calleeKey) || nextActive.has(calleeKey)) continue;
    const callee = transitiveSummary(calleeKey, direct, parameters, functions, memo, nextActive);
    const calleeParameters = parameters.get(calleeKey) ?? [];
    for (const place of callee.summary.reads) {
      const substituted = substitutePlace(place, call, calleeParameters);
      const origins = [call.span, ...(callee.readOrigins.get(effectPlaceKey(place)) ?? [])];
      const substitutedKey = effectPlaceKey(substituted);
      addPlace(reads, substituted);
      const existing = readOrigins.get(substitutedKey) ?? [];
      existing.push(...origins);
      readOrigins.set(substitutedKey, existing);
    }
    for (const place of callee.summary.writes) {
      addPlace(writes, substitutePlace(place, call, calleeParameters));
    }
    for (const effect of callee.summary.operationEffects) operationEffects.add(effect);
    opaque ||= callee.summary.opaque;
  }
  const summary = Object.freeze({
    function: functionBinding.id,
    reads: orderedPlaces(reads),
    writes: orderedPlaces(writes),
    operationEffects: Object.freeze(
      [...operationEffects].sort((left, right) => compareText(left, right)),
    ),
    opaque,
  });
  const expanded = Object.freeze({ summary, readOrigins });
  memo.set(key, expanded);
  return expanded;
}

/** Merge transitive callee effects into one initializer scan. */
function expandInitializerCalls(
  facts: EffectFacts,
  summaries: ReadonlyMap<string, ExpandedEffect>,
  parameters: ReadonlyMap<string, readonly SemanticBinding[]>,
): void {
  for (const call of facts.calls) {
    const key = bindingIdentityKey(call.callee);
    const summary = summaries.get(key);
    if (summary === undefined) continue;
    const calleeParameters = parameters.get(key) ?? [];
    for (const place of summary.summary.reads) {
      const substituted = substitutePlace(place, call, calleeParameters);
      addRead(facts, substituted, [
        call.span,
        ...(summary.readOrigins.get(effectPlaceKey(place)) ?? []),
      ]);
    }
    for (const place of summary.summary.writes) {
      addPlace(facts.writes, substitutePlace(place, call, calleeParameters));
    }
    for (const effect of summary.summary.operationEffects) facts.operationEffects.add(effect);
    facts.opaque ||= summary.summary.opaque;
  }
}

/** Build one deterministic initializer-cycle diagnostic with the complete dependency path. */
function initializerCycleDiagnostic(
  cycle: readonly TypedDeclaration[],
  bindings: ReadonlyMap<string, SemanticBinding>,
  dependencies: ReadonlyMap<string, ReadonlyMap<string, readonly SourceSpan[]>>,
): ProjectDiagnostic {
  const names = cycle.map(
    (declaration) =>
      bindings.get(bindingIdentityKey(declaration.binding))?.qualifiedName ?? "<unknown>",
  );
  const first = cycle[0]!;
  return projectDiagnostic(
    "E10194",
    `Circular module initializer dependency: ${[...names, names[0]].join(" → ")}`,
    first.initializer?.span ?? first.binding.span,
    null,
    cycle.flatMap((declaration, index) => {
      const dependency = cycle[(index + 1) % cycle.length]!;
      const origins =
        dependencies
          .get(bindingIdentityKey(declaration.binding))
          ?.get(bindingIdentityKey(dependency.binding)) ?? [];
      return [
        Object.freeze({
          span: declaration.initializer?.span ?? declaration.binding.span,
          message: `${names[index]} initializer participates in this dependency cycle`,
        }),
        ...origins.map((span) =>
          Object.freeze({ span, message: "Read or call proving this initializer dependency" }),
        ),
      ];
    }),
  );
}

/**
 * Derive finite function effects and a deterministic runtime initializer schedule.
 * @example analyzeEffects(moduleAnalysis).initializerOrder
 */
export function analyzeEffects(analysis: ModuleAnalysisResult): EffectAnalysisResult {
  const bindingByKey = new Map(
    analysis.bindings.map((binding) => [bindingIdentityKey(binding.id), binding]),
  );
  const functionBindings = analysis.bindings.filter((binding) => binding.storage === "function");
  const functions = new Map(
    functionBindings.map((binding) => [bindingIdentityKey(binding.id), binding]),
  );
  const declarations = new Map(
    analysis.declarations
      .filter((declaration): declaration is TypedDeclaration => declaration.kind === "typed")
      .map((declaration) => [bindingIdentityKey(declaration.binding), declaration]),
  );
  const parameters = new Map(
    functionBindings.map((binding) => [
      bindingIdentityKey(binding.id),
      functionParameters(binding, analysis.bindings),
    ]),
  );
  const direct = new Map<string, EffectFacts>();
  for (const binding of functionBindings) {
    const facts = emptyFacts();
    const body = declarations.get(bindingIdentityKey(binding.id))?.body;
    if (body !== null && body !== undefined) scanBlock(body, facts, bindingByKey);
    direct.set(bindingIdentityKey(binding.id), facts);
  }

  const memo = new Map<string, ExpandedEffect>();
  const expandedEffects = Object.freeze(
    functionBindings.map((binding) =>
      transitiveSummary(
        bindingIdentityKey(binding.id),
        direct,
        parameters,
        functions,
        memo,
        new Set(),
      ),
    ),
  );
  const summaries = new Map(
    expandedEffects.map((summary) => [bindingIdentityKey(summary.summary.function), summary]),
  );
  const effects = Object.freeze(expandedEffects.map(({ summary }) => summary));
  const initializers = [...declarations.values()]
    .filter((declaration) => {
      const binding = bindingByKey.get(bindingIdentityKey(declaration.binding));
      return binding?.storage === "module" && declaration.initializer !== null;
    })
    .sort((left, right) => {
      const leftName = bindingByKey.get(bindingIdentityKey(left.binding))?.qualifiedName ?? "";
      const rightName = bindingByKey.get(bindingIdentityKey(right.binding))?.qualifiedName ?? "";
      return compareText(leftName, rightName);
    });
  const initializerByKey = new Map(
    initializers.map((declaration) => [bindingIdentityKey(declaration.binding), declaration]),
  );
  const dependencies = new Map<string, Map<string, readonly SourceSpan[]>>();
  for (const declaration of initializers) {
    const key = bindingIdentityKey(declaration.binding);
    const facts = emptyFacts();
    scanExpression(declaration.initializer!, facts, bindingByKey);
    expandInitializerCalls(facts, summaries, parameters);
    const initializerDependencies = new Map<string, readonly SourceSpan[]>();
    for (const [placeKey, place] of facts.reads) {
      const dependency = bindingIdentityKey(place.binding);
      if (!initializerByKey.has(dependency)) continue;
      initializerDependencies.set(dependency, Object.freeze(facts.readOrigins.get(placeKey) ?? []));
    }
    dependencies.set(key, initializerDependencies);
  }

  const ordered: BindingId[] = [];
  const remaining = new Set(initializerByKey.keys());
  while (remaining.size > 0) {
    const ready = [...remaining].filter((key) =>
      [...(dependencies.get(key)?.keys() ?? [])].every((dependency) => !remaining.has(dependency)),
    );
    ready.sort((left, right) => {
      const leftName = bindingByKey.get(left)?.qualifiedName ?? "";
      const rightName = bindingByKey.get(right)?.qualifiedName ?? "";
      return compareText(leftName, rightName);
    });
    if (ready.length === 0) break;
    for (const key of ready) {
      remaining.delete(key);
      ordered.push(initializerByKey.get(key)!.binding);
    }
  }

  const diagnostics: ProjectDiagnostic[] = [];
  if (remaining.size > 0) {
    const start = [...remaining].sort((left, right) => compareText(left, right))[0]!;
    const path: string[] = [];
    const seen = new Map<string, number>();
    let current = start;
    while (!seen.has(current)) {
      seen.set(current, path.length);
      path.push(current);
      const next = [...(dependencies.get(current)?.keys() ?? [])]
        .filter((dependency) => remaining.has(dependency))
        .sort((left, right) => compareText(left, right))[0];
      if (next === undefined) break;
      current = next;
    }
    const cycleStart = seen.get(current) ?? 0;
    const cycle = path.slice(cycleStart).map((key) => initializerByKey.get(key)!);
    diagnostics.push(initializerCycleDiagnostic(cycle, bindingByKey, dependencies));
  }
  return Object.freeze({
    effects,
    initializerOrder: Object.freeze(ordered),
    diagnostics: Object.freeze(diagnostics),
  });
}
