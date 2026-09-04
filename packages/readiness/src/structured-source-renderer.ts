import type {
  GenArrayReferenceExpression,
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredParameter,
  GenStructuredStatement,
} from "./generator-ir.js";
import { renderExpression } from "./expression-renderer.js";
import type { ExpressionRenderContext } from "./expression-renderer.js";

function indentation(depth: number): string {
  return "  ".repeat(depth);
}

function renderArgument(
  argument: GenStructuredExpression | GenArrayReferenceExpression,
  path: string,
  context: ExpressionRenderContext,
): string {
  return argument.kind === "array-reference"
    ? argument.name
    : renderExpression(argument, path, context);
}

function renderParameter(parameter: GenStructuredParameter): string {
  if (!("kind" in parameter) || parameter.kind === "scalar-parameter") {
    return `${parameter.name}: ${parameter.type}`;
  }
  const extent = parameter.type.extent === null ? "" : String(parameter.type.extent);
  const access = parameter.type.access === "const" ? "const " : "";
  return `${parameter.name}: ${access}${parameter.type.elementType}[${extent}]`;
}

function renderStatements(
  statements: readonly GenStructuredStatement[],
  path: string,
  depth: number,
  context: ExpressionRenderContext,
): string[] {
  const lines: string[] = [];
  statements.forEach((statement, index) => {
    const statementPath = `${path}/${index}`;
    const prefix = indentation(depth);
    if (statement.kind === "local") {
      lines.push(
        `${prefix}let ${statement.name}: ${statement.type} = ${renderExpression(
          statement.initializer,
          `${statementPath}/initializer`,
          context,
        )};`,
      );
    } else if (statement.kind === "array") {
      const initializer = statement.initializer
        .map((value, itemIndex) =>
          renderExpression(value, `${statementPath}/initializer/${itemIndex}`, context),
        )
        .join(", ");
      lines.push(
        `${prefix}let ${statement.name}: ${statement.elementType}[${statement.extent}] = [${initializer}];`,
      );
    } else if (statement.kind === "assign") {
      const target =
        typeof statement.target === "string"
          ? statement.target
          : `${statement.target.target}[${renderExpression(
              statement.target.index,
              `${statementPath}/target/index`,
              context,
            )}]`;
      lines.push(
        `${prefix}${target} = ${renderExpression(statement.value, `${statementPath}/value`, context)};`,
      );
    } else if (statement.kind === "memory-write") {
      const intrinsic = statement.width === 1 ? "poke" : "pokew";
      lines.push(
        `${prefix}${intrinsic}(${renderExpression(
          statement.address,
          `${statementPath}/address`,
          context,
        )}, ${renderExpression(statement.value, `${statementPath}/value`, context)});`,
      );
    } else if (statement.kind === "return") {
      lines.push(
        statement.value === undefined
          ? `${prefix}return;`
          : `${prefix}return ${renderExpression(statement.value, `${statementPath}/value`, context)};`,
      );
    } else if (statement.kind === "call-statement") {
      const argumentsText = statement.arguments
        .map((argument, argumentIndex) =>
          renderArgument(argument, `${statementPath}/arguments/${argumentIndex}`, context),
        )
        .join(", ");
      lines.push(`${prefix}${statement.callee}(${argumentsText});`);
    } else if (statement.kind === "if") {
      lines.push(
        `${prefix}if (${renderExpression(statement.condition, `${statementPath}/condition`, context)}) {`,
      );
      lines.push(
        ...renderStatements(statement.thenBody, `${statementPath}/thenBody`, depth + 1, context),
      );
      lines.push(`${prefix}} else {`);
      lines.push(
        ...renderStatements(statement.elseBody, `${statementPath}/elseBody`, depth + 1, context),
      );
      lines.push(`${prefix}}`);
    } else if (statement.kind === "while") {
      lines.push(
        `${prefix}while (${renderExpression(statement.condition, `${statementPath}/condition`, context)}) {`,
      );
      lines.push(...renderStatements(statement.body, `${statementPath}/body`, depth + 1, context));
      lines.push(`${prefix}}`);
    } else if (statement.kind === "do-while") {
      lines.push(`${prefix}do {`);
      lines.push(...renderStatements(statement.body, `${statementPath}/body`, depth + 1, context));
      lines.push(
        `${prefix}} while (${renderExpression(statement.condition, `${statementPath}/condition`, context)});`,
      );
    } else {
      const step = statement.step === 1n ? "" : ` step ${statement.step.toString(10)}`;
      lines.push(
        `${prefix}for (let ${statement.counter}: ${statement.counterType} = ${renderExpression(
          statement.start,
          `${statementPath}/start`,
          context,
        )} ${statement.direction} ${renderExpression(
          statement.end,
          `${statementPath}/end`,
          context,
        )}${step}) {`,
      );
      lines.push(...renderStatements(statement.body, `${statementPath}/body`, depth + 1, context));
      lines.push(`${prefix}}`);
    }
  });
  return lines;
}

function renderFunction(
  fn: GenStructuredFunction,
  functionIndex: number,
  context: ExpressionRenderContext,
): string {
  const parameters = fn.parameters.map(renderParameter).join(", ");
  const lines = [`function ${fn.name}(${parameters}): ${fn.returnType} {`];
  lines.push(...renderStatements(fn.body, `/functions/${functionIndex}/body`, 1, context));
  lines.push("}");
  return lines.join("\n");
}

/**
 * Renders validated structured functions in declaration order.
 *
 * @param module Closed structured generator module.
 * @param context Literal-spelling and expression-grouping authority.
 * @returns Canonical function source blocks without a trailing line feed.
 *
 * @example
 * ```ts
 * const functions = renderStructuredFunctions(module, context);
 * ```
 */
export function renderStructuredFunctions(
  module: GenStructuredModule,
  context: ExpressionRenderContext,
): readonly string[] {
  return Object.freeze(module.functions.map((fn, index) => renderFunction(fn, index, context)));
}
