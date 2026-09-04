import type {
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredStatement,
} from "./generator-ir.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";

interface CallSite {
  readonly callee: string;
  readonly path: string;
}

function collectExpressionCallSites(
  expression: GenStructuredExpression,
  path: string,
  calls: CallSite[],
): void {
  if (expression.kind === "call") {
    calls.push({ callee: expression.callee, path: `${path}/callee` });
    expression.arguments.forEach((argument, index) => {
      if (argument.kind !== "array-reference") {
        collectExpressionCallSites(argument, `${path}/arguments/${index}`, calls);
      }
    });
  } else if (expression.kind === "unary") {
    collectExpressionCallSites(expression.operand, `${path}/operand`, calls);
  } else if (expression.kind === "binary") {
    collectExpressionCallSites(expression.left, `${path}/left`, calls);
    collectExpressionCallSites(expression.right, `${path}/right`, calls);
  } else if (expression.kind === "memory-read") {
    collectExpressionCallSites(expression.address, `${path}/address`, calls);
  } else if (expression.kind === "index") {
    collectExpressionCallSites(expression.index, `${path}/index`, calls);
  }
}

function collectStatementCallSites(
  statement: GenStructuredStatement,
  path: string,
  calls: CallSite[],
): void {
  const collectBody = (body: readonly GenStructuredStatement[], bodyPath: string): void =>
    body.forEach((child, index) => collectStatementCallSites(child, `${bodyPath}/${index}`, calls));
  if (statement.kind === "local") {
    collectExpressionCallSites(statement.initializer, `${path}/initializer`, calls);
  } else if (statement.kind === "array") {
    statement.initializer.forEach((item, index) =>
      collectExpressionCallSites(item, `${path}/initializer/${index}`, calls),
    );
  } else if (statement.kind === "assign") {
    if (typeof statement.target !== "string") {
      collectExpressionCallSites(statement.target.index, `${path}/target/index`, calls);
    }
    collectExpressionCallSites(statement.value, `${path}/value`, calls);
  } else if (statement.kind === "memory-write") {
    collectExpressionCallSites(statement.address, `${path}/address`, calls);
    collectExpressionCallSites(statement.value, `${path}/value`, calls);
  } else if (statement.kind === "return" && statement.value !== undefined) {
    collectExpressionCallSites(
      statement.value,
      statement.value.kind === "call" ? path : `${path}/value`,
      calls,
    );
  } else if (statement.kind === "call-statement") {
    calls.push({ callee: statement.callee, path: `${path}/callee` });
    statement.arguments.forEach((argument, index) => {
      if (argument.kind !== "array-reference") {
        collectExpressionCallSites(argument, `${path}/arguments/${index}`, calls);
      }
    });
  } else if (statement.kind === "if") {
    collectExpressionCallSites(statement.condition, `${path}/condition`, calls);
    collectBody(statement.thenBody, `${path}/thenBody`);
    collectBody(statement.elseBody, `${path}/elseBody`);
  } else if (statement.kind === "while" || statement.kind === "do-while") {
    collectExpressionCallSites(statement.condition, `${path}/condition`, calls);
    collectBody(statement.body, `${path}/body`);
  } else if (statement.kind === "for") {
    collectExpressionCallSites(statement.start, `${path}/start`, calls);
    collectExpressionCallSites(statement.end, `${path}/end`, calls);
    collectBody(statement.body, `${path}/body`);
  }
}

/**
 * Returns every call site in deterministic source order, including nested expressions and bodies.
 *
 * @param fn Structured function to inspect.
 * @param functionIndex Function's canonical module index.
 * @returns Complete ordered call-site projection.
 */
export function collectStructuredFunctionCallSites(
  fn: GenStructuredFunction,
  functionIndex: number,
): readonly CallSite[] {
  const calls: CallSite[] = [];
  fn.body.forEach((statement, index) =>
    collectStatementCallSites(statement, `/functions/${functionIndex}/body/${index}`, calls),
  );
  return Object.freeze(calls.map((call) => Object.freeze(call)));
}

/** Returns whether a statement list guarantees a return on every reachable path. */
export function structuredBodyReturns(body: readonly GenStructuredStatement[]): boolean {
  for (const statement of body) {
    if (statement.kind === "return") return true;
    if (
      statement.kind === "if" &&
      structuredBodyReturns(statement.thenBody) &&
      structuredBodyReturns(statement.elseBody)
    ) {
      return true;
    }
  }
  return false;
}

/** Returns a stable diagnostic when the complete structured call graph contains a cycle. */
export function structuredCallCycleFailure(
  module: GenStructuredModule,
): StructuredGenerationDiagnosticV2 | undefined {
  const graph = new Map<string, readonly CallSite[]>(
    module.functions.map((fn, index) => [fn.name, collectStructuredFunctionCallSites(fn, index)]),
  );
  const state = new Map<string, "visiting" | "complete">();
  for (const fn of module.functions) {
    if (state.has(fn.name)) continue;
    const stack: { readonly name: string; readonly inboundPath?: string; next: number }[] = [
      { name: fn.name, next: 0 },
    ];
    state.set(fn.name, "visiting");
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const calls = graph.get(frame.name) ?? [];
      const site = calls[frame.next];
      if (site === undefined) {
        state.set(frame.name, "complete");
        stack.pop();
        continue;
      }
      frame.next += 1;
      const calleeState = state.get(site.callee);
      if (calleeState === "visiting") {
        const cycleStart = stack.findIndex((candidate) => candidate.name === site.callee);
        return structuredDiagnostic(
          "generation-type-invalid",
          "call-cycle",
          stack[cycleStart + 1]?.inboundPath ?? site.path,
          "Generated call graph must be acyclic.",
        );
      }
      if (calleeState !== "complete") {
        state.set(site.callee, "visiting");
        stack.push({ name: site.callee, inboundPath: site.path, next: 0 });
      }
    }
  }
  return undefined;
}
