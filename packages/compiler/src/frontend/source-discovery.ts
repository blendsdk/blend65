import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, ProjectSnapshot, SourceSpan } from "../project/types.js";
import { sortAnalysisDiagnostics } from "./diagnostics.js";
import { ANALYSIS_OBLIGATION_KIND, freezeSourceSpan } from "./semantic-types.js";
import type { AnalysisObligation, ModuleAnalysisResult, ModuleGraph } from "./semantic-types.js";
import type { Expr, Statement, VariableDeclaration } from "./syntax.js";

/** One literal asset request located by its complete call-expression span. */
export interface EmbeddedRequest {
  /** Stable expression key shared with typed analysis. */
  readonly key: string;
  /** Decoded literal path supplied by source. */
  readonly literalPath: string;
}

/** Result of validating every raw embed call in a source graph. */
export type EmbeddedRequestResult =
  | { readonly kind: "complete"; readonly requests: readonly EmbeddedRequest[] }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

interface ExpressionWork {
  readonly kind: "expression";
  readonly value: Expr;
}

interface StatementWork {
  readonly kind: "statement";
  readonly value: Statement;
}

type SourceWork = ExpressionWork | StatementWork;

/** Read exact UTF-8 source bytes covered by one source span. */
function sourceText(snapshot: ProjectSnapshot, span: SourceSpan): string {
  const source = snapshot.sources.find((candidate) => candidate.sourceId === span.sourceId);
  if (source === undefined) return "";
  return Buffer.from(source.text, "utf8").subarray(span.start, span.end).toString("utf8");
}

/** Return expression children in source evaluation order. */
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

/** Narrow a source for initializer without relying on mutable-array inference. */
function isExpressionList(
  initializer: VariableDeclaration | readonly Expr[],
): initializer is readonly Expr[] {
  return Array.isArray(initializer);
}

/** Add statement children to a LIFO stack in reverse source-evaluation order. */
function pushStatementChildren(pending: SourceWork[], statement: Statement): void {
  if (statement.kind === "variable") {
    if (statement.initializer !== null) {
      pending.push({ kind: "expression", value: statement.initializer });
    }
  } else if (statement.kind === "expression-statement") {
    pending.push({ kind: "expression", value: statement.expression });
  } else if (statement.kind === "block") {
    for (let index = statement.statements.length - 1; index >= 0; index--) {
      pending.push({ kind: "statement", value: statement.statements[index]! });
    }
  } else if (statement.kind === "if") {
    if (statement.otherwise !== null) {
      pending.push({ kind: "statement", value: statement.otherwise });
    }
    pending.push({ kind: "statement", value: statement.then });
    pending.push({ kind: "expression", value: statement.condition });
  } else if (statement.kind === "while") {
    pending.push({ kind: "statement", value: statement.body });
    pending.push({ kind: "expression", value: statement.condition });
  } else if (statement.kind === "for") {
    pending.push({ kind: "statement", value: statement.body });
    for (let index = (statement.update?.length ?? 0) - 1; index >= 0; index--) {
      pending.push({ kind: "expression", value: statement.update![index]! });
    }
    if (statement.condition !== null) {
      pending.push({ kind: "expression", value: statement.condition });
    }
    if (statement.initializer !== null) {
      if (isExpressionList(statement.initializer)) {
        for (let index = statement.initializer.length - 1; index >= 0; index--) {
          pending.push({ kind: "expression", value: statement.initializer[index]! });
        }
      } else {
        pending.push({ kind: "statement", value: statement.initializer });
      }
    }
  } else if (statement.kind === "return" && statement.value !== null) {
    pending.push({ kind: "expression", value: statement.value });
  }
}

/**
 * Walk every source expression without using the JavaScript call stack.
 * Returning false from the visitor skips the current expression's children.
 */
