import type {
  GenConst,
  GenExpression,
  GenFunction,
  GenModule,
  GenParameter,
  GenStatement,
  GenerationDiagnostic,
  GenerationDiagnosticCode,
  IrValidationResult,
  ScalarType,
  BinaryOperator,
  UnaryOperator,
} from "./generator-ir.js";
import { isGenIdentifier, isScalarType } from "./generator-ir.js";

/** Structural failure found before an unknown generator input is read. */
export interface GeneratorInputFailure {
  readonly path: string;
  readonly message: string;
}

interface PendingValue {
  readonly kind: "value";
  readonly value: unknown;
  readonly path: string;
}

interface PendingLeave {
  readonly kind: "leave";
  readonly value: object;
}

type PendingTraversal = PendingValue | PendingLeave;

type NodeResult<T> =
  | { readonly ok: true; readonly node: T }
  | { readonly ok: false; readonly diagnostic: GenerationDiagnostic };

const MAX_GENERATOR_VALUES = 262_144;
const MAX_EXPRESSION_DEPTH = 1_024;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const UNARY_OPERATORS: ReadonlySet<string> = new Set(["-", "~", "!"]);
const BINARY_OPERATORS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(["==", "!=", "<", "<=", ">", ">="]);
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(["==", "!="]);
const SHIFT_OPERATORS: ReadonlySet<string> = new Set(["<<", ">>"]);

interface ScopeBinding {
  readonly kind: "constant" | "parameter" | "local";
  readonly type: ScalarType;
  readonly writable: boolean;
}

interface GeneratorScope {
  readonly localBindings: ReadonlyMap<string, ScopeBinding>;
  readonly constantBindings: ReadonlyMap<string, ScopeBinding>;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(path: string, key: string): string {
  return `${path}/${escapePointerSegment(key)}`;
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * Inspects generator data without invoking accessors or accepting exotic objects.
 *
 * @param value Root input value.
 * @param rootPath JSON-pointer path assigned to the root.
 * @param allowFunction Whether a callable capability is permitted at a path.
 * @returns The first unsafe structure, or `undefined` for a plain acyclic tree.
 *
 * @example
 * ```ts
 * inspectGeneratorInput({ kind: "module" }, "", () => false);
 * ```
 */
export function inspectGeneratorInput(
  value: unknown,
  rootPath: string,
  allowFunction: (path: string) => boolean,
): GeneratorInputFailure | undefined {
  const pending: PendingTraversal[] = [{ kind: "value", value, path: rootPath }];
  const ancestors = new WeakSet<object>();
  let visited = 0;
  let scheduled = 1;

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.kind === "leave") {
      ancestors.delete(current.value);
      continue;
    }
    visited += 1;
    if (visited > MAX_GENERATOR_VALUES) {
      return {
        path: current.path,
        message: "Generator input exceeds the traversal value limit.",
      };
    }

    const rawValue = current.value;
    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "bigint" ||
      typeof rawValue === "boolean"
    ) {
      continue;
    }
    if (typeof rawValue === "function") {
      if (allowFunction(current.path)) continue;
      return { path: current.path, message: "Functions are not permitted at this input path." };
    }
    if (typeof rawValue !== "object") {
      return { path: current.path, message: "Generator input contains a non-data value." };
    }

    const objectValue = rawValue;
    if (ancestors.has(objectValue)) {
      return { path: current.path, message: "Generator input must be an acyclic data tree." };
    }
    ancestors.add(objectValue);
    pending.push({ kind: "leave", value: objectValue });

    try {
      const prototype = Object.getPrototypeOf(objectValue);
      const isArray = Array.isArray(objectValue);
      if (
        (isArray && prototype !== Array.prototype) ||
        (!isArray && prototype !== Object.prototype && prototype !== null)
      ) {
        return {
          path: current.path,
          message: "Generator records and arrays must use plain prototypes.",
        };
      }

      let arrayLength: number | undefined;
      if (isArray) {
        const lengthDescriptor = Reflect.getOwnPropertyDescriptor(objectValue, "length");
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number"
        ) {
          return {
            path: current.path,
            message: "Generator array length must be an own data property.",
          };
        }
        arrayLength = lengthDescriptor.value;
        if (arrayLength > MAX_GENERATOR_VALUES - scheduled) {
          return {
            path: current.path,
            message: "Generator input exceeds the traversal value limit.",
          };
        }
      }

