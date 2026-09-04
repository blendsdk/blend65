import {
  resolveDeclarationSelection,
  resolveExpressionSelection,
} from "./semantic-relation-analysis.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { GenExpression, GenFunction, GenModule, GenStatement } from "./generator-ir.js";
import type {
  GeneratedCaseProjection,
  GeneratedModeledCase,
  InvalidSourceTransform,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import {
  freezeSemanticRelationValue,
  snapshotSemanticRelationValue,
} from "./semantic-relation-freeze.js";

/** Creates a detached immutable legacy expression. */
export function freezeExpression(expression: GenExpression): GenExpression {
  switch (expression.kind) {
    case "literal":
    case "name":
      return Object.freeze({ ...expression });
    case "unary":
      return Object.freeze({ ...expression, operand: freezeExpression(expression.operand) });
    case "binary":
      return Object.freeze({
        ...expression,
        left: freezeExpression(expression.left),
        right: freezeExpression(expression.right),
      });
    case "memory-read":
      return Object.freeze({ ...expression, address: freezeExpression(expression.address) });
  }
}

/** Rewrites one identifier throughout a detached expression. */
export function mapExpressionNames(
  expression: GenExpression,
  oldName: string,
  newName: string,
): GenExpression {
  switch (expression.kind) {
    case "literal":
      return Object.freeze({ ...expression });
    case "name":
      return Object.freeze({
        ...expression,
        name: expression.name === oldName && isGenIdentifier(newName) ? newName : expression.name,
      });
    case "unary":
      return Object.freeze({
        ...expression,
        operand: mapExpressionNames(expression.operand, oldName, newName),
      });
    case "binary":
      return Object.freeze({
        ...expression,
        left: mapExpressionNames(expression.left, oldName, newName),
        right: mapExpressionNames(expression.right, oldName, newName),
      });
    case "memory-read":
      return Object.freeze({
        ...expression,
        address: mapExpressionNames(expression.address, oldName, newName),
      });
  }
}

/** Rewrites one identifier throughout a detached statement. */
export function mapStatementNames(
  statement: GenStatement,
  oldName: string,
  newName: string,
  renameDeclaration: boolean,
): GenStatement {
  if (!isGenIdentifier(newName)) return statement;
  switch (statement.kind) {
    case "local":
      return Object.freeze({
        ...statement,
        name: renameDeclaration && statement.name === oldName ? newName : statement.name,
        initializer: mapExpressionNames(statement.initializer, oldName, newName),
      });
    case "assign":
      return Object.freeze({
        ...statement,
        target: statement.target === oldName ? newName : statement.target,
        value: mapExpressionNames(statement.value, oldName, newName),
      });
    case "memory-write":
      return Object.freeze({
        ...statement,
        address: mapExpressionNames(statement.address, oldName, newName),
        value: mapExpressionNames(statement.value, oldName, newName),
      });
    case "return":
      return Object.freeze({
        ...statement,
        ...(statement.value === undefined
          ? {}
          : { value: mapExpressionNames(statement.value, oldName, newName) }),
      });
  }
}

/** Creates a detached immutable legacy function. */
export function freezeFunction(fn: GenFunction): GenFunction {
  return Object.freeze({
    ...fn,
    parameters: Object.freeze(fn.parameters.map((parameter) => Object.freeze({ ...parameter }))),
    body: Object.freeze(
      fn.body.map((statement) =>
        statement.kind === "local"
          ? Object.freeze({ ...statement, initializer: freezeExpression(statement.initializer) })
          : statement.kind === "assign"
            ? Object.freeze({ ...statement, value: freezeExpression(statement.value) })
            : statement.kind === "memory-write"
              ? Object.freeze({
                  ...statement,
                  address: freezeExpression(statement.address),
                  value: freezeExpression(statement.value),
                })
              : Object.freeze({
                  ...statement,
                  ...(statement.value === undefined
                    ? {}
                    : { value: freezeExpression(statement.value) }),
                }),
      ),
    ),
  });
}

/** Creates a detached immutable legacy module. */
export function freezeModule(module: GenModule): GenModule {
  return Object.freeze({
    ...module,
    path: Object.freeze([...module.path]),
    constants: Object.freeze(
      module.constants.map((constant) =>
        Object.freeze({ ...constant, value: freezeExpression(constant.value) }),
      ),
    ),
    functions: Object.freeze(module.functions.map(freezeFunction)),
  });
}

function replaceProjectionModule(
  projection: GeneratedCaseProjection,
  module: GenModule,
  transform: InvalidSourceTransform | undefined,
): GeneratedCaseProjection {
  return projection.kind === "valid"
    ? Object.freeze({ kind: "valid", module })
    : Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: snapshotSemanticRelationValue(transform ?? projection.transform),
      });
}

/** Creates a detached modeled case around one rewritten module. */
export function transformedCase(
  source: GeneratedModeledCase,
  module: GenModule,
  parameterBindings: readonly ParameterValueBinding[] = source.parameterBindings,
  transform?: InvalidSourceTransform,
): GeneratedModeledCase {
  return freezeSemanticRelationValue({
    ...source,
    projection: replaceProjectionModule(source.projection, module, transform),
    parameterBindings: Object.freeze(
      parameterBindings.map((binding) => Object.freeze({ ...binding })),
    ),
    claimedRuleIds: Object.freeze([...source.claimedRuleIds]),
    validity: Object.freeze({ ...source.validity }),
    constructionUsage: Object.freeze({ ...source.constructionUsage }),
  });
}

