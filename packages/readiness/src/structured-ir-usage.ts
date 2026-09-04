import type {
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredStatement,
  GenerationBudgetDimension,
  StructuredGenerationBudgetDimensionV2,
  StructuredGenerationBudgetV2,
} from "./generator-ir.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";
import {
  evaluateStructuredModuleConstants,
  foldStructuredCompileTimeExpression,
  type StructuredCompileTimeValue,
} from "./structured-constant-evaluator.js";
import { structuredScalarRange } from "./structured-ir-semantic-types.js";

/** Complete structural usage measured for one closed structured module. */
export type StructuredConstructionUsageV2 = Readonly<
  Record<StructuredGenerationBudgetDimensionV2, bigint>
>;

interface ExpressionUsage {
  readonly nodes: bigint;
  readonly depth: bigint;
}

interface LoopWorkMeasurement {
  readonly work: bigint;
  readonly exceededPath?: string;
}

interface LoopWorkContext {
  readonly functions: ReadonlyMap<
    string,
    { readonly fn: GenStructuredFunction; readonly index: number }
  >;
  readonly cap: bigint;
  readonly constants: ReadonlyMap<string, StructuredCompileTimeValue>;
  readonly functionMemo: Map<string, LoopWorkMeasurement>;
}

function saturatingAdd(left: bigint, right: bigint, cap: bigint): bigint {
  if (left >= cap || right >= cap || left > cap - right) return cap;
  return left + right;
}

function saturatingMultiply(left: bigint, right: bigint, cap: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  if (left >= cap || right >= cap || left > cap / right) return cap;
  return left * right;
}

function combineWork(
  left: LoopWorkMeasurement,
  right: LoopWorkMeasurement,
  fallbackPath: string,
  cap: bigint,
): LoopWorkMeasurement {
  const work = saturatingAdd(left.work, right.work, cap);
  return {
    work,
    ...(left.exceededPath !== undefined
      ? { exceededPath: left.exceededPath }
      : right.exceededPath !== undefined
        ? { exceededPath: right.exceededPath }
        : work >= cap
          ? { exceededPath: fallbackPath }
          : {}),
  };
}

function functionLoopWork(name: string, context: LoopWorkContext): LoopWorkMeasurement {
  const existing = context.functionMemo.get(name);
  if (existing !== undefined) return existing;
  const definition = context.functions.get(name);
  if (definition === undefined) return { work: 0n };
  const result = statementListLoopWork(
    definition.fn.body,
    `/functions/${definition.index}/body`,
    context,
  );
  context.functionMemo.set(name, result);
  return result;
}

function expressionLoopWork(
  expression: GenStructuredExpression,
  path: string,
  context: LoopWorkContext,
): LoopWorkMeasurement {
  if (expression.kind === "literal" || expression.kind === "name") return { work: 0n };
  if (
    expression.kind === "unary" ||
    expression.kind === "memory-read" ||
    expression.kind === "index"
  ) {
    return expressionLoopWork(
      expression.kind === "unary"
        ? expression.operand
        : expression.kind === "memory-read"
          ? expression.address
          : expression.index,
      expression.kind === "unary"
        ? `${path}/operand`
        : expression.kind === "memory-read"
          ? `${path}/address`
          : `${path}/index`,
      context,
    );
  }
  if (expression.kind === "binary") {
    return combineWork(
      expressionLoopWork(expression.left, `${path}/left`, context),
      expressionLoopWork(expression.right, `${path}/right`, context),
      path,
      context.cap,
    );
  }
  let result: LoopWorkMeasurement = { work: 0n };
  for (let index = 0; index < expression.arguments.length; index += 1) {
    const argument = expression.arguments[index]!;
    if (argument.kind !== "array-reference") {
      result = combineWork(
        result,
        expressionLoopWork(argument, `${path}/arguments/${index}`, context),
        path,
        context.cap,
      );
    }
  }
  const callee = context.functions.get(expression.callee);
  return callee === undefined
    ? result
    : combineWork(
        result,
        functionLoopWork(expression.callee, context),
        `${path}/callee`,
        context.cap,
      );
}