      const keys = Reflect.ownKeys(objectValue);
      if (keys.some((key) => typeof key !== "string")) {
        return { path: current.path, message: "Generator input must not contain symbols." };
      }
      const stringKeys = keys.filter((key): key is string => typeof key === "string");
      const childKeys = stringKeys.filter((key) => !(isArray && key === "length"));
      if (childKeys.length > MAX_GENERATOR_VALUES - scheduled) {
        return {
          path: current.path,
          message: "Generator input exceeds the traversal value limit.",
        };
      }
      scheduled += childKeys.length;

      if (isArray) {
        const elementKeys = childKeys;
        if (
          arrayLength === undefined ||
          elementKeys.length !== arrayLength ||
          elementKeys.some((key) => !isCanonicalArrayIndex(key, arrayLength))
        ) {
          return {
            path: current.path,
            message: "Generator arrays must be dense and unadorned.",
          };
        }
      }

      for (const key of childKeys) {
        const descriptor = Reflect.getOwnPropertyDescriptor(objectValue, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return {
            path: childPath(current.path, key),
            message: "Generator properties must be enumerable own data properties.",
          };
        }
        pending.push({
          kind: "value",
          value: descriptor.value,
          path: childPath(current.path, key),
        });
      }
    } catch {
      return {
        path: current.path,
        message: "Generator input structure could not be inspected safely.",
      };
    }
  }

  return undefined;
}

function diagnostic(
  code: GenerationDiagnosticCode,
  path: string,
  message: string,
): GenerationDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure<T>(code: GenerationDiagnosticCode, path: string, message: string): NodeResult<T> {
  return { ok: false, diagnostic: diagnostic(code, path, message) };
}

function success<T>(node: T): NodeResult<T> {
  return { ok: true, node };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isUnaryOperator(value: unknown): value is UnaryOperator {
  return typeof value === "string" && UNARY_OPERATORS.has(value);
}

function isBinaryOperator(value: unknown): value is BinaryOperator {
  return typeof value === "string" && BINARY_OPERATORS.has(value);
}

function parseExpression(value: unknown, path: string, depth: number): NodeResult<GenExpression> {
  if (depth > MAX_EXPRESSION_DEPTH) {
    return failure("generation-input-invalid", path, "Expression nesting exceeds the safe limit.");
  }
  if (!isRecord(value) || typeof value.kind !== "string") {
    return failure("generation-input-invalid", path, "Expression must be a closed record.");
  }

  if (value.kind === "literal") {
    if (
      !hasExactKeys(value, ["kind", "type", "value"]) ||
      !isScalarType(value.type) ||
      typeof value.value !== "bigint"
    ) {
      return failure("generation-input-invalid", path, "Literal expression shape is invalid.");
    }
    const range = scalarRange(value.type);
    if (value.value < range.minimum || value.value > range.maximum) {
      return failure(
        "generation-type-invalid",
        `${path}/value`,
        "Literal value lies outside its declared scalar type.",
      );
    }
    return success<GenExpression>(
      Object.freeze({ kind: "literal", type: value.type, value: value.value }),
    );
  }

  if (value.kind === "name") {
    if (
      !hasExactKeys(value, ["kind", "type", "name"]) ||
      !isScalarType(value.type) ||
      !isGenIdentifier(value.name)
    ) {
      return failure("generation-input-invalid", path, "Name expression shape is invalid.");
    }
    return success<GenExpression>(
      Object.freeze({ kind: "name", type: value.type, name: value.name }),
    );
  }

  if (value.kind === "unary") {
    if (
      !hasExactKeys(value, ["kind", "type", "operator", "operand"]) ||
      !isScalarType(value.type) ||
      !isUnaryOperator(value.operator)
    ) {
      return failure("generation-input-invalid", path, "Unary expression shape is invalid.");
    }
    const operand = parseExpression(value.operand, `${path}/operand`, depth + 1);
    if (!operand.ok) return operand;
    return success<GenExpression>(
      Object.freeze({
        kind: "unary",
        type: value.type,
        operator: value.operator,
        operand: operand.node,
      }),
    );
  }

  if (value.kind === "binary") {
    if (
      !hasExactKeys(value, ["kind", "type", "operator", "left", "right"]) ||
      !isScalarType(value.type) ||
      !isBinaryOperator(value.operator)
    ) {
      return failure("generation-input-invalid", path, "Binary expression shape is invalid.");
    }
    const left = parseExpression(value.left, `${path}/left`, depth + 1);
    if (!left.ok) return left;
    const right = parseExpression(value.right, `${path}/right`, depth + 1);
    if (!right.ok) return right;
    return success<GenExpression>(
      Object.freeze({
        kind: "binary",
        type: value.type,
        operator: value.operator,
        left: left.node,
        right: right.node,
      }),
    );
  }

  if (value.kind === "memory-read") {
    if (
      !hasExactKeys(value, ["kind", "type", "width", "address"]) ||
      (value.width !== 1 && value.width !== 2) ||
      (value.type !== "byte" && value.type !== "word") ||
      (value.width === 1 && value.type !== "byte") ||
      (value.width === 2 && value.type !== "word")
    ) {
      return failure("generation-type-invalid", path, "Memory-read width and type do not agree.");
    }
    const address = parseExpression(value.address, `${path}/address`, depth + 1);
    if (!address.ok) return address;
    return success<GenExpression>(
      Object.freeze({
        kind: "memory-read",
        type: value.type,
        width: value.width,
        address: address.node,
      }),
    );
  }

  return failure("generation-input-invalid", `${path}/kind`, "Expression kind is not supported.");
}

function parseStatement(value: unknown, path: string): NodeResult<GenStatement> {
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
    return success<GenStatement>(
      Object.freeze({
        kind: "local",
        name: value.name,
        type: value.type,
        initializer: initializer.node,
      }),
    );
  }
  if (value.kind === "assign") {
    if (!hasExactKeys(value, ["kind", "target", "value"]) || !isGenIdentifier(value.target)) {
      return failure("generation-input-invalid", path, "Assignment shape is invalid.");
    }
    const expression = parseExpression(value.value, `${path}/value`, 1);
    if (!expression.ok) return expression;
    return success<GenStatement>(
      Object.freeze({ kind: "assign", target: value.target, value: expression.node }),
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
    return success<GenStatement>(
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
      return success<GenStatement>(Object.freeze({ kind: "return" }));
    }
    const expression = parseExpression(value.value, `${path}/value`, 1);
    if (!expression.ok) return expression;
    return success<GenStatement>(Object.freeze({ kind: "return", value: expression.node }));
  }
  return failure("generation-input-invalid", `${path}/kind`, "Statement kind is not supported.");
}

function parseParameter(value: unknown, path: string): NodeResult<GenParameter> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["name", "type"]) ||
    !isGenIdentifier(value.name) ||
    !isScalarType(value.type)
  ) {
    return failure("generation-input-invalid", path, "Parameter shape is invalid.");
  }
  return success(Object.freeze({ name: value.name, type: value.type }));
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
  return success(
    Object.freeze({
      kind: "const",
      name: value.name,
      type: value.type,
      value: expression.node,
    }),
  );
}