/** Creates the immutable false-precondition relation result. */
export function inapplicable(): { readonly ok: true; readonly outcome: "relation-inapplicable" } {
  return Object.freeze({ ok: true, outcome: "relation-inapplicable" });
}

function canonicalIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) && String(index) === value ? index : undefined;
}

/** Checks whether a retained invalid-case transform still resolves after rewriting. */
export function invalidTransformResolves(
  module: GenModule,
  transform: InvalidSourceTransform,
): boolean {
  if (transform.kind === "parameter-binding-replace") {
    return resolveDeclarationSelection(module, transform.parameterPath)?.kind === "parameter";
  }
  if (transform.kind === "scalar-expression-replace") {
    const segments = transform.expressionPath.split("/");
    if (segments.length === 4 && segments[1] === "constants" && segments[3] === "value") {
      const index = canonicalIndex(segments[2]);
      return index !== undefined && module.constants[index] !== undefined;
    }
    return resolveExpressionSelection(module, transform.expressionPath) !== undefined;
  }
  const segments = transform.callPath.split("/");
  const functionIndex = canonicalIndex(segments[2]);
  const statementIndex = canonicalIndex(segments[4]);
  if (
    segments[0] !== "" ||
    segments[1] !== "functions" ||
    segments[3] !== "body" ||
    functionIndex === undefined ||
    statementIndex === undefined
  ) {
    return false;
  }
  const statement = module.functions[functionIndex]?.body[statementIndex];
  const argumentCount =
    segments.length === 5 && statement?.kind === "memory-write"
      ? 2
      : segments.length === 6 &&
          segments[5] === "value" &&
          statement?.kind === "return" &&
          statement.value?.kind === "memory-read"
        ? 1
        : undefined;
  if (argumentCount === undefined || !Number.isSafeInteger(transform.argumentIndex)) return false;
  return transform.kind === "intrinsic-argument-insert"
    ? transform.argumentIndex >= 0 && transform.argumentIndex <= argumentCount
    : transform.argumentIndex >= 0 && transform.argumentIndex < argumentCount;
}

/** Replaces a nested expression selected by a field-only path. */
export function replaceNestedExpression(
  current: GenExpression,
  expressionPath: readonly ("left" | "right" | "operand" | "address")[],
  replacement: GenExpression,
): GenExpression | undefined {
  const [head, ...tail] = expressionPath;
  if (head === undefined) return replacement;
  if (head === "operand" && current.kind === "unary") {
    const operand = replaceNestedExpression(current.operand, tail, replacement);
    return operand === undefined ? undefined : Object.freeze({ ...current, operand });
  }
  if ((head === "left" || head === "right") && current.kind === "binary") {
    const child = replaceNestedExpression(current[head], tail, replacement);
    return child === undefined ? undefined : Object.freeze({ ...current, [head]: child });
  }
  if (head === "address" && current.kind === "memory-read") {
    const address = replaceNestedExpression(current.address, tail, replacement);
    return address === undefined ? undefined : Object.freeze({ ...current, address });
  }
  return undefined;
}

/** Replaces one expression field and retains the enclosing statement kind. */
export function replaceStatementExpression(
  statement: GenStatement,
  field: "initializer" | "value" | "address",
  expressionPath: readonly ("left" | "right" | "operand" | "address")[],
  expression: GenExpression,
): GenStatement | undefined {
  let root: GenExpression | undefined;
  if (field === "initializer" && statement.kind === "local") root = statement.initializer;
  else if (
    field === "value" &&
    (statement.kind === "assign" || statement.kind === "memory-write")
  ) {
    root = statement.value;
  } else if (field === "value" && statement.kind === "return") root = statement.value;
  else if (field === "address" && statement.kind === "memory-write") root = statement.address;
  if (root === undefined) return undefined;
  const replaced = replaceNestedExpression(root, expressionPath, expression);
  if (replaced === undefined) return undefined;
  if (field === "initializer" && statement.kind === "local") {
    return Object.freeze({ ...statement, initializer: replaced });
  }
  if (field === "address" && statement.kind === "memory-write") {
    return Object.freeze({ ...statement, address: replaced });
  }
  return field === "value" ? Object.freeze({ ...statement, value: replaced }) : undefined;
}

/** Rewrites retained invalid-case expressions after an identifier rename. */
export function renamedInvalidTransform(
  projection: GeneratedCaseProjection,
  oldName: string,
  newName: string,
): InvalidSourceTransform | undefined {
  if (projection.kind !== "invalid") return undefined;
  const transform = projection.transform;
  if (
    transform.kind === "intrinsic-argument-insert" ||
    transform.kind === "intrinsic-argument-replace"
  ) {
    return Object.freeze({
      ...transform,
      argument: mapExpressionNames(transform.argument, oldName, newName),
    });
  }
  return snapshotSemanticRelationValue(transform);
}
