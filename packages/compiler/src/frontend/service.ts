import type { ProjectDiagnostic, ProjectSnapshot, SourceSpan } from "../project/types.js";
import { PROFILES } from "../project/manifest.js";
import { resolveRawAsset } from "../assets/raw-asset.js";
import type { EmbeddedValue, SemanticAsset } from "../assets/asset-types.js";
import { analyzeModules } from "./analyzer.js";
import { sortAnalysisDiagnostics } from "./diagnostics.js";
import { analyzeEffects } from "./effects.js";
import { indexModules, resolveModules } from "./modules.js";
import { selectFrontendProfile } from "./profile.js";
import type { FrontendProfile } from "./profile.js";
import { discoverEmbeddedRequests, discoverPendingObligations } from "./source-discovery.js";
import { ANALYSIS_OBLIGATION_KIND, freezeSourceSpan } from "./semantic-types.js";
import type {
  AnalysisObligation,
  CallEdge,
  EffectSummary,
  ModuleAnalysisResult,
  ModuleGraph,
  SemanticBinding,
  SemanticType,
  TypedDeclaration,
} from "./semantic-types.js";
import type { Expr, Statement, TypeSyntax, VariableDeclaration } from "./syntax.js";
import { applySourceOverlays } from "./overlay.js";
import type { SourceOverlay } from "./overlay.js";

/** Maximum number of proving errors returned by one whole-project analysis. */
const MAX_ANALYSIS_ERRORS = 20;

/** Maximum typed-expression nesting admitted before analysis must remain incomplete. */
const MAX_ANALYSIS_EXPRESSION_DEPTH = 256;

/** Stable whole-analysis result discriminators. */
export const ANALYSIS_RESULT_KIND = Object.freeze({
  /** Every admitted frontend obligation completed successfully. */
  complete: "complete",
  /** Source is proved invalid and no check remains pending. */
  error: "error",
  /** At least one required check remains pending. */
  incomplete: "incomplete",
} as const);

/** Checked symbolic frontend payload admitted for later compiler stages. */
export interface TypedProgram {
  /** Selected target-neutral source declaration environment, when bound. */
  readonly profile: FrontendProfile | null;
  /** Validated immutable assets referenced by the checked source graph. */
  readonly assets: readonly SemanticAsset[];
  /** Reachable merged source modules. */
  readonly modules: ModuleAnalysisResult["modules"];
  /** Resolved module, function, parameter, and local bindings. */
  readonly bindings: readonly SemanticBinding[];
  /** Scalar and fixed aggregate types used by checked declarations. */
  readonly types: readonly SemanticType[];
  /** Checked declarations only; poison and unchecked records never enter this payload. */
  readonly declarations: readonly TypedDeclaration[];
  /** Direct ordinary-function calls. */
  readonly calls: readonly CallEdge[];
  /** Finite transitive function effects. */
  readonly effects: readonly EffectSummary[];
  /** Runtime module initializers in proved execution order. */
  readonly initializerOrder: readonly TypedDeclaration["binding"][];
}

/** Truthful result of analyzing one immutable project snapshot. */
export type AnalysisResult =
  | {
      readonly kind: typeof ANALYSIS_RESULT_KIND.complete;
      readonly diagnostics: readonly ProjectDiagnostic[];
      readonly program: TypedProgram;
    }
  | {
      readonly kind: typeof ANALYSIS_RESULT_KIND.error;
      readonly diagnostics: readonly ProjectDiagnostic[];
    }
  | {
      readonly kind: typeof ANALYSIS_RESULT_KIND.incomplete;
      readonly diagnostics: readonly ProjectDiagnostic[];
      readonly obligations: readonly AnalysisObligation[];
    };

/** Read exact UTF-8 source bytes covered by one source span. */
function sourceText(snapshot: ProjectSnapshot, span: SourceSpan): string {
  const source = snapshot.sources.find((candidate) => candidate.sourceId === span.sourceId);
  if (source === undefined) return "";
  return Buffer.from(source.text, "utf8").subarray(span.start, span.end).toString("utf8");
}