function expressionListLoopWork(
  expressions: readonly GenStructuredExpression[],
  path: string,
  context: LoopWorkContext,
): LoopWorkMeasurement {
  let result: LoopWorkMeasurement = { work: 0n };
  for (let index = 0; index < expressions.length; index += 1) {
    result = combineWork(
      result,
      expressionLoopWork(expressions[index]!, `${path}/${index}`, context),
      path,
      context.cap,
    );
  }
  return result;
}

function statementLoopWork(
  statement: GenStructuredStatement,
  path: string,
  context: LoopWorkContext,
): LoopWorkMeasurement {
  if (statement.kind === "local") {
    return expressionLoopWork(statement.initializer, `${path}/initializer`, context);
  }
  if (statement.kind === "array") {
    return expressionListLoopWork(statement.initializer, `${path}/initializer`, context);
  }
  if (statement.kind === "assign") {
    const target =
      typeof statement.target === "string"
        ? { work: 0n }
        : expressionLoopWork(statement.target.index, `${path}/target/index`, context);
    return combineWork(
      target,
      expressionLoopWork(statement.value, `${path}/value`, context),
      path,
      context.cap,
    );
  }
  if (statement.kind === "memory-write") {
    return combineWork(
      expressionLoopWork(statement.address, `${path}/address`, context),
      expressionLoopWork(statement.value, `${path}/value`, context),
      path,
      context.cap,
    );
  }
  if (statement.kind === "return") {
    return statement.value === undefined
      ? { work: 0n }
      : expressionLoopWork(statement.value, `${path}/value`, context);
  }
  if (statement.kind === "call-statement") {
    let result: LoopWorkMeasurement = { work: 0n };
    for (let index = 0; index < statement.arguments.length; index += 1) {
      const argument = statement.arguments[index]!;
      if (argument.kind !== "array-reference") {
        result = combineWork(
          result,
          expressionLoopWork(argument, `${path}/arguments/${index}`, context),
          path,
          context.cap,
        );
      }
    }
    const callee = context.functions.get(statement.callee);
    return callee === undefined
      ? result
      : combineWork(
          result,
          functionLoopWork(statement.callee, context),
          `${path}/callee`,
          context.cap,
        );
  }
  if (statement.kind === "if") {
    const condition = expressionLoopWork(statement.condition, `${path}/condition`, context);
    const thenWork = statementListLoopWork(statement.thenBody, `${path}/thenBody`, context);
    const elseWork = statementListLoopWork(statement.elseBody, `${path}/elseBody`, context);
    const branch = thenWork.work >= elseWork.work ? thenWork : elseWork;
    return combineWork(condition, branch, path, context.cap);
  }
  if (statement.kind === "while") {
    return statement.condition.kind === "literal" && statement.condition.value === 0n
      ? { work: 0n }
      : { work: context.cap, exceededPath: path };
  }
  if (statement.kind === "do-while") {
    if (statement.condition.kind !== "literal" || statement.condition.value !== 0n) {
      return { work: context.cap, exceededPath: path };
    }
    const body = statementListLoopWork(statement.body, `${path}/body`, context);
    const work = saturatingAdd(1n, body.work, context.cap);
    return {
      work,
      ...(body.exceededPath !== undefined
        ? { exceededPath: body.exceededPath }
        : work >= context.cap
          ? { exceededPath: path }
          : {}),
    };
  }
  const bounds = combineWork(
    expressionLoopWork(statement.start, `${path}/start`, context),
    expressionLoopWork(statement.end, `${path}/end`, context),
    path,
    context.cap,
  );
  const domain = structuredLoopDomainSize(statement, context.constants);
  const body = statementListLoopWork(statement.body, `${path}/body`, context);
  const iterations = saturatingAdd(
    domain,
    saturatingMultiply(domain, body.work, context.cap),
    context.cap,
  );
  const work = saturatingAdd(bounds.work, iterations, context.cap);
  return {
    work,
    ...(bounds.exceededPath !== undefined
      ? { exceededPath: bounds.exceededPath }
      : body.exceededPath !== undefined && domain > 0n
        ? { exceededPath: body.exceededPath }
        : work >= context.cap
          ? { exceededPath: path }
          : {}),
  };
}

