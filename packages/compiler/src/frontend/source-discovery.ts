import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { sortAnalysisDiagnostics } from "./diagnostics.js";
import { ANALYSIS_OBLIGATION_KIND, freezeSourceSpan } from "./semantic-types.js";
import type { AnalysisObligation, ModuleAnalysisResult, ModuleGraph } from "./semantic-types.js";
import type { Declaration, Expr, Statement, VariableDeclaration } from "./syntax.js";

/** One literal asset request located by its complete call-expression span. */
export interface EmbeddedRequest {
  /** Stable expression key shared with typed analysis. */
  readonly key: string;
  /** Call location for a duplicate-input warning. */
  readonly span: SourceSpan;
  /** Decoded literal path supplied by source. */
  readonly literalPath: string;
  /** Source containing the call, used for source-relative lookup. */
  readonly sourceId: string;
  /** Optional literal selector for a registered native format. */
  readonly selector: string | null;
}

/** Result of validating every raw embed call in a source graph. */
export type EmbeddedRequestResult =
  | { readonly kind: "complete"; readonly requests: readonly EmbeddedRequest[] }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

interface ExpressionWork {
  readonly kind: "expression";
  readonly value: Expr;
  /** Initializer ownership follows all children, but never crosses into a function body. */
  readonly owner?: "resident" | "loadable" | "mutable" | "local" | undefined;
  /** Complete declaration span when an ownership error names the declaration. */
  readonly ownerSpan?: SourceSpan | undefined;
}

interface StatementWork {
  readonly kind: "statement";
  readonly value: Statement;
}

type SourceWork = ExpressionWork | StatementWork;

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
      pending.push({
        kind: "expression",
        value: statement.initializer,
        ownerSpan: statement.span,
        owner:
          statement.declarationKind === "let"
            ? "mutable"
            : statement.loadable
              ? "loadable"
              : "local",
      });
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
  } else if (statement.kind === "do-while") {
    pending.push({ kind: "expression", value: statement.condition });
    pending.push({ kind: "statement", value: statement.body });
  } else if (statement.kind === "switch") {
    for (const clause of [...statement.clauses].reverse()) {
      for (const child of [...clause.statements].reverse())
        pending.push({ kind: "statement", value: child });
      for (const value of [...(clause.values ?? [])].reverse())
        pending.push({ kind: "expression", value });
    }
    pending.push({ kind: "expression", value: statement.value });
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
  visit: (expression: Expr, owner: ExpressionWork["owner"], ownerSpan?: SourceSpan) => boolean,
): void {
  const pending: SourceWork[] = [];
  const declarations = modules.flatMap((module) =>
    module.units.flatMap((unit) =>
      unit.declarations.flatMap<Declaration>((declaration) =>
        declaration.kind === "zeropage" ? declaration.variables : [declaration],
      ),
    ),
  );
  for (let index = declarations.length - 1; index >= 0; index--) {
    const declaration = declarations[index]!;
    if (declaration.kind === "variable" && declaration.initializer !== null) {
      pending.push({
        kind: "expression",
        value: declaration.initializer,
        ownerSpan: declaration.span,
        owner:
          declaration.declarationKind === "let"
            ? "mutable"
            : declaration.loadable
              ? "loadable"
              : "resident",
      });
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
    if (!visit(current.value, current.owner, current.ownerSpan)) continue;
    const children = expressionChildren(current.value);
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push({
        kind: "expression",
        value: children[index]!,
        owner: current.owner,
        ownerSpan: current.ownerSpan,
      });
    }
  }
}

/** Decode the already validated literal items used by one raw asset path. */
function embeddedLiteralPath(expression: Expr): string | null {
  if (expression.kind !== "literal" || expression.literalKind !== "string") return null;
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
  analysis: ModuleAnalysisResult,
  embeddedValueKeys: ReadonlySet<string>,
  profileAvailable: boolean,
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
    if (expression.kind === "literal" && !profileAvailable) {
      obligations.push(
        Object.freeze({
          kind: ANALYSIS_OBLIGATION_KIND.profile,
          span: freezeSourceSpan(expression.span),
          message: "Literal encoding requires a selected target profile",
        }),
      );
    }
    return true;
  });
  return Object.freeze(obligations);
}

/** Find literal embed requests without reading any asset. */
export function discoverEmbeddedRequests(graph: ModuleGraph): EmbeddedRequestResult {
  const requests: EmbeddedRequest[] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  visitGraphExpressions(graph.modules, (expression, owner, ownerSpan) => {
    if (
      expression.kind !== "call" ||
      expression.callee.kind !== "name" ||
      expression.callee.name !== "embed"
    ) {
      return true;
    }
    if (owner !== "resident" && owner !== "loadable") {
      diagnostics.push(
        projectDiagnostic(
          owner === "mutable" ? "E10134" : "E10135",
          owner === "mutable"
            ? "'embed()' can only initialize an ordinary or loadable const declaration — found 'let'"
            : "'embed()' can only appear in a module-level ordinary const or a loadable const initializer",
          owner === "mutable" ? (ownerSpan ?? expression.span) : expression.span,
        ),
      );
      return false;
    }
    const literalPath =
      expression.arguments[0] === undefined ? null : embeddedLiteralPath(expression.arguments[0]);
    if (literalPath === null) {
      diagnostics.push(
        projectDiagnostic(
          "E10136",
          "'embed()' path must be a string literal",
          expression.arguments[0]?.span ?? expression.span,
        ),
      );
    } else if (
      expression.arguments.length === 2 &&
      embeddedLiteralPath(expression.arguments[1]!) === null
    ) {
      diagnostics.push(
        projectDiagnostic(
          "E10250",
          `'embed()' selector must be a string literal — found '${expression.arguments[1]!.kind === "name" ? expression.arguments[1]!.name : "<expression>"}'`,
          expression.arguments[1]!.span,
        ),
      );
    } else if (expression.arguments.length > 2) {
      diagnostics.push(
        projectDiagnostic(
          "E10171",
          `Wrong argument count — 'embed()' expects 1 or 2 parameters, got ${expression.arguments.length}`,
          expression.span,
        ),
      );
    } else {
      requests.push(
        Object.freeze({
          key: `${expression.span.sourceId}:${expression.span.start}:${expression.span.end}`,
          span: freezeSourceSpan(expression.span),
          literalPath,
          sourceId: expression.span.sourceId,
          selector:
            expression.arguments.length === 2
              ? embeddedLiteralPath(expression.arguments[1]!)
              : null,
        }),
      );
    }
    return false;
  });
  return diagnostics.length > 0
    ? Object.freeze({ kind: "error", diagnostics: sortAnalysisDiagnostics(diagnostics) })
    : Object.freeze({ kind: "complete", requests: Object.freeze(requests) });
}
