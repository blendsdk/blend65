import type {
  GenArrayReferenceExpression,
  GenConst,
  GenIdentifier,
  GenIndexAssignmentTarget,
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredParameter,
  GenStructuredStatement,
  IrValidationResult,
  StructuredIrValidationResult,
} from "./generator-ir.js";
import { isGenIdentifier, isScalarType } from "./generator-ir.js";
import {
  parseGeneratorArrayType,
  parseGeneratorCallArgument,
  parseGeneratorExpression,
} from "./generator-ir-expression-parser.js";
import {
  isLegacyExpression,
  isLegacyModule,
  validateLegacyModuleTypes,
} from "./generator-ir-legacy-semantics.js";
import {
  generatorDiagnostic,
  generatorNodeFailure,
  generatorNodeSuccess,
  hasExactGeneratorKeys,
  isGeneratorRecord,
  type GeneratorNodeResult,
} from "./generator-ir-parser-common.js";
import { inspectGeneratorInput } from "./generator-input-inspection.js";
import { validateStructuredModuleSemantics } from "./structured-ir-semantics.js";

export { inspectGeneratorInput, type GeneratorInputFailure } from "./generator-input-inspection.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
type NodeResult<T> = GeneratorNodeResult<T>;
const diagnostic = generatorDiagnostic;
const failure = generatorNodeFailure;
const success = generatorNodeSuccess;
const isRecord = isGeneratorRecord;
const hasExactKeys = hasExactGeneratorKeys;
const parseExpression = parseGeneratorExpression;
const parseCallArgument = parseGeneratorCallArgument;
const parseArrayType = parseGeneratorArrayType;

