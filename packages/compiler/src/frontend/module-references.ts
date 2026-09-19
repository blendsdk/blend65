import type { SourceSpan } from "../project/types.js";
import type { Block, Expr, Statement, SyntaxUnit, TypeSyntax } from "./syntax.js";

/** One dotted syntax reference that can select a module or call the entry point. */
export interface ModuleReference {
  /** Exact dotted spelling. */
  readonly name: string;
  /** Complete syntax region containing the spelling. */
  readonly span: SourceSpan;
  /** Whether the spelling is the callee of an ordinary direct call. */
  readonly directCall: boolean;
  /** Whether the first name is declared as a value in the current lexical context. */
  readonly localRoot: boolean;
  /** Whether the spelling came from a nominal type position. */
  readonly typeReference: boolean;
}

/** Convert a member chain such as `Math.f` to its dotted spelling without recursion. */
function memberName(expression: Expr): string | null {
  const members: string[] = [];
  let current = expression;
  while (current.kind === "member") {
    members.push(current.member);
    current = current.object;
  }
  if (current.kind !== "name") return null;
  members.push(current.name);
  return members.reverse().join(".");
}

/** Visit every type and nested extent that can carry a qualified reference. */
function visitType(
  type: TypeSyntax | null,
  valueRoots: ReadonlySet<string>,
  visit: (reference: ModuleReference) => void,
): void {
  if (type === null || type.kind === "unchecked") return;
  if (type.kind === "named-type") {
    if (type.name.includes(".")) {
      visit({
        name: type.name,
        span: type.span,
        directCall: false,
        localRoot: false,
        typeReference: true,
      });
    }
    return;
  }
  visitType(type.element, valueRoots, visit);
  if (type.extent !== null) visitExpression(type.extent, valueRoots, visit);
}

/** Visit every expression child that can carry a qualified module reference. */
function visitExpression(
  expression: Expr,
  valueRoots: ReadonlySet<string>,
  visit: (reference: ModuleReference) => void,
): void {
  switch (expression.kind) {
    case "number":
    case "boolean":
    case "literal":
    case "name":
      return;
    case "unary":
    case "length":
      visitExpression(expression.operand, valueRoots, visit);
      return;
    case "binary":
      visitExpression(expression.left, valueRoots, visit);
      visitExpression(expression.right, valueRoots, visit);
      return;
    case "conditional":
      visitExpression(expression.condition, valueRoots, visit);
      visitExpression(expression.whenTrue, valueRoots, visit);
      visitExpression(expression.whenFalse, valueRoots, visit);
      return;
    case "cast":
      visitType(expression.type, valueRoots, visit);
      visitExpression(expression.operand, valueRoots, visit);
      return;
    case "assignment":
      visitExpression(expression.target, valueRoots, visit);
      visitExpression(expression.value, valueRoots, visit);
      return;
    case "call": {
      const called = memberName(expression.callee);
      if (called !== null) {
        visit({
          name: called,
          span: expression.callee.span,
          directCall: true,
          localRoot: valueRoots.has(called.split(".")[0] ?? ""),
          typeReference: false,
        });
      } else {
        visitExpression(expression.callee, valueRoots, visit);
      }
      for (const argument of expression.arguments) visitExpression(argument, valueRoots, visit);
      return;
    }
    case "sizeof":
      visitType(expression.operand, valueRoots, visit);
      return;
    case "offsetof":
      visitType(expression.operand, valueRoots, visit);
      return;
    case "index":
      visitExpression(expression.object, valueRoots, visit);
      visitExpression(expression.index, valueRoots, visit);
      return;
    case "member": {
      const name = memberName(expression);
      if (name !== null) {
        visit({
          name,
          span: expression.span,
          directCall: false,
          localRoot: valueRoots.has(name.split(".")[0] ?? ""),
          typeReference: false,
        });
      } else {
        visitExpression(expression.object, valueRoots, visit);
      }
      return;
    }
    case "array-literal":
      for (const element of expression.elements) visitExpression(element, valueRoots, visit);
      if (expression.fill !== null) visitExpression(expression.fill, valueRoots, visit);
      return;
    case "struct-literal":
      for (const field of expression.fields) visitExpression(field.value, valueRoots, visit);
  }
}

