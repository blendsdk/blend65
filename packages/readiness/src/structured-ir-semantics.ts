import type {
  GenArrayReferenceExpression,
  GenArrayType,
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredParameter,
  GenStructuredStatement,
  ScalarType,
  StructuredGenerationBudgetV2,
} from "./generator-ir.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";
import {
  evaluateStructuredModuleConstants,
  structuredConstantZeroDivisorFailure,
  type StructuredCompileTimeValue,
} from "./structured-constant-evaluator.js";
import { validateStructuredArrayIndex } from "./structured-ir-array-semantics.js";
import { structuredBodyReturns, structuredCallCycleFailure } from "./structured-ir-call-graph.js";
import {
  structuredConditionFailure,
  structuredNameConflict,
  structuredTypeFailure,
} from "./structured-ir-semantic-diagnostics.js";
import {
  isStructuredIntegerType,
  isStructuredSignedIntegerType,
  isStructuredTypeCompatible,
  isStructuredUnsignedIntegerType,
  promotedStructuredIntegerType,
  structuredScalarParameterType,
} from "./structured-ir-semantic-types.js";

interface ScalarBinding {
  readonly kind: "scalar";
  readonly type: ScalarType;
  readonly writable: boolean;
  readonly role?: "constant" | "loop-counter";
}

interface ArrayBinding {
  readonly kind: "array";
  readonly type: GenArrayType;
}

type StructuredBinding = ScalarBinding | ArrayBinding;

interface ValidationContext {
  readonly functions: ReadonlyMap<string, GenStructuredFunction>;
  readonly scope: Map<string, StructuredBinding>;
  readonly reservedNames: ReadonlySet<string>;
  readonly returnType: ScalarType | "void";
  readonly constants: ReadonlyMap<string, StructuredCompileTimeValue>;
}

const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(["==", "!=", "<", "<=", ">", ">="]);
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(["==", "!="]);
const SHIFT_OPERATORS: ReadonlySet<string> = new Set(["<<", ">>"]);