/** Return expression children without recursively visiting a hostile tree. */
function expressionChildren(expression: Expr): readonly Expr[] {
  switch (expression.kind) {
    case "unary":
    case "cast":
    case "length":
      return [expression.operand];
    case "binary":
      return [expression.left, expression.right];
    case "conditional":
      return [expression.condition, expression.whenTrue, expression.whenFalse];
    case "assignment":
      return [expression.target, expression.value];
    case "call":
      return [expression.callee, ...expression.arguments];
    case "index":
      return [expression.object, expression.index];
    case "member":
      return [expression.object];
    case "array-literal":
      return expression.fill === null
        ? expression.elements
        : [...expression.elements, expression.fill];
    case "struct-literal":
      return expression.fields.map(({ value }) => value);
    default:
      return [];
  }
}

/** Return the first expression span which exceeds the bounded analysis depth. */
function excessiveExpressionDepth(expression: Expr): SourceSpan | null {
  const pending: { readonly expression: Expr; readonly depth: number }[] = [
    { expression, depth: 1 },
  ];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.depth > MAX_ANALYSIS_EXPRESSION_DEPTH) return current.expression.span;
    for (const child of expressionChildren(current.expression)) {
      pending.push({ expression: child, depth: current.depth + 1 });
    }
  }
  return null;
}

/** Inspect nested array extents without resolving their types. */
function excessiveTypeDepth(type: TypeSyntax | null): SourceSpan | null {
  let current = type;
  while (current !== null && current.kind === "array-type") {
    if (current.extent !== null) {
      const excessive = excessiveExpressionDepth(current.extent);
      if (excessive !== null) return excessive;
    }
    current = current.element;
  }
  return null;
}

/** Find a syntax expression too deep for the recursive semantic checker. */
function excessiveGraphExpressionDepth(graph: ModuleGraph): SourceSpan | null {
  const statements: Statement[] = [];
  const checkExpression = (expression: Expr | null): SourceSpan | null =>
    expression === null ? null : excessiveExpressionDepth(expression);
  for (const module of graph.modules) {
    for (const unit of module.units) {
      for (const declaration of unit.declarations) {
        if (declaration.kind === "variable") {
          const excessive =
            excessiveTypeDepth(declaration.type) ?? checkExpression(declaration.initializer);
          if (excessive !== null) return excessive;
        } else if (declaration.kind === "function") {
          for (const parameter of declaration.parameters) {
            const excessive = excessiveTypeDepth(parameter.type);
            if (excessive !== null) return excessive;
          }
          const excessive = excessiveTypeDepth(declaration.returnType);
          if (excessive !== null) return excessive;
          statements.push(...declaration.body.statements);
        } else if (declaration.kind === "struct") {
          for (const field of declaration.fields) {
            const excessive = excessiveTypeDepth(field.type);
            if (excessive !== null) return excessive;
          }
        }
      }
    }
  }
  while (statements.length > 0) {
    const statement = statements.pop()!;
    if (statement.kind === "variable") {
      const excessive =
        excessiveTypeDepth(statement.type) ?? checkExpression(statement.initializer);
      if (excessive !== null) return excessive;
    } else if (statement.kind === "expression-statement") {
      const excessive = excessiveExpressionDepth(statement.expression);
      if (excessive !== null) return excessive;
    } else if (statement.kind === "block") {
      statements.push(...statement.statements);
    } else if (statement.kind === "if") {
      const excessive = excessiveExpressionDepth(statement.condition);
      if (excessive !== null) return excessive;
      statements.push(...statement.then.statements);
      if (statement.otherwise !== null) statements.push(statement.otherwise);
    } else if (statement.kind === "while") {
      const excessive = excessiveExpressionDepth(statement.condition);
      if (excessive !== null) return excessive;
      statements.push(...statement.body.statements);
    } else if (statement.kind === "for") {
      if (statement.initializer !== null) {
        if (isExpressionList(statement.initializer)) {
          for (const expression of statement.initializer) {
            const excessive = excessiveExpressionDepth(expression);
            if (excessive !== null) return excessive;
          }
        } else {
          statements.push(statement.initializer);
        }
      }
      if (statement.condition !== null) {
        const excessive = excessiveExpressionDepth(statement.condition);
        if (excessive !== null) return excessive;
      }
      for (const expression of statement.update ?? []) {
        const excessive = excessiveExpressionDepth(expression);
        if (excessive !== null) return excessive;
      }
      statements.push(...statement.body.statements);
    } else if (statement.kind === "return" && statement.value !== null) {
      const excessive = excessiveExpressionDepth(statement.value);
      if (excessive !== null) return excessive;
    }
  }
  return null;
}

