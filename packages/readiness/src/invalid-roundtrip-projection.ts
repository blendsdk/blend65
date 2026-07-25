import { isDeepStrictEqual } from "node:util";

import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";
import type { InvalidSourceTransform } from "./modeled-generator-model.js";
import type {
  RoundTripDiagnostic,
  RoundTripExpression,
  RoundTripModule,
  RoundTripParseResult,
  RoundTripStatement,
} from "./roundtrip-model.js";
import type { PreparedSourceRenderInput } from "./source-renderer.js";
import { projectExpressionForRoundTrip } from "./roundtrip-validator.js";

type SourceTransform = Exclude<
  InvalidSourceTransform,
  { readonly kind: "parameter-binding-replace" }
>;
type IntrinsicTransform = Extract<
  SourceTransform,
  {
    readonly kind:
      | "intrinsic-argument-remove"
      | "intrinsic-argument-insert"
      | "intrinsic-argument-replace";
  }
>;

interface ProjectionContext {
  readonly prepared: PreparedSourceRenderInput;
  readonly transform: SourceTransform;
  applied: number;
  invalid: boolean;
}

interface ProjectedArgument {
  readonly expression: RoundTripExpression;
  readonly path: string;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function failure(
  code: RoundTripDiagnostic["code"],
  path: string,
  message: string,
): RoundTripParseResult {
  const diagnostic: RoundTripDiagnostic = Object.freeze({
    code,
    path,
    message,
  });
  return Object.freeze({ ok: false, diagnostics: Object.freeze([diagnostic]) });
}

function transformArguments(
  expressions: readonly GenExpression[],
  paths: readonly string[],
  transform: IntrinsicTransform,
  context: ProjectionContext,
): readonly ProjectedArgument[] | undefined {
  const argumentsValue = expressions.map((expression, index) => ({
    expression: projectExpressionForRoundTrip(
      expression,
      paths[index] ?? `${transform.callPath}/arguments/${index}`,
      context.prepared.literalSpellings,
    ),
    path: paths[index] ?? `${transform.callPath}/arguments/${index}`,
  }));
  const index = transform.argumentIndex;
  if (!Number.isSafeInteger(index) || index < 0) return undefined;
  if (transform.kind === "intrinsic-argument-remove") {
    if (index >= argumentsValue.length) return undefined;
    argumentsValue.splice(index, 1);
  } else {
    const upperBound =
      transform.kind === "intrinsic-argument-insert"
        ? argumentsValue.length
        : argumentsValue.length - 1;
    if (index > upperBound) return undefined;
    const path = paths[index] ?? `${transform.callPath}/arguments/${index}`;
    const projected = {
      expression: projectExpressionForRoundTrip(
        transform.argument,
        path,
        context.prepared.literalSpellings,
      ),
      path,
    };
    if (transform.kind === "intrinsic-argument-insert") {
      argumentsValue.splice(index, 0, projected);
    } else {
      argumentsValue[index] = projected;
    }
  }
  return Object.freeze(argumentsValue);
}

function projectExpression(
  expression: GenExpression,
  path: string,
  context: ProjectionContext,
): RoundTripExpression {
  const baseline = projectExpressionForRoundTrip(
    expression,
    path,
    context.prepared.literalSpellings,
  );
  if (
    context.transform.kind === "scalar-expression-replace" &&
    context.transform.expressionPath === path
  ) {
    const replacement: RoundTripExpression = Object.freeze({
      kind: "integer-literal",
      value: context.transform.replacement.value,
      spelling: "decimal",
    });
    context.applied += 1;
    if (isDeepStrictEqual(replacement, baseline)) context.invalid = true;
    return replacement;
  }
  if (
    expression.kind === "memory-read" &&
    context.transform.kind !== "scalar-expression-replace" &&
    context.transform.callPath === path
  ) {
    const transformed = transformArguments(
      [expression.address],
      [`${path}/address`],
      context.transform,
      context,
    );
    if (transformed === undefined) {
      context.invalid = true;
      return baseline;
    }
    context.applied += 1;
    const argumentsValue = Object.freeze(transformed.map(({ expression: value }) => value));
    const projected: RoundTripExpression =
      argumentsValue.length === 1 && argumentsValue[0] !== undefined
        ? Object.freeze({
            kind: "memory-read",
            width: expression.width,
            address: argumentsValue[0],
          })
        : Object.freeze({
            kind: "invalid-memory-read",
            intrinsic: expression.width === 1 ? "peek" : "peekw",
            arguments: argumentsValue,
          });
    if (isDeepStrictEqual(projected, baseline)) context.invalid = true;
    return projected;
  }
  if (expression.kind === "unary") {
    return Object.freeze({
      kind: "unary",
      operator: expression.operator,
      operand: projectExpression(expression.operand, `${path}/operand`, context),
    });
  }
  if (expression.kind === "binary") {
    return Object.freeze({
      kind: "binary",
      operator: expression.operator,
      left: projectExpression(expression.left, `${path}/left`, context),
      right: projectExpression(expression.right, `${path}/right`, context),
    });
  }
  if (expression.kind === "memory-read") {
    return Object.freeze({
      kind: "memory-read",
      width: expression.width,
      address: projectExpression(expression.address, `${path}/address`, context),
    });
  }
  return baseline;
}

function projectStatement(
  statement: GenStatement,
  path: string,
  context: ProjectionContext,
): RoundTripStatement {
  if (statement.kind === "local") {
    return Object.freeze({
      kind: "local",
      name: statement.name,
      type: statement.type,
      initializer: projectExpression(statement.initializer, `${path}/initializer`, context),
    });
  }
  if (statement.kind === "assign") {
    return Object.freeze({
      kind: "assign",
      target: statement.target,
      value: projectExpression(statement.value, `${path}/value`, context),
    });
  }
  if (statement.kind === "memory-write") {
    const baseline: RoundTripStatement = Object.freeze({
      kind: "memory-write",
      width: statement.width,
      address: projectExpressionForRoundTrip(
        statement.address,
        `${path}/address`,
        context.prepared.literalSpellings,
      ),
      value: projectExpressionForRoundTrip(
        statement.value,
        `${path}/value`,
        context.prepared.literalSpellings,
      ),
    });
    if (
      context.transform.kind !== "scalar-expression-replace" &&
      context.transform.callPath === path
    ) {
      const transformed = transformArguments(
        [statement.address, statement.value],
        [`${path}/address`, `${path}/value`],
        context.transform,
        context,
      );
      if (transformed === undefined) {
        context.invalid = true;
        return baseline;
      }
      context.applied += 1;
      const argumentsValue = Object.freeze(transformed.map(({ expression }) => expression));
      const address = argumentsValue[0];
      const value = argumentsValue[1];
      const projected: RoundTripStatement =
        argumentsValue.length === 2 && address !== undefined && value !== undefined
          ? Object.freeze({
              kind: "memory-write",
              width: statement.width,
              address,
              value,
            })
          : Object.freeze({
              kind: "invalid-memory-write",
              intrinsic: statement.width === 1 ? "poke" : "pokew",
              arguments: argumentsValue,
            });
      if (isDeepStrictEqual(projected, baseline)) context.invalid = true;
      return projected;
    }
    return Object.freeze({
      kind: "memory-write",
      width: statement.width,
      address: projectExpression(statement.address, `${path}/address`, context),
      value: projectExpression(statement.value, `${path}/value`, context),
    });
  }
  const value =
    statement.value === undefined
      ? undefined
      : projectExpression(statement.value, `${path}/value`, context);
  return value === undefined
    ? Object.freeze({ kind: "return" })
    : Object.freeze({ kind: "return", value });
}

function projectModule(module: GenModule, context: ProjectionContext): RoundTripModule {
  return Object.freeze({
    kind: "module",
    path: Object.freeze([...module.path]),
    constants: Object.freeze(
      module.constants.map((constant, index) =>
        Object.freeze({
          kind: "const" as const,
          name: constant.name,
          type: constant.type,
          value: projectExpression(constant.value, `/constants/${index}/value`, context),
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
                context,
              ),
            ),
          ),
        }),
      ),
    ),
  });
}