function validateUnaryExpression(
  expression: Extract<GenStructuredExpression, { readonly kind: "unary" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const operandFailure = validateExpression(expression.operand, `${path}/operand`, context);
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
    : structuredTypeFailure(
        `${path}/type`,
        "Unary expression operands and result type are inconsistent.",
      );
}

function validateBinaryExpression(
  expression: Extract<GenStructuredExpression, { readonly kind: "binary" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const leftFailure = validateExpression(expression.left, `${path}/left`, context);
  if (leftFailure !== undefined) return leftFailure;
  const rightFailure = validateExpression(expression.right, `${path}/right`, context);
  if (rightFailure !== undefined) return rightFailure;
  const promoted = promotedStructuredIntegerType(expression.left.type, expression.right.type);
  const valid = SHIFT_OPERATORS.has(expression.operator)
    ? isStructuredIntegerType(expression.left.type) &&
      isStructuredUnsignedIntegerType(expression.right.type) &&
      expression.type === expression.left.type
    : COMPARISON_OPERATORS.has(expression.operator)
      ? expression.type === "boolean" &&
        ((EQUALITY_OPERATORS.has(expression.operator) &&
          expression.left.type === "boolean" &&
          expression.right.type === "boolean") ||
          promoted !== undefined)
      : promoted !== undefined && expression.type === promoted;
  return valid
    ? structuredConstantZeroDivisorFailure(expression, path, context.constants)
    : structuredTypeFailure(
        `${path}/type`,
        "Binary expression operands and result type are inconsistent.",
      );
}

function validateIndexExpression(
  expression: Extract<GenStructuredExpression, { readonly kind: "index" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const binding = context.scope.get(expression.target);
  if (binding?.kind !== "array" || binding.type.elementType !== expression.type) {
    return structuredTypeFailure(
      `${path}/target`,
      "Index target does not resolve to an array of the result type.",
    );
  }
  const indexFailure = validateExpression(expression.index, `${path}/index`, context);
  if (indexFailure !== undefined) return indexFailure;
  if (!isStructuredUnsignedIntegerType(expression.index.type)) {
    return structuredTypeFailure(`${path}/index`, "Array indices require byte or word type.");
  }
  return validateStructuredArrayIndex(
    binding.type,
    expression.index,
    `${path}/index`,
    context.constants,
  );
}

function validateExpression(
  expression: GenStructuredExpression,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  if (expression.kind === "literal") return undefined;
  if (expression.kind === "name") {
    const binding = context.scope.get(expression.name);
    return binding?.kind === "scalar" && binding.type === expression.type
      ? undefined
      : structuredTypeFailure(
          `${path}/name`,
          "Name does not resolve to a visible scalar of the declared type.",
          "name-unresolved",
        );
  }
  if (expression.kind === "unary") return validateUnaryExpression(expression, path, context);
  if (expression.kind === "binary") return validateBinaryExpression(expression, path, context);
  if (expression.kind === "memory-read") {
    const addressFailure = validateExpression(expression.address, `${path}/address`, context);
    if (addressFailure !== undefined) return addressFailure;
    const expectedType = expression.width === 1 ? "byte" : "word";
    return expression.address.type === "word" && expression.type === expectedType
      ? undefined
      : structuredTypeFailure(
          expression.address.type === "word" ? `${path}/type` : `${path}/address/type`,
          "Memory-read operands do not match the selected width.",
          "memory-operand-type-mismatch",
        );
  }
  if (expression.kind === "index") return validateIndexExpression(expression, path, context);
  return validateCall(expression.callee, expression.arguments, expression.type, path, context);
}

function validateArrayArgument(
  parameter: Extract<GenStructuredParameter, { readonly kind: "array-parameter" }>,
  argument: GenArrayReferenceExpression,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const binding = context.scope.get(argument.name);
  if (binding?.kind !== "array") {
    return structuredTypeFailure(
      path,
      "Array argument does not resolve to caller storage.",
      "name-unresolved",
    );
  }
  if (
    binding.type.elementType !== argument.type.elementType ||
    binding.type.extent !== argument.type.extent ||
    (binding.type.access === "const" && argument.type.access !== "const")
  ) {
    return structuredTypeFailure(
      path,
      "Array-reference type does not match its caller storage.",
      "call-argument-type-mismatch",
    );
  }
  if (argument.type.elementType !== parameter.type.elementType) {
    return structuredDiagnostic(
      "generation-type-invalid",
      "array-parameter-element-mismatch",
      path,
      "Array element type does not match its parameter.",
      { diagnosticFamily: "array-parameter-element-type" },
    );
  }
  if (parameter.type.extent !== null && argument.type.extent !== parameter.type.extent) {
    return structuredDiagnostic(
      "generation-type-invalid",
      "array-parameter-extent-mismatch",
      path,
      "Array extent does not match its fixed parameter extent.",
      { diagnosticFamily: "array-parameter-fixed-extent" },
    );
  }
  if (parameter.type.access === "mutable" && argument.type.access !== "mutable") {
    return structuredDiagnostic(
      "generation-type-invalid",
      "array-parameter-access-mismatch",
      path,
      "A const array cannot bind to a mutable parameter.",
      {
        diagnosticFamily: "const-array-to-mutable-parameter",
        expectedCompilerDiagnosticCode: "E10122",
      },
    );
  }
  return undefined;
}

function validateCall(
  callee: string,
  argumentsValue: readonly (GenStructuredExpression | GenArrayReferenceExpression)[],
  expectedReturnType: ScalarType | "void",
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const fn = context.functions.get(callee);
  if (fn === undefined || fn.returnType !== expectedReturnType) {
    return structuredDiagnostic(
      "generation-input-invalid",
      "call-context-invalid",
      path,
      "Call is used in the wrong scalar or void context.",
    );
  }
  if (argumentsValue.length !== fn.parameters.length) {
    return structuredDiagnostic(
      "generation-type-invalid",
      "call-arity-mismatch",
      `${path}/arguments`,
      "Call argument count does not match its function.",
    );
  }
  for (let index = 0; index < fn.parameters.length; index += 1) {
    const parameter = fn.parameters[index];
    const argument = argumentsValue[index];
    if (parameter === undefined || argument === undefined) continue;
    const argumentPath = `${path}/arguments/${index}`;
    const scalarType = structuredScalarParameterType(parameter);
    if (scalarType !== undefined) {
      if (
        argument.kind === "array-reference" ||
        !isStructuredTypeCompatible(scalarType, argument.type)
      ) {
        return structuredTypeFailure(
          argumentPath,
          "Scalar call argument type does not match its parameter.",
          "call-argument-type-mismatch",
        );
      }
      const failure = validateExpression(argument, argumentPath, context);
      if (failure !== undefined) return failure;
      continue;
    }
    if (
      argument.kind !== "array-reference" ||
      !("kind" in parameter) ||
      parameter.kind !== "array-parameter"
    ) {
      return structuredTypeFailure(
        argumentPath,
        "Array parameter requires one array reference.",
        "call-argument-type-mismatch",
      );
    }
    const failure = validateArrayArgument(parameter, argument, argumentPath, context);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function validateStatementList(
  body: readonly GenStructuredStatement[],
  path: string,
  context: ValidationContext,
  depth: number,
  budget: StructuredGenerationBudgetV2 | undefined,
): StructuredGenerationDiagnosticV2 | undefined {
  for (let index = 0; index < body.length; index += 1) {
    const statementPath = `${path}/${index}`;
    if (budget !== undefined && depth > budget.maxStatementDepth) {
      return structuredDiagnostic(
        "generation-budget",
        "statement-depth-exceeded",
        statementPath,
        "Statement nesting exceeds the structured budget.",
        { dimension: "statement-depth" },
      );
    }
    const failure = validateStatement(body[index]!, statementPath, context, depth, budget);
    if (failure !== undefined) return failure;
  }
  return undefined;
}

function validateLocalStatement(
  statement: Extract<GenStructuredStatement, { readonly kind: "local" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const nameFailure = structuredNameConflict(
    `${path}/name`,
    context.scope.has(statement.name) || context.reservedNames.has(statement.name),
  );
  if (nameFailure !== undefined) return nameFailure;
  const valueFailure = validateExpression(statement.initializer, `${path}/initializer`, context);
  if (valueFailure !== undefined) return valueFailure;
  if (!isStructuredTypeCompatible(statement.type, statement.initializer.type)) {
    return structuredTypeFailure(
      `${path}/type`,
      "Local initializer does not match its declared type.",
      "initializer-type-mismatch",
    );
  }
  context.scope.set(statement.name, { kind: "scalar", type: statement.type, writable: true });
  return undefined;
}

function validateArrayStatement(
  statement: Extract<GenStructuredStatement, { readonly kind: "array" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const nameFailure = structuredNameConflict(
    `${path}/name`,
    context.scope.has(statement.name) || context.reservedNames.has(statement.name),
  );
  if (nameFailure !== undefined) return nameFailure;
  if (statement.initializer.length > statement.extent) {
    return structuredTypeFailure(
      `${path}/initializer`,
      "Array initializer contains more elements than the declared extent.",
      "initializer-type-mismatch",
    );
  }
  for (let index = 0; index < statement.initializer.length; index += 1) {
    const item = statement.initializer[index]!;
    const itemPath = `${path}/initializer/${index}`;
    const failure = validateExpression(item, itemPath, context);
    if (failure !== undefined) return failure;
    if (item.type !== statement.elementType) {
      return structuredTypeFailure(
        itemPath,
        "Array initializer element type does not match its declaration.",
        "initializer-type-mismatch",
      );
    }
  }
  context.scope.set(statement.name, {
    kind: "array",
    type: {
      kind: "array-type",
      elementType: statement.elementType,
      extent: statement.extent,
      access: "mutable",
    },
  });
  return undefined;
}

function validateAssignmentStatement(
  statement: Extract<GenStructuredStatement, { readonly kind: "assign" }>,
  path: string,
  context: ValidationContext,
): StructuredGenerationDiagnosticV2 | undefined {
  const valueFailure = validateExpression(statement.value, `${path}/value`, context);
  if (valueFailure !== undefined) return valueFailure;
  if (typeof statement.target === "string") {
    const binding = context.scope.get(statement.target);
    if (binding?.kind === "scalar" && binding.role === "loop-counter") {
      return structuredTypeFailure(
        `${path}/target`,
        "Loop counters are read-only inside their body.",
        "loop-counter-read-only",
      );
    }
    return binding?.kind === "scalar" &&
      binding.writable &&
      isStructuredTypeCompatible(binding.type, statement.value.type)
      ? undefined
      : structuredTypeFailure(
          `${path}/target`,
          "Assignment target is not a writable scalar of the value type.",
          "assignment-type-mismatch",
        );
  }
  const binding = context.scope.get(statement.target.target);
  if (binding?.kind !== "array" || binding.type.access !== "mutable") {
    return structuredDiagnostic(
      "generation-type-invalid",
      "array-const-write",
      `${path}/target`,
      "Const array storage cannot be written.",
      {
        diagnosticFamily: "const-array-parameter-write",
        expectedCompilerDiagnosticCode: "E10123",
      },
    );
  }
  if (!isStructuredTypeCompatible(statement.target.type, statement.value.type)) {
    return structuredTypeFailure(
      `${path}/target/type`,
      "Indexed assignment value type does not match.",
      "assignment-type-mismatch",
    );
  }
  return validateIndexExpression(
    {
      kind: "index",
      type: statement.target.type,
      target: statement.target.target,
      index: statement.target.index,
    },
    `${path}/target`,
    context,
  );
}

function validateControlFlowStatement(
  statement: Extract<GenStructuredStatement, { readonly kind: "if" | "while" | "do-while" }>,
  path: string,
  context: ValidationContext,
  depth: number,
  budget: StructuredGenerationBudgetV2 | undefined,
): StructuredGenerationDiagnosticV2 | undefined {
  if (statement.condition.type !== "boolean") {
    return structuredConditionFailure(`${path}/condition`);
  }
  const condition = validateExpression(statement.condition, `${path}/condition`, context);
  if (condition !== undefined) return condition;
  if (statement.kind === "if") {
    return (
      validateStatementList(
        statement.thenBody,
        `${path}/thenBody`,
        { ...context, scope: new Map(context.scope) },
        depth + 1,
        budget,
      ) ??
      validateStatementList(
        statement.elseBody,
        `${path}/elseBody`,
        { ...context, scope: new Map(context.scope) },
        depth + 1,
        budget,
      )
    );
  }
  return validateStatementList(
    statement.body,
    `${path}/body`,
    { ...context, scope: new Map(context.scope) },
    depth + 1,
    budget,
  );
}

function validateForStatement(
  statement: Extract<GenStructuredStatement, { readonly kind: "for" }>,
  path: string,
  context: ValidationContext,
  depth: number,
  budget: StructuredGenerationBudgetV2 | undefined,
): StructuredGenerationDiagnosticV2 | undefined {
  if (statement.step <= 0n) {
    return structuredDiagnostic(
      "generation-type-invalid",
      "loop-step-invalid",
      `${path}/step`,
      "Loop steps must be positive compile-time integers.",
      { diagnosticFamily: "loop-step-positive", expectedCompilerDiagnosticCode: "E10061" },
    );
  }
  if (
    statement.start.type !== statement.counterType ||
    statement.end.type !== statement.counterType
  ) {
    return structuredDiagnostic(
      "generation-type-invalid",
      "loop-bound-out-of-range",
      `${path}/end`,
      "Loop bounds must match the counter type.",
      { diagnosticFamily: "loop-bound-in-counter-range", expectedCompilerDiagnosticCode: "E10064" },
    );
  }
  const start = validateExpression(statement.start, `${path}/start`, context);
  if (start !== undefined) return start;
  const end = validateExpression(statement.end, `${path}/end`, context);
  if (end !== undefined) return end;
  const nameFailure = structuredNameConflict(
    `${path}/counter`,
    context.scope.has(statement.counter) || context.reservedNames.has(statement.counter),
  );
  if (nameFailure !== undefined) return nameFailure;
  const loopScope = new Map(context.scope);
  loopScope.set(statement.counter, {
    kind: "scalar",
    type: statement.counterType,
    writable: false,
    role: "loop-counter",
  });
  return validateStatementList(
    statement.body,
    `${path}/body`,
    { ...context, scope: loopScope },
    depth + 1,
    budget,
  );
}

function validateStatement(
  statement: GenStructuredStatement,
  path: string,
  context: ValidationContext,
  depth: number,
  budget: StructuredGenerationBudgetV2 | undefined,
): StructuredGenerationDiagnosticV2 | undefined {
  if (statement.kind === "local") return validateLocalStatement(statement, path, context);
  if (statement.kind === "array") return validateArrayStatement(statement, path, context);
  if (statement.kind === "assign") return validateAssignmentStatement(statement, path, context);
  if (statement.kind === "memory-write") {
    const address = validateExpression(statement.address, `${path}/address`, context);
    if (address !== undefined) return address;
    const value = validateExpression(statement.value, `${path}/value`, context);
    if (value !== undefined) return value;
    const expectedType = statement.width === 1 ? "byte" : "word";
    return statement.address.type === "word" && statement.value.type === expectedType
      ? undefined
      : structuredTypeFailure(
          statement.address.type === "word" ? `${path}/value/type` : `${path}/address/type`,
          "Memory-write operands do not match the selected width.",
          "memory-operand-type-mismatch",
        );
  }
  if (statement.kind === "return") {
    if (statement.value === undefined) {
      return context.returnType === "void"
        ? undefined
        : structuredTypeFailure(
            path,
            "Scalar function returned without a value.",
            "return-type-mismatch",
          );
    }
    const failure = validateExpression(statement.value, `${path}/value`, context);
    if (failure !== undefined) return failure;
    return context.returnType !== "void" &&
      isStructuredTypeCompatible(context.returnType, statement.value.type)
      ? undefined
      : structuredTypeFailure(
          `${path}/value`,
          "Return value does not match the function return type.",
          "return-type-mismatch",
        );
  }
  if (statement.kind === "call-statement") {
    return validateCall(statement.callee, statement.arguments, "void", path, context);
  }
  if (statement.kind === "if" || statement.kind === "while" || statement.kind === "do-while") {
    return validateControlFlowStatement(statement, path, context, depth, budget);
  }
  return validateForStatement(statement, path, context, depth, budget);
}

function constantScope(module: GenStructuredModule): Map<string, StructuredBinding> {
  const scope = new Map<string, StructuredBinding>();
  module.constants.forEach((constant) => {
    scope.set(constant.name, {
      kind: "scalar",
      type: constant.type,
      writable: false,
      role: "constant",
    });
  });
  return scope;
}

/**
 * Validates complete structured name, type, scope, return, and call-graph semantics.
 *
 * @param module Structurally closed module.
 * @param budget Optional structured budget used for statement-depth closure.
 * @returns Deterministic first failure, or `undefined` when the module is semantically closed.
 */
export function validateStructuredModuleSemantics(
  module: GenStructuredModule,
  budget?: StructuredGenerationBudgetV2,
): StructuredGenerationDiagnosticV2 | undefined {
  const reservedNames = new Set<string>();
  for (let index = 0; index < module.constants.length; index += 1) {
    const name = module.constants[index]!.name;
    if (reservedNames.has(name)) {
      return structuredTypeFailure(
        `/constants/${index}/name`,
        "Module declaration names must be unique.",
        "name-conflict",
      );
    }
    reservedNames.add(name);
  }
  const functions = new Map<string, GenStructuredFunction>();
  for (let index = 0; index < module.functions.length; index += 1) {
    const fn = module.functions[index]!;
    if (reservedNames.has(fn.name)) {
      return structuredTypeFailure(
        `/functions/${index}/name`,
        "Module declaration names must be unique.",
        "name-conflict",
      );
    }
    reservedNames.add(fn.name);
    functions.set(fn.name, fn);
  }
  const constants = evaluateStructuredModuleConstants(module);
  if (!constants.ok) return constants.diagnostic;
  const constantsInScope = constantScope(module);
  const constantContext: ValidationContext = {
    functions,
    scope: constantsInScope,
    reservedNames,
    returnType: "void",
    constants: constants.values,
  };
  for (let index = 0; index < module.constants.length; index += 1) {
    const failure = validateExpression(
      module.constants[index]!.value,
      `/constants/${index}/value`,
      constantContext,
    );
    if (failure !== undefined) return failure;
  }
  for (let functionIndex = 0; functionIndex < module.functions.length; functionIndex += 1) {
    const fn = module.functions[functionIndex]!;
    const functionPath = `/functions/${functionIndex}`;
    const scope = new Map(constantsInScope);
    for (let parameterIndex = 0; parameterIndex < fn.parameters.length; parameterIndex += 1) {
      const parameter = fn.parameters[parameterIndex]!;
      if (scope.has(parameter.name) || reservedNames.has(parameter.name)) {
        return structuredTypeFailure(
          `${functionPath}/parameters/${parameterIndex}/name`,
          "Parameter name shadows or duplicates a visible declaration.",
          "name-conflict",
        );
      }
      if ("kind" in parameter && parameter.kind === "array-parameter") {
        scope.set(parameter.name, { kind: "array", type: parameter.type });
      } else {
        scope.set(parameter.name, { kind: "scalar", type: parameter.type, writable: true });
      }
    }
    const context: ValidationContext = {
      functions,
      scope,
      reservedNames,
      returnType: fn.returnType,
      constants: constants.values,
    };
    const failure = validateStatementList(fn.body, `${functionPath}/body`, context, 1, budget);
    if (failure !== undefined) return failure;
    if (fn.returnType !== "void" && !structuredBodyReturns(fn.body)) {
      return structuredDiagnostic(
        "generation-type-invalid",
        "function-return-path-missing",
        `${functionPath}/body`,
        "Every scalar function path must return a value.",
        { diagnosticFamily: "all-code-paths-return", expectedCompilerDiagnosticCode: "E10102" },
      );
    }
  }
  return structuredCallCycleFailure(module);
}
