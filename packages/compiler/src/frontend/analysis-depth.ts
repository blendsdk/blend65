import type { SourceSpan } from "../project/types.js";
import type { ModuleGraph } from "./semantic-types.js";
import type { Expr, Statement, TypeSyntax, VariableDeclaration } from "./syntax.js";

/** Maximum typed-expression nesting admitted before analysis must remain incomplete. */
export const MAX_ANALYSIS_EXPRESSION_DEPTH = 256;

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
export function excessiveGraphExpressionDepth(graph: ModuleGraph): SourceSpan | null {
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