/**
 * Derives the complete expected passive projection for one deliberate source transform.
 *
 * @param prepared Validated immutable baseline and spelling selection.
 * @param transform One non-binding invalid transform.
 * @returns Expected projection only when the transform changes exactly one resolved path.
 */
export function deriveInvalidRoundTripProjection(
  prepared: PreparedSourceRenderInput,
  transform: SourceTransform,
): RoundTripParseResult {
  const context: ProjectionContext = {
    prepared,
    transform,
    applied: 0,
    invalid: false,
  };
  const projection = projectModule(prepared.module, context);
  return context.applied === 1 && !context.invalid
    ? Object.freeze({ ok: true, projection, diagnostics: EMPTY_DIAGNOSTICS })
    : failure(
        "render.input.invalid",
        "/generatedCase/projection/transform",
        "Invalid transform must change exactly one in-range projection path.",
      );
}

/**
 * Compares the full independently parsed projection with the derived invalid projection.
 *
 * @param expected Derived transformed projection.
 * @param actual Independently parsed source projection.
 * @returns The actual projection only when every field agrees.
 */
export function validateInvalidRoundTripProjection(
  expected: RoundTripModule,
  actual: RoundTripModule,
): RoundTripParseResult {
  return isDeepStrictEqual(expected, actual)
    ? Object.freeze({ ok: true, projection: actual, diagnostics: EMPTY_DIAGNOSTICS })
    : failure(
        "roundtrip-mismatch",
        "/generatedCase/projection",
        "Parsed invalid source does not match the complete derived transform projection.",
      );
}