function statementListLoopWork(
  statements: readonly GenStructuredStatement[],
  path: string,
  context: LoopWorkContext,
): LoopWorkMeasurement {
  let result: LoopWorkMeasurement = { work: 0n };
  for (let index = 0; index < statements.length; index += 1) {
    result = combineWork(
      result,
      statementLoopWork(statements[index]!, `${path}/${index}`, context),
      `${path}/${index}`,
      context.cap,
    );
  }
  return result;
}

function deriveLoopWork(module: GenStructuredModule, limit: bigint): LoopWorkMeasurement {
  const evaluated = evaluateStructuredModuleConstants(module);
  const context: LoopWorkContext = {
    functions: new Map(module.functions.map((fn, index) => [fn.name, { fn, index }])),
    cap: limit + 1n,
    constants: evaluated.ok ? evaluated.values : new Map(),
    functionMemo: new Map(),
  };
  let maximum: LoopWorkMeasurement = { work: 0n };
  for (let index = 0; index < module.functions.length; index += 1) {
    const fn = module.functions[index]!;
    const candidate = functionLoopWork(fn.name, context);
    if (candidate.work > maximum.work) maximum = candidate;
  }
  return maximum;
}

function expressionUsage(value: GenStructuredExpression): ExpressionUsage {
  if (value.kind === "literal" || value.kind === "name") return { nodes: 1n, depth: 1n };
  if (value.kind === "unary" || value.kind === "memory-read" || value.kind === "index") {
    const child = expressionUsage(
      value.kind === "unary"
        ? value.operand
        : value.kind === "memory-read"
          ? value.address
          : value.index,
    );
    return { nodes: child.nodes + 1n, depth: child.depth + 1n };
  }
  if (value.kind === "binary") {
    const left = expressionUsage(value.left);
    const right = expressionUsage(value.right);
    return {
      nodes: left.nodes + right.nodes + 1n,
      depth: (left.depth > right.depth ? left.depth : right.depth) + 1n,
    };
  }
  let nodes = 1n;
  let depth = 1n;
  for (const argument of value.arguments) {
    if (argument.kind === "array-reference") {
      nodes += 1n;
    } else {
      const child = expressionUsage(argument);
      nodes += child.nodes;
      if (child.depth + 1n > depth) depth = child.depth + 1n;
    }
  }
  return { nodes, depth };
}

/** Returns the exact finite iteration count for a literal-bound loop. */
export function structuredLoopDomainSize(
  statement: Extract<GenStructuredStatement, { readonly kind: "for" }>,
  constants: ReadonlyMap<string, StructuredCompileTimeValue> = new Map(),
): bigint {
  const startFolded = foldStructuredCompileTimeExpression(statement.start, constants);
  const endFolded = foldStructuredCompileTimeExpression(statement.end, constants);
  const range = structuredScalarRange(statement.counterType);
  const startMinimum = startFolded.kind === "constant" ? startFolded.result.value : range.minimum;
  const startMaximum = startFolded.kind === "constant" ? startFolded.result.value : range.maximum;
  const endMinimum = endFolded.kind === "constant" ? endFolded.result.value : range.minimum;
  const endMaximum = endFolded.kind === "constant" ? endFolded.result.value : range.maximum;
  const step = statement.step;
  if (statement.direction === "until") {
    const distance = endMaximum - startMinimum;
    return distance <= 0n ? 0n : (distance + step - 1n) / step;
  }
  if (statement.direction === "to") {
    const distance = endMaximum - startMinimum;
    return distance < 0n ? 0n : distance / step + 1n;
  }
  const distance = startMaximum - endMinimum;
  return distance < 0n ? 0n : distance / step + 1n;
}

/**
 * Measures every structural dimension independent of a caller-selected budget.
 *
 * @param module Semantically closed structured module.
 * @returns Immutable exact usage snapshot.
 */