/** Visit the expressions and child blocks of one statement. */
function visitStatement(
  statement: Statement,
  valueRoots: Set<string>,
  visit: (reference: ModuleReference) => void,
): void {
  switch (statement.kind) {
    case "poison":
    case "unchecked":
    case "break":
    case "continue":
      return;
    case "variable":
      visitType(statement.type, valueRoots, visit);
      if (statement.initializer !== null) visitExpression(statement.initializer, valueRoots, visit);
      valueRoots.add(statement.name);
      return;
    case "expression-statement":
      visitExpression(statement.expression, valueRoots, visit);
      return;
    case "block":
      visitBlock(statement, new Set(valueRoots), visit);
      return;
    case "if":
      visitExpression(statement.condition, valueRoots, visit);
      visitBlock(statement.then, new Set(valueRoots), visit);
      if (statement.otherwise !== null) {
        visitStatement(statement.otherwise, new Set(valueRoots), visit);
      }
      return;
    case "while":
      visitExpression(statement.condition, valueRoots, visit);
      visitBlock(statement.body, new Set(valueRoots), visit);
      return;
    case "for": {
      const forRoots = new Set(valueRoots);
      if (statement.initializer !== null && "kind" in statement.initializer) {
        visitStatement(statement.initializer, forRoots, visit);
      } else if (statement.initializer !== null) {
        for (const expression of statement.initializer) {
          visitExpression(expression, forRoots, visit);
        }
      }
      if (statement.condition !== null) visitExpression(statement.condition, forRoots, visit);
      if (statement.update !== null) {
        for (const expression of statement.update) visitExpression(expression, forRoots, visit);
      }
      visitBlock(statement.body, new Set(forRoots), visit);
      return;
    }
    case "return":
      if (statement.value !== null) visitExpression(statement.value, valueRoots, visit);
  }
}

/** Visit every structured statement in one block. */
function visitBlock(
  block: Block,
  valueRoots: Set<string>,
  visit: (reference: ModuleReference) => void,
): void {
  for (const statement of block.statements) visitStatement(statement, valueRoots, visit);
}

/**
 * Collect qualified module references and direct entry calls from one parsed unit.
 * @example collectModuleReferences(unit).filter(({ directCall }) => directCall)
 */
export function collectModuleReferences(unit: SyntaxUnit): readonly ModuleReference[] {
  const references: ModuleReference[] = [];
  const visit = (reference: ModuleReference): void => {
    references.push(
      Object.freeze({
        name: reference.name,
        span: Object.freeze({ ...reference.span }),
        directCall: reference.directCall,
        localRoot: reference.localRoot,
        typeReference: reference.typeReference,
      }),
    );
  };
  const moduleValueRoots = new Set<string>();
  for (const imported of unit.imports) {
    for (const item of imported.items) moduleValueRoots.add(item.alias ?? item.name);
  }
  for (const declaration of unit.declarations) {
    if (
      declaration.kind === "variable" ||
      declaration.kind === "function" ||
      declaration.kind === "struct"
    ) {
      moduleValueRoots.add(declaration.name);
    }
  }
  for (const declaration of unit.declarations) {
    if (declaration.kind === "variable") {
      visitType(declaration.type, moduleValueRoots, visit);
      if (declaration.initializer !== null) {
        visitExpression(declaration.initializer, moduleValueRoots, visit);
      }
    } else if (declaration.kind === "function") {
      const functionValueRoots = new Set(moduleValueRoots);
      for (const parameter of declaration.parameters) {
        functionValueRoots.add(parameter.name);
        visitType(parameter.type, functionValueRoots, visit);
      }
      visitType(declaration.returnType, functionValueRoots, visit);
      visitBlock(declaration.body, functionValueRoots, visit);
    } else if (declaration.kind === "struct") {
      for (const field of declaration.fields) visitType(field.type, moduleValueRoots, visit);
    }
  }
  return Object.freeze(references);
}
