import { createOracleBudgetMeter } from "./oracle-budget.js";
import type { OracleFailure } from "./oracle-input.js";
import type { GenExpression, GenModule } from "./generator-ir.js";
import type { PreparedSemanticRelationRequestV1 } from "./semantic-relation-input.js";

function expressionNodeCount(expression: GenExpression): bigint {
  switch (expression.kind) {
    case "literal":
    case "name":
      return 1n;
    case "unary":
      return 1n + expressionNodeCount(expression.operand);
    case "binary":
      return 1n + expressionNodeCount(expression.left) + expressionNodeCount(expression.right);
    case "memory-read":
      return 1n + expressionNodeCount(expression.address);
  }
}

/** Counts every node in one closed legacy relation module. */
export function moduleNodeCount(module: GenModule): bigint {
  let count = 1n + BigInt(module.constants.length + module.functions.length);
  for (const constant of module.constants) count += expressionNodeCount(constant.value);
  for (const fn of module.functions) {
    count += BigInt(fn.parameters.length + fn.body.length);
    for (const statement of fn.body) {
      if (statement.kind === "local") count += expressionNodeCount(statement.initializer);
      else if (statement.kind === "assign") count += expressionNodeCount(statement.value);
      else if (statement.kind === "memory-write") {
        count += expressionNodeCount(statement.address) + expressionNodeCount(statement.value);
      } else if (statement.value !== undefined) count += expressionNodeCount(statement.value);
    }
  }
  return count;
}

/** Returns a transformed-node budget failure for a proposed relation rewrite. */
export function transformedBudgetFailure(
  prepared: PreparedSemanticRelationRequestV1,
  nodeCount: bigint,
): OracleFailure | undefined {
  const charged = createOracleBudgetMeter(prepared.request.budget).charge(
    "transformedNodes",
    nodeCount,
    "/transformedCase",
  );
  return charged.ok ? undefined : Object.freeze({ ok: false, diagnostics: charged.diagnostics });
}

/** Counts one standalone legacy expression tree. */
export function relationExpressionNodeCount(expression: GenExpression): bigint {
  return expressionNodeCount(expression);
}
