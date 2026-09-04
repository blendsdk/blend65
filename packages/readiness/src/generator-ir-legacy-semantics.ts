import type {
  GenExpression,
  GenModule,
  GenStatement,
  GenStructuredExpression,
  GenStructuredModule,
  GenStructuredStatement,
  GenerationDiagnostic,
  ScalarType,
} from "./generator-ir.js";
import { generatorDiagnostic } from "./generator-ir-parser-common.js";
import {
  isStructuredIntegerType,
  isStructuredSignedIntegerType,
  isStructuredUnsignedIntegerType,
  promotedStructuredIntegerType,
} from "./structured-ir-semantic-types.js";

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
      return generatorDiagnostic(
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
          ? isStructuredSignedIntegerType(expression.operand.type) &&
            expression.type === expression.operand.type
          : isStructuredIntegerType(expression.operand.type) &&
            expression.type === expression.operand.type;
    return valid
      ? undefined
      : generatorDiagnostic(
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
    const promotedType = promotedStructuredIntegerType(expression.left.type, expression.right.type);
    const valid = isShift
      ? isStructuredIntegerType(expression.left.type) &&
        isStructuredUnsignedIntegerType(expression.right.type) &&
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
      : generatorDiagnostic(
          "generation-type-invalid",
          `${path}/type`,
          "Binary expression operands and result type are inconsistent.",
        );
  }
  if (expression.kind === "memory-read") {
    const addressFailure = validateExpressionType(expression.address, scope, `${path}/address`);
    if (addressFailure !== undefined) return addressFailure;
    if (expression.address.type !== "word") {
      return generatorDiagnostic(
        "generation-type-invalid",
        `${path}/address/type`,
        "Memory addresses must have word type.",
      );
    }
  }
  return undefined;
}

/** Validates the historical scalar-only module type and name rules. */
export function validateLegacyModuleTypes(module: GenModule): GenerationDiagnostic | undefined {
  const moduleNames = new Set<string>();
  const constantBindings = new Map<string, ScopeBinding>();
  for (let index = 0; index < module.constants.length; index += 1) {
    const constant = module.constants[index]!;
    if (moduleNames.has(constant.name)) {
      return generatorDiagnostic(
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
    const fn = module.functions[index]!;
    if (moduleNames.has(fn.name)) {
      return generatorDiagnostic(
        "generation-type-invalid",
        `/functions/${index}/name`,
        "Module declaration names must be unique.",
      );
    }
    moduleNames.add(fn.name);
  }

  const constantScope: GeneratorScope = { localBindings: new Map(), constantBindings };
  for (let index = 0; index < module.constants.length; index += 1) {
    const constant = module.constants[index]!;
    const valueFailure = validateExpressionType(
      constant.value,
      constantScope,
      `/constants/${index}/value`,
    );
    if (valueFailure !== undefined) return valueFailure;
    if (constant.value.type !== constant.type) {
      return generatorDiagnostic(
        "generation-type-invalid",
        `/constants/${index}/type`,
        "Constant value does not match its declared type.",
      );
    }
  }

  for (let functionIndex = 0; functionIndex < module.functions.length; functionIndex += 1) {
    const fn = module.functions[functionIndex]!;
    const functionPath = `/functions/${functionIndex}`;
    const localBindings = new Map<string, ScopeBinding>();
    const scope: GeneratorScope = { localBindings, constantBindings };
    for (let parameterIndex = 0; parameterIndex < fn.parameters.length; parameterIndex += 1) {
      const parameter = fn.parameters[parameterIndex]!;
      if ("kind" in parameter) {
        return generatorDiagnostic(
          "generation-invariant",
          `${functionPath}/parameters/${parameterIndex}`,
          "Structured parameters require structured semantic validation.",
        );
      }
      if (lookupBinding(scope, parameter.name) !== undefined) {
        return generatorDiagnostic(
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
      const statement = fn.body[statementIndex]!;
      const statementPath = `${functionPath}/body/${statementIndex}`;
      if (terminated) {
        return generatorDiagnostic(
          "generation-type-invalid",
          statementPath,
          "Statements after a terminal return are outside the generator IR contract.",
        );
      }
      if (statement.kind === "local") {
        if (lookupBinding(scope, statement.name) !== undefined) {
          return generatorDiagnostic(
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
          return generatorDiagnostic(
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
        if (typeof statement.target !== "string") {
          return generatorDiagnostic(
            "generation-invariant",
            `${statementPath}/target`,
            "Structured assignment requires structured semantic validation.",
          );
        }
        const binding = lookupBinding(scope, statement.target);
        if (binding === undefined || !binding.writable || binding.type !== statement.value.type) {
          return generatorDiagnostic(
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
          return generatorDiagnostic(
            "generation-type-invalid",
            statement.address.type !== "word"
              ? `${statementPath}/address/type`
              : `${statementPath}/value/type`,
            "Memory-write operands do not match the selected width.",
          );
        }
      } else if (statement.kind === "return" && statement.value === undefined) {
        if (fn.returnType !== "void") {
          return generatorDiagnostic(
            "generation-type-invalid",
            statementPath,
            "A scalar-returning function must return a value.",
          );
        }
        terminated = true;
      } else if (statement.kind === "return") {
        const returnValue = statement.value;
        if (returnValue === undefined) {
          return generatorDiagnostic(
            "generation-invariant",
            statementPath,
            "Return value disappeared during validation.",
          );
        }
        const returnFailure = validateExpressionType(returnValue, scope, `${statementPath}/value`);
        if (returnFailure !== undefined) return returnFailure;
        if (fn.returnType === "void" || returnValue.type !== fn.returnType) {
          return generatorDiagnostic(
            "generation-type-invalid",
            `${statementPath}/value/type`,
            "Return value does not match the function return type.",
          );
        }
        terminated = true;
      }
    }
    if (fn.returnType !== "void" && !terminated) {
      return generatorDiagnostic(
        "generation-type-invalid",
        `${functionPath}/body`,
        "A scalar-returning function requires a matching terminal value return.",
      );
    }
  }
  return undefined;
}

/** Returns whether a structured expression belongs to the historical scalar-only subset. */
export function isLegacyExpression(
  expression: GenStructuredExpression,
): expression is GenExpression {
  if (expression.kind === "index" || expression.kind === "call") return false;
  if (expression.kind === "unary") return isLegacyExpression(expression.operand);
  if (expression.kind === "binary") {
    return isLegacyExpression(expression.left) && isLegacyExpression(expression.right);
  }
  return expression.kind !== "memory-read" || isLegacyExpression(expression.address);
}

function isLegacyStatement(statement: GenStructuredStatement): statement is GenStatement {
  if (
    statement.kind === "array" ||
    statement.kind === "call-statement" ||
    statement.kind === "if" ||
    statement.kind === "while" ||
    statement.kind === "do-while" ||
    statement.kind === "for"
  ) {
    return false;
  }
  if (statement.kind === "local") return isLegacyExpression(statement.initializer);
  if (statement.kind === "assign") {
    return typeof statement.target === "string" && isLegacyExpression(statement.value);
  }
  if (statement.kind === "memory-write") {
    return isLegacyExpression(statement.address) && isLegacyExpression(statement.value);
  }
  return statement.value === undefined || isLegacyExpression(statement.value);
}

/** Returns whether a structured module belongs to the historical scalar-only subset. */
export function isLegacyModule(module: GenStructuredModule): module is GenModule {
  return module.functions.every(
    (fn) =>
      fn.parameters.every((parameter) => !("kind" in parameter)) &&
      fn.body.every(isLegacyStatement),
  );
}