function parseStatement(value: unknown, path: string): NodeResult<GenStructuredStatement> {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return failure("generation-input-invalid", path, "Statement must be a closed record.");
  }
  if (value.kind === "local") {
    if (
      !hasExactKeys(value, ["kind", "name", "type", "initializer"]) ||
      !isGenIdentifier(value.name) ||
      !isScalarType(value.type)
    ) {
      return failure("generation-input-invalid", path, "Local statement shape is invalid.");
    }
    const initializer = parseExpression(value.initializer, `${path}/initializer`, 1);
    if (!initializer.ok) return initializer;
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "local",
        name: value.name,
        type: value.type,
        initializer: initializer.node,
      }),
    );
  }
  if (value.kind === "array") {
    if (
      !hasExactKeys(value, ["kind", "name", "elementType", "extent", "initializer"]) ||
      !isGenIdentifier(value.name) ||
      !isScalarType(value.elementType) ||
      typeof value.extent !== "number" ||
      !Number.isSafeInteger(value.extent) ||
      !Array.isArray(value.initializer)
    ) {
      return failure("generation-input-invalid", path, "Array declaration shape is invalid.");
    }
    const initializer: GenStructuredExpression[] = [];
    for (let index = 0; index < value.initializer.length; index += 1) {
      const expression = parseExpression(
        value.initializer[index],
        `${path}/initializer/${index}`,
        1,
      );
      if (!expression.ok) return expression;
      initializer.push(expression.node);
    }
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "array",
        name: value.name,
        elementType: value.elementType,
        extent: value.extent,
        initializer: Object.freeze(initializer),
      }),
    );
  }
  if (value.kind === "assign") {
    if (!hasExactKeys(value, ["kind", "target", "value"])) {
      return failure("generation-input-invalid", path, "Assignment shape is invalid.");
    }
    let target: GenIdentifier | GenIndexAssignmentTarget;
    if (isGenIdentifier(value.target)) {
      target = value.target;
    } else if (
      isRecord(value.target) &&
      hasExactKeys(value.target, ["kind", "type", "target", "index"]) &&
      value.target.kind === "index-target" &&
      isScalarType(value.target.type) &&
      isGenIdentifier(value.target.target)
    ) {
      const index = parseExpression(value.target.index, `${path}/target/index`, 1);
      if (!index.ok) return index;
      target = Object.freeze({
        kind: "index-target",
        type: value.target.type,
        target: value.target.target,
        index: index.node,
      });
    } else {
      return failure("generation-input-invalid", `${path}/target`, "Assignment target is invalid.");
    }
    const expression = parseExpression(value.value, `${path}/value`, 1);
    if (!expression.ok) return expression;
    return success<GenStructuredStatement>(
      Object.freeze({ kind: "assign", target, value: expression.node }),
    );
  }
  if (value.kind === "memory-write") {
    if (
      !hasExactKeys(value, ["kind", "width", "address", "value"]) ||
      (value.width !== 1 && value.width !== 2)
    ) {
      return failure("generation-input-invalid", path, "Memory-write shape is invalid.");
    }
    const address = parseExpression(value.address, `${path}/address`, 1);
    if (!address.ok) return address;
    const expression = parseExpression(value.value, `${path}/value`, 1);
    if (!expression.ok) return expression;
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "memory-write",
        width: value.width,
        address: address.node,
        value: expression.node,
      }),
    );
  }
  if (value.kind === "return") {
    if (!hasExactKeys(value, Object.hasOwn(value, "value") ? ["kind", "value"] : ["kind"])) {
      return failure("generation-input-invalid", path, "Return statement shape is invalid.");
    }
    if (!Object.hasOwn(value, "value")) {
      return success<GenStructuredStatement>(Object.freeze({ kind: "return" }));
    }
    const expression = parseExpression(value.value, `${path}/value`, 1);
    if (!expression.ok) return expression;
    return success<GenStructuredStatement>(
      Object.freeze({ kind: "return", value: expression.node }),
    );
  }
  if (value.kind === "call-statement") {
    if (
      !hasExactKeys(value, ["kind", "callee", "arguments"]) ||
      !isGenIdentifier(value.callee) ||
      !Array.isArray(value.arguments)
    ) {
      return failure("generation-input-invalid", path, "Call statement shape is invalid.");
    }
    const argumentsValue: (GenStructuredExpression | GenArrayReferenceExpression)[] = [];
    for (let index = 0; index < value.arguments.length; index += 1) {
      const argument = parseCallArgument(value.arguments[index], `${path}/arguments/${index}`, 1);
      if (!argument.ok) return argument;
      argumentsValue.push(argument.node);
    }
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "call-statement",
        callee: value.callee,
        arguments: Object.freeze(argumentsValue),
      }),
    );
  }
  if (value.kind === "if") {
    if (
      !hasExactKeys(value, ["kind", "condition", "thenBody", "elseBody"]) ||
      !Array.isArray(value.thenBody) ||
      !Array.isArray(value.elseBody)
    ) {
      return failure("generation-input-invalid", path, "If statement shape is invalid.");
    }
    const condition = parseExpression(value.condition, `${path}/condition`, 1);
    if (!condition.ok) return condition;
    const thenBody = parseStatementList(value.thenBody, `${path}/thenBody`);
    if (!thenBody.ok) return thenBody;
    const elseBody = parseStatementList(value.elseBody, `${path}/elseBody`);
    if (!elseBody.ok) return elseBody;
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "if",
        condition: condition.node,
        thenBody: thenBody.node,
        elseBody: elseBody.node,
      }),
    );
  }
  if (value.kind === "while") {
    if (!hasExactKeys(value, ["kind", "condition", "body"]) || !Array.isArray(value.body)) {
      return failure("generation-input-invalid", path, "While statement shape is invalid.");
    }
    const condition = parseExpression(value.condition, `${path}/condition`, 1);
    if (!condition.ok) return condition;
    const body = parseStatementList(value.body, `${path}/body`);
    if (!body.ok) return body;
    return success<GenStructuredStatement>(
      Object.freeze({ kind: "while", condition: condition.node, body: body.node }),
    );
  }
  if (value.kind === "do-while") {
    if (!hasExactKeys(value, ["kind", "body", "condition"]) || !Array.isArray(value.body)) {
      return failure("generation-input-invalid", path, "Do-while statement shape is invalid.");
    }
    const body = parseStatementList(value.body, `${path}/body`);
    if (!body.ok) return body;
    const condition = parseExpression(value.condition, `${path}/condition`, 1);
    if (!condition.ok) return condition;
    return success<GenStructuredStatement>(
      Object.freeze({ kind: "do-while", body: body.node, condition: condition.node }),
    );
  }
  if (value.kind === "for") {
    if (
      !hasExactKeys(value, [
        "kind",
        "counter",
        "counterType",
        "start",
        "direction",
        "end",
        "step",
        "body",
      ]) ||
      !isGenIdentifier(value.counter) ||
      !isScalarType(value.counterType) ||
      value.counterType === "boolean" ||
      (value.direction !== "until" && value.direction !== "to" && value.direction !== "downto") ||
      typeof value.step !== "bigint" ||
      !Array.isArray(value.body)
    ) {
      return failure("generation-input-invalid", path, "For statement shape is invalid.");
    }
    const start = parseExpression(value.start, `${path}/start`, 1);
    if (!start.ok) return start;
    const end = parseExpression(value.end, `${path}/end`, 1);
    if (!end.ok) return end;
    const body = parseStatementList(value.body, `${path}/body`);
    if (!body.ok) return body;
    return success<GenStructuredStatement>(
      Object.freeze({
        kind: "for",
        counter: value.counter,
        counterType: value.counterType,
        start: start.node,
        direction: value.direction,
        end: end.node,
        step: value.step,
        body: body.node,
      }),
    );
  }
  return failure("generation-input-invalid", `${path}/kind`, "Statement kind is not supported.");
}