export function deriveStructuredConstructionUsage(
  module: GenStructuredModule,
  loopWorkLimit: bigint,
): StructuredConstructionUsageV2 {
  const usage: Record<StructuredGenerationBudgetDimensionV2, bigint> = {
    modules: 1n,
    declarations: 0n,
    "ir-nodes": 1n,
    statements: 0n,
    "expression-depth": 0n,
    "loop-work": 0n,
    "source-bytes": 0n,
    attempts: 0n,
    "statement-depth": 0n,
  };
  const addExpression = (value: GenStructuredExpression): void => {
    const counted = expressionUsage(value);
    usage["ir-nodes"] += counted.nodes;
    if (counted.depth > usage["expression-depth"]) usage["expression-depth"] = counted.depth;
  };
  const addBody = (statements: readonly GenStructuredStatement[], depth: bigint): void => {
    for (const statement of statements) {
      usage.statements += 1n;
      usage["ir-nodes"] += 1n;
      if (depth > usage["statement-depth"]) usage["statement-depth"] = depth;
      if (statement.kind === "local") {
        usage.declarations += 1n;
        addExpression(statement.initializer);
      } else if (statement.kind === "array") {
        usage.declarations += 1n;
        statement.initializer.forEach(addExpression);
      } else if (statement.kind === "assign") {
        if (typeof statement.target !== "string") addExpression(statement.target.index);
        addExpression(statement.value);
      } else if (statement.kind === "memory-write") {
        addExpression(statement.address);
        addExpression(statement.value);
      } else if (statement.kind === "return" && statement.value !== undefined) {
        addExpression(statement.value);
      } else if (statement.kind === "call-statement") {
        statement.arguments.forEach((argument) => {
          if (argument.kind !== "array-reference") addExpression(argument);
        });
      } else if (statement.kind === "if") {
        addExpression(statement.condition);
        addBody(statement.thenBody, depth + 1n);
        addBody(statement.elseBody, depth + 1n);
      } else if (statement.kind === "while" || statement.kind === "do-while") {
        addExpression(statement.condition);
        addBody(statement.body, depth + 1n);
      } else if (statement.kind === "for") {
        addExpression(statement.start);
        addExpression(statement.end);
        addBody(statement.body, depth + 1n);
      }
    }
  };
  module.constants.forEach((constant) => {
    usage.declarations += 1n;
    usage["ir-nodes"] += 1n;
    addExpression(constant.value);
  });
  module.functions.forEach((fn) => {
    usage.declarations += 1n + BigInt(fn.parameters.length);
    usage["ir-nodes"] += 1n + BigInt(fn.parameters.length);
    addBody(fn.body, 1n);
  });
  usage["loop-work"] = deriveLoopWork(module, loopWorkLimit).work;
  return Object.freeze({ ...usage });
}

/**
 * Finds the first structural dimension that exceeds a validated budget.
 *
 * @param module Closed module used to identify the first excessive loop.
 * @param usage Complete measured usage.
 * @param budget Validated structured limits.
 * @returns Stable budget failure, or `undefined` when all limits hold.
 */
export function findStructuredBudgetFailure(
  module: GenStructuredModule,
  usage: StructuredConstructionUsageV2,
  budget: StructuredGenerationBudgetV2,
): StructuredGenerationDiagnosticV2 | undefined {
  if (usage["loop-work"] > budget.maxLoopWork) {
    const loopWork = deriveLoopWork(module, budget.maxLoopWork);
    return structuredDiagnostic(
      "generation-budget",
      "loop-work-exceeded",
      loopWork.exceededPath ?? "/usage/loop-work",
      "Static loop work exceeds the structured budget.",
      { dimension: "loop-work" },
    );
  }
  const checks: readonly [GenerationBudgetDimension, bigint][] = [
    ["modules", BigInt(budget.maxModules)],
    ["declarations", BigInt(budget.maxDeclarations)],
    ["ir-nodes", BigInt(budget.maxIrNodes)],
    ["statements", BigInt(budget.maxStatements)],
    ["expression-depth", BigInt(budget.maxExpressionDepth)],
    ["source-bytes", BigInt(budget.maxSourceBytes)],
    ["attempts", BigInt(budget.maxAttempts)],
  ];
  for (const [dimension, limit] of checks) {
    if (usage[dimension] > limit) {
      return structuredDiagnostic(
        "generation-budget",
        "budget-exceeded",
        `/usage/${dimension}`,
        `Generation exceeded the ${dimension} budget.`,
        { dimension },
      );
    }
  }
  return undefined;
}