/** Narrow a source for initializer without relying on mutable-array inference. */
function isExpressionList(
  initializer: VariableDeclaration | readonly Expr[],
): initializer is readonly Expr[] {
  return Array.isArray(initializer);
}

/** Find the complete declaration containing a narrower obligation span. */
function containingDeclaration(
  analysis: ModuleAnalysisResult,
  span: SourceSpan,
): SourceSpan | null {
  for (const module of analysis.modules) {
    for (const unit of module.units) {
      for (const declaration of unit.declarations) {
        if (
          declaration.span.sourceId === span.sourceId &&
          declaration.span.start <= span.start &&
          declaration.span.end >= span.end
        ) {
          return declaration.span;
        }
      }
    }
  }
  return null;
}

/** Normalize stage-local pending facts into the service's fixed obligation categories. */
function normalizeObligations(
  analysis: ModuleAnalysisResult,
  diagnostics: readonly ProjectDiagnostic[],
  input: readonly AnalysisObligation[],
  discovered: readonly AnalysisObligation[],
): readonly AnalysisObligation[] {
  const pendingRegions = discovered
    .map(({ span }) => span)
    .filter((span): span is SourceSpan => span !== null);
  const normalized = [...input, ...discovered]
    .filter((obligation) => {
      const obligationSpan = obligation.span;
      if (obligationSpan === null || obligation.kind !== ANALYSIS_OBLIGATION_KIND.implementation) {
        return true;
      }
      return !pendingRegions.some(
        (span) =>
          span.sourceId === obligationSpan.sourceId &&
          span.start <= obligationSpan.start &&
          span.end >= obligationSpan.end,
      );
    })
    .map((obligation): AnalysisObligation => {
      if (
        obligation.kind === ANALYSIS_OBLIGATION_KIND.dependency &&
        /Required module 'c64\./u.test(obligation.message)
      ) {
        return Object.freeze({ ...obligation, kind: ANALYSIS_OBLIGATION_KIND.profile });
      }
      if (
        obligation.kind === ANALYSIS_OBLIGATION_KIND.analysisLimit &&
        obligation.span !== null &&
        diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "PARSE_SYNTAX_ERROR" &&
            diagnostic.primarySpan?.sourceId === obligation.span?.sourceId,
        )
      ) {
        return Object.freeze({
          ...obligation,
          kind: ANALYSIS_OBLIGATION_KIND.syntax,
          message: "Syntax recovery could not prove the remaining source",
        });
      }
      if (
        obligation.kind === ANALYSIS_OBLIGATION_KIND.implementation &&
        obligation.span !== null &&
        obligation.message.includes("Aggregate return ABI")
      ) {
        const declaration = containingDeclaration(analysis, obligation.span);
        return declaration === null
          ? obligation
          : Object.freeze({ ...obligation, span: freezeSourceSpan(declaration) });
      }
      return obligation;
    });
  const unique = new Map<string, AnalysisObligation>();
  for (const obligation of normalized) {
    const span = obligation.span;
    const key = `${obligation.kind}:${span?.sourceId ?? ""}:${span?.start ?? -1}:${span?.end ?? -1}:${obligation.message}`;
    unique.set(key, obligation);
  }
  return Object.freeze([...unique.values()]);
}