function parseStatementList(
  values: readonly unknown[],
  path: string,
): NodeResult<readonly GenStructuredStatement[]> {
  const statements: GenStructuredStatement[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const statement = parseStatement(values[index], `${path}/${index}`);
    if (!statement.ok) return statement;
    statements.push(statement.node);
  }
  return success(Object.freeze(statements));
}

function parseParameter(value: unknown, path: string): NodeResult<GenStructuredParameter> {
  if (!isRecord(value) || !isGenIdentifier(value.name)) {
    return failure("generation-input-invalid", path, "Parameter shape is invalid.");
  }
  if (hasExactKeys(value, ["name", "type"]) && isScalarType(value.type)) {
    return success(Object.freeze({ name: value.name, type: value.type }));
  }
  if (
    hasExactKeys(value, ["kind", "name", "type"]) &&
    value.kind === "scalar-parameter" &&
    isScalarType(value.type)
  ) {
    return success(Object.freeze({ kind: "scalar-parameter", name: value.name, type: value.type }));
  }
  if (hasExactKeys(value, ["kind", "name", "type"]) && value.kind === "array-parameter") {
    const type = parseArrayType(value.type, `${path}/type`);
    if (!type.ok) return type;
    return success(Object.freeze({ kind: "array-parameter", name: value.name, type: type.node }));
  }
  return failure("generation-input-invalid", path, "Parameter shape is invalid.");
}

function parseConst(value: unknown, path: string): NodeResult<GenConst> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["kind", "name", "type", "value"]) ||
    value.kind !== "const" ||
    !isGenIdentifier(value.name) ||
    !isScalarType(value.type)
  ) {
    return failure("generation-input-invalid", path, "Constant declaration shape is invalid.");
  }
  const expression = parseExpression(value.value, `${path}/value`, 1);
  if (!expression.ok) return expression;
  if (!isLegacyExpression(expression.node)) {
    return failure(
      "generation-input-invalid",
      `${path}/value`,
      "Module constants cannot contain structured runtime expressions.",
    );
  }
  return success(
    Object.freeze({
      kind: "const",
      name: value.name,
      type: value.type,
      value: expression.node,
    }),
  );
}

function parseFunction(value: unknown, path: string): NodeResult<GenStructuredFunction> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["kind", "name", "parameters", "returnType", "body"]) ||
    value.kind !== "function" ||
    !isGenIdentifier(value.name) ||
    (!isScalarType(value.returnType) && value.returnType !== "void") ||
    !Array.isArray(value.parameters) ||
    !Array.isArray(value.body)
  ) {
    return failure("generation-input-invalid", path, "Function declaration shape is invalid.");
  }
  const parameters: GenStructuredParameter[] = [];
  for (let index = 0; index < value.parameters.length; index += 1) {
    const parameter = parseParameter(value.parameters[index], `${path}/parameters/${index}`);
    if (!parameter.ok) return parameter;
    parameters.push(parameter.node);
  }
  const body = parseStatementList(value.body, `${path}/body`);
  if (!body.ok) return body;
  return success(
    Object.freeze({
      kind: "function",
      name: value.name,
      parameters: Object.freeze(parameters),
      returnType: value.returnType,
      body: body.node,
    }),
  );
}