function parseFunction(value: unknown, path: string): NodeResult<GenFunction> {
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
  const parameters: GenParameter[] = [];
  for (let index = 0; index < value.parameters.length; index += 1) {
    const parameter = parseParameter(value.parameters[index], `${path}/parameters/${index}`);
    if (!parameter.ok) return parameter;
    parameters.push(parameter.node);
  }
  const body: GenStatement[] = [];
  for (let index = 0; index < value.body.length; index += 1) {
    const statement = parseStatement(value.body[index], `${path}/body/${index}`);
    if (!statement.ok) return statement;
    body.push(statement.node);
  }
  return success(
    Object.freeze({
      kind: "function",
      name: value.name,
      parameters: Object.freeze(parameters),
      returnType: value.returnType,
      body: Object.freeze(body),
    }),
  );
}

function parseModule(value: unknown): NodeResult<GenModule> {
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
  const functions: GenFunction[] = [];
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

function scalarRange(type: ScalarType): { readonly minimum: bigint; readonly maximum: bigint } {
  switch (type) {
    case "boolean":
      return { minimum: 0n, maximum: 1n };
    case "byte":
      return { minimum: 0n, maximum: 255n };
    case "sbyte":
      return { minimum: -128n, maximum: 127n };
    case "word":
      return { minimum: 0n, maximum: 65_535n };
    case "sword":
      return { minimum: -32_768n, maximum: 32_767n };
  }
}

function isIntegerType(type: ScalarType): boolean {
  return type !== "boolean";
}

function isUnsignedIntegerType(type: ScalarType): boolean {
  return type === "byte" || type === "word";
}

function isSignedIntegerType(type: ScalarType): boolean {
  return type === "sbyte" || type === "sword";
}

function integerWidth(type: ScalarType): 8 | 16 {
  return type === "byte" || type === "sbyte" ? 8 : 16;
}

function promotedIntegerType(left: ScalarType, right: ScalarType): ScalarType | undefined {
  if (!isIntegerType(left) || !isIntegerType(right)) return undefined;
  const bothSigned = isSignedIntegerType(left) && isSignedIntegerType(right);
  const bothUnsigned = isUnsignedIntegerType(left) && isUnsignedIntegerType(right);
  if (!bothSigned && !bothUnsigned) return undefined;
  const width = Math.max(integerWidth(left), integerWidth(right));
  if (bothSigned) return width === 8 ? "sbyte" : "sword";
  return width === 8 ? "byte" : "word";
}

function lookupBinding(scope: GeneratorScope, name: string): ScopeBinding | undefined {
  return scope.localBindings.get(name) ?? scope.constantBindings.get(name);
}

function validateExpressionType(
  expression: GenExpression,
  scope: GeneratorScope,
  path: string,
): GenerationDiagnostic | undefined {
  if (expression.kind === "name") {
    const binding = lookupBinding(scope, expression.name);
    if (binding === undefined || binding.type !== expression.type) {
      return diagnostic(
        "generation-type-invalid",
        `${path}/name`,
        "Name expression does not match a visible declaration of the same type.",
      );
    }
    return undefined;
  }
  if (expression.kind === "unary") {
    const operandFailure = validateExpressionType(expression.operand, scope, `${path}/operand`);
    if (operandFailure !== undefined) return operandFailure;
    const valid =
      expression.operator === "!"
        ? expression.type === "boolean" && expression.operand.type === "boolean"
        : expression.operator === "-"
          ? isSignedIntegerType(expression.operand.type) &&
            expression.type === expression.operand.type
          : isIntegerType(expression.operand.type) && expression.type === expression.operand.type;
    return valid
      ? undefined
      : diagnostic(
          "generation-type-invalid",
          `${path}/type`,
          "Unary expression operands and result type are inconsistent.",
        );
  }
  if (expression.kind === "binary") {
    const leftFailure = validateExpressionType(expression.left, scope, `${path}/left`);
    if (leftFailure !== undefined) return leftFailure;
    const rightFailure = validateExpressionType(expression.right, scope, `${path}/right`);
    if (rightFailure !== undefined) return rightFailure;
    const isComparison = COMPARISON_OPERATORS.has(expression.operator);
    const isShift = SHIFT_OPERATORS.has(expression.operator);
    const promotedType = promotedIntegerType(expression.left.type, expression.right.type);
    const valid = isShift
      ? isIntegerType(expression.left.type) &&
        isUnsignedIntegerType(expression.right.type) &&
        expression.type === expression.left.type
      : isComparison
        ? expression.type === "boolean" &&
          ((EQUALITY_OPERATORS.has(expression.operator) &&
            expression.left.type === "boolean" &&
            expression.right.type === "boolean") ||
            promotedType !== undefined)
        : promotedType !== undefined && expression.type === promotedType;
    return valid
      ? undefined
      : diagnostic(
          "generation-type-invalid",
          `${path}/type`,
          "Binary expression operands and result type are inconsistent.",
        );
  }
  if (expression.kind === "memory-read") {
    const addressFailure = validateExpressionType(expression.address, scope, `${path}/address`);
    if (addressFailure !== undefined) return addressFailure;
    if (expression.address.type !== "word") {
      return diagnostic(
        "generation-type-invalid",
        `${path}/address/type`,
        "Memory addresses must have word type.",
      );
    }
  }
  return undefined;
}

function validateModuleTypes(module: GenModule): GenerationDiagnostic | undefined {
  const moduleNames = new Set<string>();
  const constantBindings = new Map<string, ScopeBinding>();
  for (let index = 0; index < module.constants.length; index += 1) {
    const constant = module.constants[index];
    if (moduleNames.has(constant.name)) {
      return diagnostic(
        "generation-type-invalid",
        `/constants/${index}/name`,
        "Module declaration names must be unique.",
      );
    }
    moduleNames.add(constant.name);
    constantBindings.set(
      constant.name,
      Object.freeze({ kind: "constant", type: constant.type, writable: false }),
    );
  }
  for (let index = 0; index < module.functions.length; index += 1) {
    const fn = module.functions[index];
    if (moduleNames.has(fn.name)) {
      return diagnostic(
        "generation-type-invalid",
        `/functions/${index}/name`,
        "Module declaration names must be unique.",
      );
    }
    moduleNames.add(fn.name);
  }

  const constantScope: GeneratorScope = {
    localBindings: new Map(),
    constantBindings,
  };
  for (let index = 0; index < module.constants.length; index += 1) {
    const constant = module.constants[index];
    const valueFailure = validateExpressionType(
      constant.value,
      constantScope,
      `/constants/${index}/value`,
    );
    if (valueFailure !== undefined) return valueFailure;
    if (constant.value.type !== constant.type) {
      return diagnostic(
        "generation-type-invalid",
        `/constants/${index}/type`,
        "Constant value does not match its declared type.",
      );
    }
  }

  for (let functionIndex = 0; functionIndex < module.functions.length; functionIndex += 1) {
    const fn = module.functions[functionIndex];
    const functionPath = `/functions/${functionIndex}`;
    const localBindings = new Map<string, ScopeBinding>();
    const scope: GeneratorScope = { localBindings, constantBindings };
    for (let parameterIndex = 0; parameterIndex < fn.parameters.length; parameterIndex += 1) {
      const parameter = fn.parameters[parameterIndex];
      if (lookupBinding(scope, parameter.name) !== undefined) {
        return diagnostic(
          "generation-type-invalid",
          `${functionPath}/parameters/${parameterIndex}/name`,
          "Parameter names must be unique in their function scope.",
        );
      }
      localBindings.set(
        parameter.name,
        Object.freeze({ kind: "parameter", type: parameter.type, writable: true }),
      );
    }

    let terminated = false;
    for (let statementIndex = 0; statementIndex < fn.body.length; statementIndex += 1) {
      const statement = fn.body[statementIndex];
      const statementPath = `${functionPath}/body/${statementIndex}`;
      if (terminated) {
        return diagnostic(
          "generation-type-invalid",
          statementPath,
          "Statements after a terminal return are outside the generator IR contract.",
        );
      }
      if (statement.kind === "local") {
        if (lookupBinding(scope, statement.name) !== undefined) {
          return diagnostic(
            "generation-type-invalid",
            `${statementPath}/name`,
            "Local names must be unique in their function scope.",
          );
        }
        const initializerFailure = validateExpressionType(
          statement.initializer,
          scope,
          `${statementPath}/initializer`,
        );
        if (initializerFailure !== undefined) return initializerFailure;
        if (statement.initializer.type !== statement.type) {
          return diagnostic(
            "generation-type-invalid",
            `${statementPath}/type`,
            "Local initializer does not match its declared type.",
          );
        }
        localBindings.set(
          statement.name,
          Object.freeze({ kind: "local", type: statement.type, writable: true }),
        );
      } else if (statement.kind === "assign") {
        const valueFailure = validateExpressionType(
          statement.value,
          scope,
          `${statementPath}/value`,
        );
        if (valueFailure !== undefined) return valueFailure;
        const binding = lookupBinding(scope, statement.target);
        if (binding === undefined || !binding.writable || binding.type !== statement.value.type) {
          return diagnostic(
            "generation-type-invalid",
            `${statementPath}/target`,
            "Assignment target must be a writable local or parameter of the value type.",
          );
        }
      } else if (statement.kind === "memory-write") {
        const addressFailure = validateExpressionType(
          statement.address,
          scope,
          `${statementPath}/address`,
        );
        if (addressFailure !== undefined) return addressFailure;
        const valueFailure = validateExpressionType(
          statement.value,
          scope,
          `${statementPath}/value`,
        );
        if (valueFailure !== undefined) return valueFailure;
        const expectedValueType = statement.width === 1 ? "byte" : "word";
        if (statement.address.type !== "word" || statement.value.type !== expectedValueType) {
          return diagnostic(
            "generation-type-invalid",
            statement.address.type !== "word"
              ? `${statementPath}/address/type`
              : `${statementPath}/value/type`,
            "Memory-write operands do not match the selected width.",
          );
        }
      } else if (statement.value === undefined) {
        if (fn.returnType !== "void") {
          return diagnostic(
            "generation-type-invalid",
            statementPath,
            "A scalar-returning function must return a value.",
          );
        }
        terminated = true;
      } else {
        const returnFailure = validateExpressionType(
          statement.value,
          scope,
          `${statementPath}/value`,
        );
        if (returnFailure !== undefined) return returnFailure;
        if (fn.returnType === "void" || statement.value.type !== fn.returnType) {
          return diagnostic(
            "generation-type-invalid",
            `${statementPath}/value/type`,
            "Return value does not match the function return type.",
          );
        }
        terminated = true;
      }
    }
    if (fn.returnType !== "void" && !terminated) {
      return diagnostic(
        "generation-type-invalid",
        `${functionPath}/body`,
        "A scalar-returning function requires a matching terminal value return.",
      );
    }
  }
  return undefined;
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
export function validateGeneratorIr(input: unknown): IrValidationResult {
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
    const typeFailure = validateModuleTypes(parsed.node);
    if (typeFailure !== undefined) {
      return { ok: false, diagnostics: Object.freeze([typeFailure]) };
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