/** Return whether the selected declaration environment owns a missing profile module. */
function profileSatisfiesObligation(
  profile: FrontendProfile | null,
  obligation: AnalysisObligation,
): boolean {
  if (profile === null || obligation.kind !== ANALYSIS_OBLIGATION_KIND.dependency) return false;
  const match = /^Required module '([^']+)' is unavailable$/u.exec(obligation.message);
  const moduleName = match?.[1];
  return (
    moduleName !== undefined &&
    profile.capabilities.some(({ name }) => name.startsWith(moduleName + "."))
  );
}

/** Return whether an inner proving span is contained by an outer source region. */
function spanContains(outer: SourceSpan, inner: SourceSpan): boolean {
  return outer.sourceId === inner.sourceId && outer.start <= inner.start && outer.end >= inner.end;
}

/** Return whether a diagnostic is caused solely by a pending source obligation. */
function isDeferredObligationDiagnostic(
  diagnostic: ProjectDiagnostic,
  obligations: readonly AnalysisObligation[],
  kinds: ReadonlySet<AnalysisObligation["kind"]>,
): boolean {
  return (
    (diagnostic.code === "E10239" || diagnostic.code === "E10241") &&
    diagnostic.primarySpan !== null &&
    obligations.some(
      (obligation) =>
        kinds.has(obligation.kind) &&
        obligation.span !== null &&
        spanContains(obligation.span, diagnostic.primarySpan!),
    )
  );
}

/** Find import aliases whose target declaration could not be resolved. */
function unresolvedImportNames(graph: ModuleGraph): ReadonlySet<string> {
  const resolved = new Set(
    graph.imports.map((item) => `${item.sourceSpan.sourceId}\0${item.alias}`),
  );
  const unresolved = new Set<string>();
  for (const module of graph.modules) {
    for (const unit of module.units) {
      for (const imported of unit.imports) {
        for (const item of imported.items) {
          const alias = item.alias ?? item.name;
          const key = `${item.span.sourceId}\0${alias}`;
          if (!resolved.has(key)) unresolved.add(key);
        }
      }
    }
  }
  return unresolved;
}

/** Suppress a dependent name error when its unresolved import already carries the root fact. */
function isDeferredImportDiagnostic(
  diagnostic: ProjectDiagnostic,
  snapshot: ProjectSnapshot,
  unresolved: ReadonlySet<string>,
): boolean {
  if (diagnostic.code !== "E10239" || diagnostic.primarySpan === null) return false;
  const name = sourceText(snapshot, diagnostic.primarySpan).replace(/;$/u, "").trim();
  return unresolved.has(`${diagnostic.primarySpan.sourceId}\0${name}`);
}

/** Keep final undeclared-name diagnostics on the proving identifier bytes. */
function normalizeDiagnostic(
  diagnostic: ProjectDiagnostic,
  snapshot: ProjectSnapshot,
): ProjectDiagnostic {
  if (
    diagnostic.code !== "E10239" ||
    diagnostic.primarySpan === null ||
    !sourceText(snapshot, diagnostic.primarySpan).endsWith(";")
  ) {
    return diagnostic;
  }
  return Object.freeze({
    ...diagnostic,
    primarySpan: Object.freeze({ ...diagnostic.primarySpan, end: diagnostic.primarySpan.end - 1 }),
  });
}

/**
 * Run the existing frontend stages over one immutable project snapshot.
 * @example analyzeProject(snapshot).kind
 */