function parseModule(value: unknown): NodeResult<GenStructuredModule> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["kind", "path", "constants", "functions"]) ||
    value.kind !== "module" ||
    !Array.isArray(value.path) ||
    value.path.length < 1 ||
    value.path.length > 8 ||
    !value.path.every(isGenIdentifier) ||
    !Array.isArray(value.constants) ||
    !Array.isArray(value.functions)
  ) {
    return failure("generation-input-invalid", "", "Module shape or logical path is invalid.");
  }
  const constants: GenConst[] = [];
  for (let index = 0; index < value.constants.length; index += 1) {
    const constant = parseConst(value.constants[index], `/constants/${index}`);
    if (!constant.ok) return constant;
    constants.push(constant.node);
  }
  const functions: GenStructuredFunction[] = [];
  for (let index = 0; index < value.functions.length; index += 1) {
    const fn = parseFunction(value.functions[index], `/functions/${index}`);
    if (!fn.ok) return fn;
    functions.push(fn.node);
  }
  return success(
    Object.freeze({
      kind: "module",
      path: Object.freeze([...value.path]),
      constants: Object.freeze(constants),
      functions: Object.freeze(functions),
    }),
  );
}

/**
 * Validates, defensively snapshots, and deeply freezes an independent generator module.
 *
 * @param input Unknown programmatic module input.
 * @returns A validated immutable module or stable diagnostics.
 *
 * @example
 * ```ts
 * const result = validateGeneratorIr({
 *   kind: "module",
 *   path: ["Example"],
 *   constants: [],
 *   functions: [],
 * });
 * ```
 */
function validateGeneratorIrStructure(
  input: unknown,
): IrValidationResult | StructuredIrValidationResult {
  try {
    const structuralFailure = inspectGeneratorInput(input, "", () => false);
    if (structuralFailure !== undefined) {
      return {
        ok: false,
        diagnostics: Object.freeze([
          diagnostic("generation-input-invalid", structuralFailure.path, structuralFailure.message),
        ]),
      };
    }
    const parsed = parseModule(input);
    if (!parsed.ok) {
      return { ok: false, diagnostics: Object.freeze([parsed.diagnostic]) };
    }
    return Object.freeze({ ok: true, module: parsed.node, diagnostics: EMPTY_DIAGNOSTICS });
  } catch {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          "generation-input-invalid",
          "",
          "Generator module could not be inspected safely.",
        ),
      ]),
    };
  }
}

/**
 * Validates and snapshots the data shape required by syntax-level generator consumers.
 *
 * This deliberately does not resolve names or enforce expression typing. Syntax round trips need
 * to preserve those facts without claiming that the module is semantically compilable.
 *
 * @param input Unknown programmatic module input.
 * @returns A structurally validated immutable module or stable diagnostics.
 */
export function validateGeneratorIrSyntax(input: unknown): IrValidationResult;
export function validateGeneratorIrSyntax(
  input: unknown,
): IrValidationResult | StructuredIrValidationResult {
  return validateGeneratorIrStructure(input);
}

/**
 * Closes unknown structured data without hiding its structured module type.
 *
 * @param input Unknown structured module input.
 * @returns A deeply frozen structured module or stable diagnostics.
 */
export function validateStructuredGeneratorIrSyntax(input: unknown): StructuredIrValidationResult {
  return validateGeneratorIrStructure(input);
}

/**
 * Validates, snapshots and deeply freezes a semantically well-formed generator module.
 *
 * @param input Unknown programmatic module input.
 * @returns A validated immutable module or stable diagnostics.
 *
 * @example
 * ```ts
 * const checked = validateGeneratorIr(module);
 * ```
 */
export function validateGeneratorIr(input: unknown): IrValidationResult;
export function validateGeneratorIr(
  input: unknown,
): IrValidationResult | StructuredIrValidationResult {
  const structural = validateGeneratorIrStructure(input);
  if (!structural.ok) {
    return structural;
  }
  try {
    const typeFailure = isLegacyModule(structural.module)
      ? validateLegacyModuleTypes(structural.module)
      : (() => {
          const failure = validateStructuredModuleSemantics(structural.module);
          return failure === undefined
            ? undefined
            : diagnostic(failure.code, failure.path, failure.message);
        })();
    if (typeFailure !== undefined) {
      return { ok: false, diagnostics: Object.freeze([typeFailure]) };
    }
    return structural;
  } catch {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          "generation-input-invalid",
          "",
          "Generator module could not be inspected safely.",
        ),
      ]),
    };
  }
}
