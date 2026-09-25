import type {
  BindingId,
  SemanticBinding,
  TypedBlock,
  TypedExpr,
  TypedIfStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { TypeSyntax } from "./syntax.js";

/** Narrow a for initializer without erasing its readonly expression-list type. */
export function isExpressionList(
  initializer: TypedVariableStatement | readonly TypedExpr[],
): initializer is readonly TypedExpr[] {
  return Array.isArray(initializer);
}

/** Distinguish a checked value operand from a retained type spelling. */
function isTypedOperand(operand: TypedExpr | TypeSyntax): operand is TypedExpr {
  return "constant" in operand;
}

/** Visit source dependencies without charging execution of either branch. */
function visitExpressionBindings(expression: TypedExpr, visit: (binding: BindingId) => void): void {
  if (expression.binding !== null) visit(expression.binding);
  const children: (TypedExpr | undefined)[] = [
    expression.left,
    expression.right,
    expression.condition,
    expression.whenTrue,
    expression.whenFalse,
    expression.target,
    expression.callee,
    expression.object,
    expression.index,
  ];
  if (expression.operand !== undefined && isTypedOperand(expression.operand)) {
    children.push(expression.operand);
  }
  if (typeof expression.value === "object" && expression.value !== null) {
    children.push(expression.value);
  }
  if (expression.fill !== undefined && expression.fill !== null) children.push(expression.fill);
  children.push(...(expression.arguments ?? []));
  children.push(...(expression.elements ?? []));
  children.push(...(expression.fields ?? []).map(({ value }) => value));
  for (const child of children) {
    if (child !== undefined) visitExpressionBindings(child, visit);
  }
}

/** Visit the names in a typed body so declaration ordering can put constants first. */
export function visitBlockBindings(block: TypedBlock, visit: (binding: BindingId) => void): void {
  for (const statement of block.statements) {
    switch (statement.kind) {
      case "variable":
        if (statement.initializer !== null) visitExpressionBindings(statement.initializer, visit);
        break;
      case "expression-statement":
        visitExpressionBindings(statement.expression, visit);
        break;
      case "return":
        if (statement.value !== null && statement.value !== undefined) {
          visitExpressionBindings(statement.value, visit);
        }
        break;
      case "block":
        visitBlockBindings(statement, visit);
        break;
      case "if": {
        let branch: TypedIfStatement | null = statement;
        while (branch !== null) {
          visitExpressionBindings(branch.condition, visit);
          visitBlockBindings(branch.then, visit);
          if (branch.otherwise?.kind === "block") {
            visitBlockBindings(branch.otherwise, visit);
          }
          branch = branch.otherwise?.kind === "if" ? branch.otherwise : null;
        }
        break;
      }
      case "while":
      case "do-while":
        visitExpressionBindings(statement.condition, visit);
        visitBlockBindings(statement.body, visit);
        break;
      case "for":
        if (statement.initializer !== null) {
          if (isExpressionList(statement.initializer)) {
            for (const expression of statement.initializer)
              visitExpressionBindings(expression, visit);
          } else if (statement.initializer.initializer !== null) {
            visitExpressionBindings(statement.initializer.initializer, visit);
          }
        }
        if (statement.condition !== null) visitExpressionBindings(statement.condition, visit);
        for (const update of statement.update ?? []) visitExpressionBindings(update, visit);
        visitBlockBindings(statement.body, visit);
        break;
      case "switch":
        visitExpressionBindings(statement.value, visit);
        for (const clause of statement.clauses) visitBlockBindings(clause.body, visit);
        break;
      case "break":
      case "continue":
        break;
    }
  }
}

/** Include constants read through nested direct calls before scheduling roots. */
export function collectConstantDependencies(
  functions: ReadonlyMap<string, { readonly body: TypedBlock }>,
  bindings: ReadonlyMap<string, SemanticBinding>,
): ReadonlyMap<string, readonly BindingId[]> {
  const result = new Map<string, readonly BindingId[]>();
  for (const key of functions.keys()) {
    const constants = new Map<string, BindingId>();
    const seen = new Set<string>();
    const visitFunction = (functionKey: string): void => {
      if (seen.has(functionKey)) return;
      seen.add(functionKey);
      const entry = functions.get(functionKey);
      if (entry === undefined) return;
      visitBlockBindings(entry.body, (binding) => {
        const bindingKey = bindingIdentityKey(binding);
        if (bindings.get(bindingKey)?.storage === "constant") constants.set(bindingKey, binding);
        if (functions.has(bindingKey)) visitFunction(bindingKey);
      });
    };
    visitFunction(key);
    result.set(
      key,
      Object.freeze(
        [...constants]
          .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
          .map(([, id]) => id),
      ),
    );
  }
  return result;
}