function analyzeResolvedProject(
  snapshot: ProjectSnapshot,
  embeddedValues: ReadonlyMap<string, EmbeddedValue>,
  assets: readonly SemanticAsset[],
): AnalysisResult {
  const selected = PROFILES.some((profile) => profile === snapshot.effectiveTarget)
    ? selectFrontendProfile(snapshot.effectiveTarget)
    : null;
  if (selected?.kind === "error") {
    return Object.freeze({ kind: ANALYSIS_RESULT_KIND.error, diagnostics: selected.diagnostics });
  }
  const profile = selected?.kind === "complete" ? selected.profile : null;
  const indexed = indexModules(snapshot);
  const resolved = resolveModules(snapshot, indexed.index);
  const earlyDiagnostics = sortAnalysisDiagnostics([
    ...indexed.diagnostics,
    ...resolved.diagnostics,
  ]);
  if (resolved.graph === null) {
    const obligations = Object.freeze([...indexed.obligations, ...resolved.obligations]);
    return obligations.length > 0
      ? Object.freeze({
          kind: ANALYSIS_RESULT_KIND.incomplete,
          diagnostics: earlyDiagnostics,
          obligations,
        })
      : Object.freeze({ kind: ANALYSIS_RESULT_KIND.error, diagnostics: earlyDiagnostics });
  }

  const excessiveExpression = excessiveGraphExpressionDepth(resolved.graph);
  if (excessiveExpression !== null) {
    const obligations = Object.freeze([
      ...indexed.obligations,
      ...resolved.obligations,
      Object.freeze({
        kind: ANALYSIS_OBLIGATION_KIND.analysisLimit,
        span: freezeSourceSpan(excessiveExpression),
        message: `Semantic expression depth exceeds ${MAX_ANALYSIS_EXPRESSION_DEPTH}`,
      }),
    ]);
    return Object.freeze({
      kind: ANALYSIS_RESULT_KIND.incomplete,
      diagnostics: earlyDiagnostics,
      obligations,
    });
  }

  const analysis = analyzeModules(snapshot, resolved.graph, profile, embeddedValues);
  const effects = analyzeEffects(analysis);
  const unresolvedImports = unresolvedImportNames(resolved.graph);
  const discoveredObligations = discoverPendingObligations(
    snapshot,
    analysis,
    new Set(embeddedValues.keys()),
  );
  const dependencyObligations = Object.freeze([...indexed.obligations, ...resolved.obligations]);
  let diagnostics: readonly ProjectDiagnostic[] = sortAnalysisDiagnostics(
    [...earlyDiagnostics, ...analysis.diagnostics, ...effects.diagnostics]
      .filter(
        (diagnostic) =>
          !isDeferredObligationDiagnostic(
            diagnostic,
            discoveredObligations,
            new Set([ANALYSIS_OBLIGATION_KIND.asset]),
          ) &&
          !isDeferredObligationDiagnostic(
            diagnostic,
            dependencyObligations,
            new Set([ANALYSIS_OBLIGATION_KIND.dependency]),
          ) &&
          !isDeferredImportDiagnostic(diagnostic, snapshot, unresolvedImports),
      )
      .map((diagnostic) => normalizeDiagnostic(diagnostic, snapshot)),
  );
  const rawObligations = [
    ...indexed.obligations,
    ...resolved.obligations,
    ...analysis.obligations,
  ].filter((obligation) => !profileSatisfiesObligation(profile, obligation));
  for (const diagnostic of diagnostics) {
    if (
      diagnostic.code === "PARSE_SYNTAX_ERROR" &&
      diagnostic.message.includes("found end of file")
    ) {
      rawObligations.push(
        Object.freeze({
          kind: ANALYSIS_OBLIGATION_KIND.syntax,
          span: diagnostic.primarySpan,
          message: "Syntax recovery could not prove the remaining source",
        }),
      );
    }
  }
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > MAX_ANALYSIS_ERRORS) {
    rawObligations.push(
      Object.freeze({
        kind: ANALYSIS_OBLIGATION_KIND.analysisLimit,
        span: errors[MAX_ANALYSIS_ERRORS - 1]?.primarySpan ?? null,
        message: `Analysis stopped after ${MAX_ANALYSIS_ERRORS} errors`,
      }),
    );
    let retainedErrors = 0;
    diagnostics = Object.freeze(
      diagnostics.filter(({ severity }) => severity === "warning" || retainedErrors++ < 20),
    );
  }
  const obligations = normalizeObligations(
    analysis,
    diagnostics,
    rawObligations,
    discoveredObligations,
  );
  if (obligations.length > 0) {
    return Object.freeze({
      kind: ANALYSIS_RESULT_KIND.incomplete,
      diagnostics: Object.freeze(diagnostics),
      obligations,
    });
  }
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return Object.freeze({
      kind: ANALYSIS_RESULT_KIND.error,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  const declarations = Object.freeze(
    analysis.declarations.filter(
      (declaration): declaration is TypedDeclaration => declaration.kind === "typed",
    ),
  );
  const program: TypedProgram = Object.freeze({
    profile,
    assets: Object.freeze([...assets]),
    modules: analysis.modules,
    bindings: analysis.bindings,
    types: analysis.types,
    declarations,
    calls: analysis.calls,
    effects: effects.effects,
    initializerOrder: effects.initializerOrder,
  });
  return Object.freeze({
    kind: ANALYSIS_RESULT_KIND.complete,
    diagnostics: Object.freeze(diagnostics),
    program,
  });
}

/**
 * Analyze source and profile declarations without performing host asset I/O.
 * Asset expressions remain explicit obligations for an owning async compiler service.
 */
export function analyzeProject(snapshot: ProjectSnapshot): AnalysisResult {
  return analyzeResolvedProject(snapshot, new Map(), Object.freeze([]));
}

/**
 * Analyze one immutable snapshot with bounded in-memory replacements for known sources.
 * Assets follow the same checked path as project analysis. Host source files and the
 * snapshot's content identity are never changed.
 * @example await analyzeProjectOverlay(snapshot, [{ sourceId, text }])
 */
export async function analyzeProjectOverlay(
  snapshot: ProjectSnapshot,
  overlays: readonly SourceOverlay[],
): Promise<AnalysisResult> {
  const effective = applySourceOverlays(snapshot, overlays);
  if (effective.kind === "failure") {
    return Object.freeze({
      kind: ANALYSIS_RESULT_KIND.error,
      diagnostics: effective.diagnostics,
    });
  }
  return analyzeProjectWithAssets(effective.snapshot);
}

/**
 * Resolve literal raw assets and complete the same frontend analysis in one bounded async call.
 * This is the compiler-owned bridge; the target-neutral analyzer receives only typed immutable values.
 */
export async function analyzeProjectWithAssets(snapshot: ProjectSnapshot): Promise<AnalysisResult> {
  const indexed = indexModules(snapshot);
  const resolved = resolveModules(snapshot, indexed.index);
  if (resolved.graph === null) return analyzeProject(snapshot);
  const discovered = discoverEmbeddedRequests(resolved.graph);
  if (discovered.kind === "error") {
    return Object.freeze({ kind: ANALYSIS_RESULT_KIND.error, diagnostics: discovered.diagnostics });
  }
  const values = new Map<string, EmbeddedValue>();
  const assets = new Map<string, SemanticAsset>();
  for (const request of discovered.requests) {
    const result = await resolveRawAsset(snapshot, request.literalPath);
    if (result.kind === "error") {
      return Object.freeze({ kind: ANALYSIS_RESULT_KIND.error, diagnostics: result.diagnostics });
    }
    values.set(request.key, result.value);
    assets.set(result.asset.id, result.asset);
  }
  return analyzeResolvedProject(snapshot, values, Object.freeze([...assets.values()]));
}
