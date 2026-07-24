import { isDeepStrictEqual } from "node:util";

import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";
import { parseRenderedSource } from "./roundtrip-parser.js";
import type {
  LiteralSpellingClass,
  RoundTripExpression,
  RoundTripModule,
  RoundTripParseResult,
  RoundTripStatement,
  RoundTripValidationResult,
  SourceRenderOptions,
} from "./roundtrip-model.js";
import { prepareSourceRenderInput, renderPreparedSourceModule } from "./source-renderer.js";

function projectExpression(
  expression: GenExpression,
  path: string,
  spellings: ReadonlyMap<string, LiteralSpellingClass>,
): RoundTripExpression {
  if (expression.kind === "literal") {
    if (expression.type === "boolean") {
      return Object.freeze({
        kind: "boolean-literal",
        value: expression.value === 1n,
      });
    }
    return Object.freeze({
      kind: "integer-literal",
      value: expression.value,
      spelling: spellings.get(path) ?? "decimal",
    });
  }
  if (expression.kind === "name") {
    return Object.freeze({
      kind: "name",
      name: expression.name,
    });
  }
  if (expression.kind === "unary") {
    return Object.freeze({
      kind: "unary",
      operator: expression.operator,
      operand: projectExpression(expression.operand, `${path}/operand`, spellings),
    });
  }
  if (expression.kind === "binary") {
    return Object.freeze({
      kind: "binary",
      operator: expression.operator,
      left: projectExpression(expression.left, `${path}/left`, spellings),
      right: projectExpression(expression.right, `${path}/right`, spellings),
    });
  }
  return Object.freeze({
    kind: "memory-read",
    width: expression.width,
    address: projectExpression(expression.address, `${path}/address`, spellings),
  });
}

function projectStatement(
  statement: GenStatement,
  path: string,
  spellings: ReadonlyMap<string, LiteralSpellingClass>,
): RoundTripStatement {
  if (statement.kind === "local") {
    return Object.freeze({
      kind: "local",
      name: statement.name,
      type: statement.type,
      initializer: projectExpression(statement.initializer, `${path}/initializer`, spellings),
    });
  }
  if (statement.kind === "assign") {
    return Object.freeze({
      kind: "assign",
      target: statement.target,
      value: projectExpression(statement.value, `${path}/value`, spellings),
    });
  }
  if (statement.kind === "memory-write") {
    return Object.freeze({
      kind: "memory-write",
      width: statement.width,
      address: projectExpression(statement.address, `${path}/address`, spellings),
      value: projectExpression(statement.value, `${path}/value`, spellings),
    });
  }
  const value =
    statement.value === undefined
      ? undefined
      : projectExpression(statement.value, `${path}/value`, spellings);
  return value === undefined
    ? Object.freeze({ kind: "return" })
    : Object.freeze({ kind: "return", value });
}

function buildProjection(
  module: GenModule,
  spellings: ReadonlyMap<string, LiteralSpellingClass>,
): RoundTripModule {
  return Object.freeze({
    kind: "module",
    path: Object.freeze([...module.path]),
    constants: Object.freeze(
      module.constants.map((constant, index) =>
        Object.freeze({
          kind: "const" as const,
          name: constant.name,
          type: constant.type,
          value: projectExpression(constant.value, `/constants/${index}/value`, spellings),
        }),
      ),
    ),
    functions: Object.freeze(
      module.functions.map((fn, functionIndex) =>
        Object.freeze({
          kind: "function" as const,
          name: fn.name,
          parameters: Object.freeze(
            fn.parameters.map((parameter) => Object.freeze({ ...parameter })),
          ),
          returnType: fn.returnType,
          body: Object.freeze(
            fn.body.map((statement, statementIndex) =>
              projectStatement(
                statement,
                `/functions/${functionIndex}/body/${statementIndex}`,
                spellings,
              ),
            ),
          ),
        }),
      ),
    ),
  });
}

/**
 * Projects independent IR into the passive round-trip model.
 *
 * Rendering is used as the closed input/options validator so projection and source cannot accept
 * different contracts.
 *
 * @param module Independent generator module.
 * @param options Closed renderer options.
 * @returns Complete projection or the same validation diagnostics as rendering.
 */
export function projectForRoundTrip(
  module: GenModule,
  options: SourceRenderOptions,
): RoundTripParseResult {
  const prepared = prepareSourceRenderInput(module, options);
  if (!prepared.ok) return prepared;
  return {
    ok: true,
    projection: buildProjection(prepared.input.module, prepared.input.literalSpellings),
    diagnostics: [],
  };
}

/**
 * Renders, independently parses and structurally compares one module.
 *
 * @param module Independent generator module.
 * @param options Closed renderer options and source limit.
 * @returns Source and projection only when both independent views agree.
 *
 * @example
 * ```ts
 * const checked = validateRoundTrip(module, options);
 * ```
 */
export function validateRoundTrip(
  module: GenModule,
  options: SourceRenderOptions,
): RoundTripValidationResult {
  const prepared = prepareSourceRenderInput(module, options);
  if (!prepared.ok) return prepared;
  const rendered = renderPreparedSourceModule(prepared.input);
  if (!rendered.ok) {
    return rendered;
  }
  const expected = buildProjection(prepared.input.module, prepared.input.literalSpellings);
  const parsed = parseRenderedSource(rendered.sourceBytes, prepared.input.maxSourceBytes);
  if (!parsed.ok) {
    return parsed;
  }
  if (!isDeepStrictEqual(expected, parsed.projection)) {
    return {
      ok: false,
      diagnostics: [
        Object.freeze({
          code: "roundtrip-mismatch",
          path: "/module",
          message: "rendered source does not preserve the independent IR projection",
        }),
      ],
    };
  }
  return {
    ok: true,
    source: rendered.source,
    sourceBytes: rendered.sourceBytes.slice(),
    projection: parsed.projection,
    diagnostics: [],
  };
}