function visitGraphExpressions(
  modules: ModuleGraph["modules"],
  visit: (expression: Expr) => boolean,
): void {
  const pending: SourceWork[] = [];
  const declarations = modules.flatMap((module) =>
    module.units.flatMap((unit) => unit.declarations),
  );
  for (let index = declarations.length - 1; index >= 0; index--) {
    const declaration = declarations[index]!;
    if (declaration.kind === "variable" && declaration.initializer !== null) {
      pending.push({ kind: "expression", value: declaration.initializer });
    } else if (declaration.kind === "function") {
      pending.push({ kind: "statement", value: declaration.body });
    }
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.kind === "statement") {
      pushStatementChildren(pending, current.value);
      continue;
    }
    if (!visit(current.value)) continue;
    const children = expressionChildren(current.value);
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push({ kind: "expression", value: children[index]! });
    }
  }
}

/** Decode the already validated literal items used by one raw asset path. */
function embeddedLiteralPath(expression: Expr): string | null {
  if (expression.kind !== "literal") return null;
  let value = "";
  for (const item of expression.items) {
    if (item.kind === "scalar") value += item.value;
    else if (item.kind === "byte") value += String.fromCharCode(item.value);
    else {
      const decoded: Readonly<Record<string, string>> = {
        "\\\\": "\\",
        '\\"': '"',
        "\\'": "'",
        "\\n": "\n",
        "\\r": "\r",
        "\\t": "\t",
        "\\0": "\0",
      };
      const character = decoded[item.value];
      if (character === undefined) return null;
      value += character;
    }
  }
  return value;
}

/** Discover source forms whose meaning depends on a later profile or asset stage. */
export function discoverPendingObligations(
  snapshot: ProjectSnapshot,
  analysis: ModuleAnalysisResult,
  embeddedValueKeys: ReadonlySet<string>,
): readonly AnalysisObligation[] {
  const obligations: AnalysisObligation[] = [];
  visitGraphExpressions(analysis.modules, (expression) => {
    if (
      expression.kind === "call" &&
      expression.callee.kind === "name" &&
      expression.callee.name === "embed"
    ) {
      const key = `${expression.span.sourceId}:${expression.span.start}:${expression.span.end}`;
      if (!embeddedValueKeys.has(key)) {
        obligations.push(
          Object.freeze({
            kind: ANALYSIS_OBLIGATION_KIND.asset,
            span: freezeSourceSpan(expression.span),
            message: "Embedded asset loading requires the selected asset pipeline",
          }),
        );
      }
      return false;
    }
    if (
      expression.kind === "literal" &&
      sourceText(snapshot, expression.span).trimStart().startsWith("'")
    ) {
      obligations.push(
        Object.freeze({
          kind: ANALYSIS_OBLIGATION_KIND.profile,
          span: freezeSourceSpan(expression.span),
          message: "Character encoding requires the selected target profile",
        }),
      );
    }
    return true;
  });
  return Object.freeze(obligations);
}

/** Find exact one-literal raw embed requests without reading any asset. */
export function discoverEmbeddedRequests(graph: ModuleGraph): EmbeddedRequestResult {
  const requests: EmbeddedRequest[] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  visitGraphExpressions(graph.modules, (expression) => {
    if (
      expression.kind !== "call" ||
      expression.callee.kind !== "name" ||
      expression.callee.name !== "embed"
    ) {
      return true;
    }
    const literalPath =
      expression.arguments.length === 1 ? embeddedLiteralPath(expression.arguments[0]!) : null;
    if (literalPath === null) {
      diagnostics.push(
        projectDiagnostic("E10136", "'embed()' path must be a string literal", expression.span),
      );
    } else {
      requests.push(
        Object.freeze({
          key: `${expression.span.sourceId}:${expression.span.start}:${expression.span.end}`,
          literalPath,
        }),
      );
    }
    return false;
  });
  return diagnostics.length > 0
    ? Object.freeze({ kind: "error", diagnostics: sortAnalysisDiagnostics(diagnostics) })
    : Object.freeze({ kind: "complete", requests: Object.freeze(requests) });
}
