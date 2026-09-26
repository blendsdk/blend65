import { isScalarType, wrapInteger } from "./constants.js";
import type { BindingId, SemanticType } from "./semantic-types.js";
import type { Block, Expr, Statement, ForStatement, VariableDeclaration } from "./syntax.js";
import type { WrappingLoopProof } from "./flow.js";

/** Narrow a source loop initializer to its expression-list form. */
function isExpressionList(
  initializer: VariableDeclaration | readonly Expr[],
): initializer is readonly Expr[] {
  return Array.isArray(initializer);
}

/** Return whether a source block contains an explicit loop or function exit. */
export function blockHasExplicitExit(block: Block, nestedLoopDepth = 0): boolean {
  return block.statements.some((statement) => statementHasExplicitExit(statement, nestedLoopDepth));
}

/** Find returns and breaks which can leave the canonical loop being proved. */
function statementHasExplicitExit(statement: Statement, nestedLoopDepth: number): boolean {
  if (statement.kind === "return") return true;
  if (statement.kind === "break") return nestedLoopDepth === 0;
  if (statement.kind === "block") return blockHasExplicitExit(statement, nestedLoopDepth);
  if (statement.kind === "if") {
    return (
      blockHasExplicitExit(statement.then, nestedLoopDepth) ||
      (statement.otherwise !== null &&
        (statement.otherwise.kind === "block"
          ? blockHasExplicitExit(statement.otherwise, nestedLoopDepth)
          : statementHasExplicitExit(statement.otherwise, nestedLoopDepth)))
    );
  }
  if (statement.kind === "while" || statement.kind === "for" || statement.kind === "do-while") {
    return blockHasExplicitExit(statement.body, nestedLoopDepth + 1);
  }
  if (statement.kind === "switch") {
    return statement.clauses.some((clause) =>
      blockHasExplicitExit(
        { kind: "block", span: clause.span, statements: clause.statements },
        nestedLoopDepth,
      ),
    );
  }
  return false;
}

/**
 * Prove only the narrow canonical loop shape needed for fixed-width reachability.
 * Any body call, counter write, explicit exit, or non-literal bound declines the
 * proof and leaves the ordinary loop legal.
 */
export function proveWrappingForLoop(
  statement: ForStatement,
  counter: BindingId,
  counterType: SemanticType,
): WrappingLoopProof | null {
  if (
    statement.initializer === null ||
    isExpressionList(statement.initializer) ||
    statement.initializer.initializer === null ||
    statement.initializer.initializer.kind !== "number" ||
    statement.condition?.kind !== "binary" ||
    statement.condition.operator !== "<" ||
    statement.condition.left.kind !== "name" ||
    statement.condition.left.name !== statement.initializer.name ||
    statement.condition.right.kind !== "number" ||
    statement.update === null ||
    statement.update.length !== 1 ||
    blockHasExplicitExit(statement.body) ||
    blockTouchesName(statement.body, statement.initializer.name)
  ) {
    return null;
  }
  const update = statement.update[0];
  if (
    update === undefined ||
    update.kind !== "assignment" ||
    update.operator !== "+=" ||
    update.target.kind !== "name" ||
    update.target.name !== statement.initializer.name ||
    update.value.kind !== "number" ||
    update.value.value <= 0n
  ) {
    return null;
  }
  const start = statement.initializer.initializer.value;
  const bound = statement.condition.right.value;
  if (!isScalarType(counterType) || (counterType.name !== "byte" && counterType.name !== "sbyte")) {
    return null;
  }

  const seen = new Set<bigint>();
  let current = wrapInteger(start, counterType);
  while (!seen.has(current)) {
    if (current >= bound) return null;
    seen.add(current);
    current = wrapInteger(current + update.value.value, counterType);
  }
  return Object.freeze({
    counter,
    name: statement.initializer.name,
    range: counterType.name === "byte" ? "0–255" : "-128–127",
    bound,
    suggestedType: counterType.name === "byte" ? "word" : "sword",
  });
}

/** Return whether a loop body may change the counter or hide such a change in a call. */
function blockTouchesName(block: Block, name: string): boolean {
  return block.statements.some((statement) => statementTouchesName(statement, name));
}

/** Conservatively find counter assignments and calls in one source statement. */
function statementTouchesName(statement: Statement, name: string): boolean {
  if (statement.kind === "variable") {
    return statement.initializer !== null && expressionTouchesName(statement.initializer, name);
  }
  if (statement.kind === "expression-statement") {
    return expressionTouchesName(statement.expression, name);
  }
  if (statement.kind === "block") return blockTouchesName(statement, name);
  if (statement.kind === "if") {
    return (
      expressionTouchesName(statement.condition, name) ||
      blockTouchesName(statement.then, name) ||
      (statement.otherwise !== null &&
        (statement.otherwise.kind === "block"
          ? blockTouchesName(statement.otherwise, name)
          : statementTouchesName(statement.otherwise, name)))
    );
  }
  if (statement.kind === "while") {
    return (
      expressionTouchesName(statement.condition, name) || blockTouchesName(statement.body, name)
    );
  }
  if (statement.kind === "do-while") {
    return (
      blockTouchesName(statement.body, name) || expressionTouchesName(statement.condition, name)
    );
  }
  if (statement.kind === "switch") {
    return (
      expressionTouchesName(statement.value, name) ||
      statement.clauses.some((clause) =>
        clause.statements.some((child) => statementTouchesName(child, name)),
      )
    );
  }
  if (statement.kind === "for") return true;
  if (statement.kind === "return") {
    return statement.value !== null && expressionTouchesName(statement.value, name);
  }
  return false;
}

/** Conservatively find a call or assignment to the selected name in an expression tree. */
function expressionTouchesName(expression: Expr, name: string): boolean {
  switch (expression.kind) {
    case "assignment":
      return (
        (expression.target.kind === "name" && expression.target.name === name) ||
        expressionTouchesName(expression.target, name) ||
        expressionTouchesName(expression.value, name)
      );
    case "call":
      return true;
    case "unary":
    case "cast":
      return expressionTouchesName(expression.operand, name);
    case "binary":
      return (
        expressionTouchesName(expression.left, name) ||
        expressionTouchesName(expression.right, name)
      );
    case "conditional":
      return (
        expressionTouchesName(expression.condition, name) ||
        expressionTouchesName(expression.whenTrue, name) ||
        expressionTouchesName(expression.whenFalse, name)
      );
    case "index":
      return (
        expressionTouchesName(expression.object, name) ||
        expressionTouchesName(expression.index, name)
      );
    case "member":
      return expressionTouchesName(expression.object, name);
    case "length":
      return expressionTouchesName(expression.operand, name);
    case "array-literal":
      return (
        expression.elements.some((element) => expressionTouchesName(element, name)) ||
        (expression.fill !== null && expressionTouchesName(expression.fill, name))
      );
    case "struct-literal":
      return expression.fields.some((field) => expressionTouchesName(field.value, name));
    default:
      return false;
  }
}
