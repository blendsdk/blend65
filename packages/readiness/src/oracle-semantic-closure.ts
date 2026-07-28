import type {
  GenExpression,
  GenFunction,
  GenModule,
  GenStatement,
  ScalarType,
} from "./generator-ir.js";
import { promoteOracleIntegerTypes } from "./oracle-values.js";

/** Structural measurements charged before evaluator execution. */
export interface OracleProgramMeasurementsV1 {
  /** Logical module/declaration/statement/expression/binding nodes. */
  readonly inputNodes: bigint;
  /** Greatest expression nesting depth. */
  readonly expressionDepth: bigint;
}

/** Closed semantic facts needed to execute one selected entry. */
export interface OracleSemanticClosureV1 {
  /** Structurally and semantically closed module snapshot. */
  readonly module: GenModule;
  /** Unique entry function. */
  readonly entryFunction: GenFunction;
  /** Entry function index used by canonical parameter pointers. */
  readonly entryFunctionIndex: number;
  /** Deterministic dependency order for immutable constants. */
  readonly constantOrder: readonly number[];
  /** Pre-execution structural usage. */
  readonly measurements: OracleProgramMeasurementsV1;
}

/** Result of closing all evaluator prerequisites. */
export type OracleSemanticClosureResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Immutable evaluator prerequisites. */
      readonly closure: OracleSemanticClosureV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Unsupported discriminator. */
      readonly ok: false;
      /** The program is structurally valid but outside evaluator semantics. */
      readonly reason: "unsupported-semantics";
      /** Empty diagnostic tuple because this is not malformed input. */
      readonly diagnostics: readonly [];
    };

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(["==", "!=", "<", "<=", ">", ">="]);

interface ClosureBindingV1 {
  readonly type: ScalarType;
  readonly writable: boolean;
}

function isIntegerType(type: ScalarType): type is Exclude<ScalarType, "boolean"> {
  return type !== "boolean";
}

function lookupBinding(
  frame: ReadonlyMap<string, ClosureBindingV1>,
  constants: ReadonlyMap<string, ClosureBindingV1>,
  name: string,
): ClosureBindingV1 | undefined {
  return frame.get(name) ?? constants.get(name);
}

function validateExpressionTypes(
  expression: GenExpression,
  frame: ReadonlyMap<string, ClosureBindingV1>,
  constants: ReadonlyMap<string, ClosureBindingV1>,
): boolean {
  if (expression.kind === "literal") return true;
  if (expression.kind === "name") {
    return lookupBinding(frame, constants, expression.name)?.type === expression.type;
  }
  if (expression.kind === "unary") {
    if (!validateExpressionTypes(expression.operand, frame, constants)) return false;
    if (expression.operator === "!") {
      return expression.type === "boolean" && expression.operand.type === "boolean";
    }
    if (expression.operator === "-") {
      return (
        (expression.type === "sbyte" || expression.type === "sword") &&
        expression.operand.type === expression.type
      );
    }
    return isIntegerType(expression.type) && expression.operand.type === expression.type;
  }
  if (expression.kind === "binary") {
    if (
      !validateExpressionTypes(expression.left, frame, constants) ||
      !validateExpressionTypes(expression.right, frame, constants)
    ) {
      return false;
    }
    if (expression.operator === "<<" || expression.operator === ">>") {
      return (
        isIntegerType(expression.left.type) &&
        (expression.right.type === "byte" || expression.right.type === "word") &&
        expression.type === expression.left.type
      );
    }
    if (expression.left.type === "boolean" || expression.right.type === "boolean") {
      return (
        expression.left.type === "boolean" &&
        expression.right.type === "boolean" &&
        expression.type === "boolean" &&
        (expression.operator === "==" || expression.operator === "!=")
      );
    }
    const promoted = promoteOracleIntegerTypes(expression.left.type, expression.right.type);
    return COMPARISON_OPERATORS.has(expression.operator)
      ? promoted !== undefined && expression.type === "boolean"
      : promoted !== undefined && expression.type === promoted;
  }
  return (
    expression.address.type === "word" &&
    validateExpressionTypes(expression.address, frame, constants)
  );
}

function validateFunctionTypes(
  fn: GenFunction,
  constants: ReadonlyMap<string, ClosureBindingV1>,
): boolean {
  const frame = new Map<string, ClosureBindingV1>();
  for (const parameter of fn.parameters) {
    if (lookupBinding(frame, constants, parameter.name) !== undefined) return false;
    frame.set(parameter.name, Object.freeze({ type: parameter.type, writable: true }));
  }
  let returned = false;
  for (const statement of fn.body) {
    if (returned) return false;
    if (statement.kind === "local") {
      if (
        lookupBinding(frame, constants, statement.name) !== undefined ||
        statement.initializer.type !== statement.type ||
        !validateExpressionTypes(statement.initializer, frame, constants)
      ) {
        return false;
      }
      frame.set(statement.name, Object.freeze({ type: statement.type, writable: true }));
    } else if (statement.kind === "assign") {
      const target = lookupBinding(frame, constants, statement.target);
      if (
        target === undefined ||
        !target.writable ||
        target.type !== statement.value.type ||
        !validateExpressionTypes(statement.value, frame, constants)
      ) {
        return false;
      }
    } else if (statement.kind === "memory-write") {
      const valueType = statement.width === 1 ? "byte" : "word";
      if (
        statement.address.type !== "word" ||
        statement.value.type !== valueType ||
        !validateExpressionTypes(statement.address, frame, constants) ||
        !validateExpressionTypes(statement.value, frame, constants)
      ) {
        return false;
      }
    } else if (statement.value === undefined) {
      if (fn.returnType !== "void") return false;
      returned = true;
    } else {
      if (
        fn.returnType === "void" ||
        statement.value.type !== fn.returnType ||
        !validateExpressionTypes(statement.value, frame, constants)
      ) {
        return false;
      }
      returned = true;
    }
  }
  return fn.returnType === "void" || returned;
}

function validateModuleTypes(module: GenModule): boolean {
  const names = new Set<string>();
  const constants = new Map<string, ClosureBindingV1>();
  for (const constant of module.constants) {
    if (names.has(constant.name)) return false;
    names.add(constant.name);
    constants.set(constant.name, Object.freeze({ type: constant.type, writable: false }));
  }
  for (const fn of module.functions) {
    if (names.has(fn.name)) return false;
    names.add(fn.name);
  }
  for (const constant of module.constants) {
    if (
      constant.value.type !== constant.type ||
      !validateExpressionTypes(constant.value, new Map(), constants)
    ) {
      return false;
    }
  }
  return module.functions.every((fn) => validateFunctionTypes(fn, constants));
}

function expressionMeasurements(
  expression: GenExpression,
  depth = 1n,
): OracleProgramMeasurementsV1 {
  if (expression.kind === "literal" || expression.kind === "name") {
    return Object.freeze({ inputNodes: 1n, expressionDepth: depth });
  }
  if (expression.kind === "unary") {
    const operand = expressionMeasurements(expression.operand, depth + 1n);
    return Object.freeze({
      inputNodes: operand.inputNodes + 1n,
      expressionDepth: operand.expressionDepth,
    });
  }
  if (expression.kind === "binary") {
    const left = expressionMeasurements(expression.left, depth + 1n);
    const right = expressionMeasurements(expression.right, depth + 1n);
    return Object.freeze({
      inputNodes: left.inputNodes + right.inputNodes + 1n,
      expressionDepth:
        left.expressionDepth > right.expressionDepth ? left.expressionDepth : right.expressionDepth,
    });
  }
  const address = expressionMeasurements(expression.address, depth + 1n);
  return Object.freeze({
    inputNodes: address.inputNodes + 1n,
    expressionDepth: address.expressionDepth,
  });
}

function statementMeasurements(statement: GenStatement): OracleProgramMeasurementsV1 {
  if (statement.kind === "return" && statement.value === undefined) {
    return Object.freeze({ inputNodes: 1n, expressionDepth: 0n });
  }
  const expression =
    statement.kind === "local"
      ? statement.initializer
      : statement.kind === "assign" || statement.kind === "return"
        ? statement.value
        : undefined;
  if (expression !== undefined) {
    const measured = expressionMeasurements(expression);
    return Object.freeze({
      inputNodes: measured.inputNodes + 1n,
      expressionDepth: measured.expressionDepth,
    });
  }
  if (statement.kind !== "memory-write") {
    return Object.freeze({ inputNodes: 1n, expressionDepth: 0n });
  }
  const address = expressionMeasurements(statement.address);
  const value = expressionMeasurements(statement.value);
  return Object.freeze({
    inputNodes: address.inputNodes + value.inputNodes + 1n,
    expressionDepth:
      address.expressionDepth > value.expressionDepth
        ? address.expressionDepth
        : value.expressionDepth,
  });
}

function measureModule(module: GenModule): OracleProgramMeasurementsV1 {
  let inputNodes = 1n;
  let expressionDepth = 0n;
  for (const constant of module.constants) {
    const measured = expressionMeasurements(constant.value);
    inputNodes += measured.inputNodes + 1n;
    if (measured.expressionDepth > expressionDepth) {
      expressionDepth = measured.expressionDepth;
    }
  }
  for (const fn of module.functions) {
    inputNodes += 1n + BigInt(fn.parameters.length);
    for (const statement of fn.body) {
      const measured = statementMeasurements(statement);
      inputNodes += measured.inputNodes;
      if (measured.expressionDepth > expressionDepth) {
        expressionDepth = measured.expressionDepth;
      }
    }
  }
  return Object.freeze({ inputNodes, expressionDepth });
}

function collectConstantDependencies(
  expression: GenExpression,
  constantIndices: ReadonlyMap<string, number>,
  dependencies: Set<number>,
): boolean {
  if (expression.kind === "literal") return true;
  if (expression.kind === "name") {
    const index = constantIndices.get(expression.name);
    if (index === undefined) return false;
    dependencies.add(index);
    return true;
  }
  if (expression.kind === "memory-read") return false;
  if (expression.kind === "unary") {
    return collectConstantDependencies(expression.operand, constantIndices, dependencies);
  }
  return (
    collectConstantDependencies(expression.left, constantIndices, dependencies) &&
    collectConstantDependencies(expression.right, constantIndices, dependencies)
  );
}

function resolveConstantOrder(module: GenModule): readonly number[] | undefined {
  const indices = new Map(module.constants.map((constant, index) => [constant.name, index]));
  const dependencies: readonly (readonly number[])[] = module.constants.map((constant) => {
    const found = new Set<number>();
    return collectConstantDependencies(constant.value, indices, found)
      ? Object.freeze([...found].sort((left, right) => left - right))
      : Object.freeze([-1]);
  });
  if (dependencies.some((items) => items.includes(-1))) return undefined;

  const states = new Uint8Array(module.constants.length);
  const order: number[] = [];
  for (let root = 0; root < module.constants.length; root += 1) {
    if (states[root] === 2) continue;
    const stack: { readonly index: number; nextDependency: number }[] = [
      { index: root, nextDependency: 0 },
    ];
    states[root] = 1;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) return undefined;
      const items = dependencies[frame.index];
      if (items === undefined) return undefined;
      const dependency = items[frame.nextDependency];
      if (dependency === undefined) {
        states[frame.index] = 2;
        order.push(frame.index);
        stack.pop();
        continue;
      }
      frame.nextDependency += 1;
      if (states[dependency] === 1) return undefined;
      if (states[dependency] === 2) continue;
      states[dependency] = 1;
      stack.push({ index: dependency, nextDependency: 0 });
    }
  }
  return Object.freeze(order);
}

/**
 * Validates evaluator typing, constant purity, dependency closure and entry selection.
 *
 * Structural parsing happens before this function. Failures here are deliberately
 * unmodeled semantics rather than malformed external input.
 *
 * @param module Structurally closed generator module.
 * @param entryFunction Exact entry function name.
 * @returns Closed evaluator prerequisites or unsupported semantics.
 */
export function validateOracleSemanticClosure(
  module: GenModule,
  entryFunction: string,
): OracleSemanticClosureResultV1 {
  if (!validateModuleTypes(module)) {
    return Object.freeze({
      ok: false,
      reason: "unsupported-semantics",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const entries = module.functions
    .map((fn, index) => ({ fn, index }))
    .filter(({ fn }) => fn.name === entryFunction);
  const constantOrder = resolveConstantOrder(module);
  if (entries.length !== 1 || entries[0] === undefined || constantOrder === undefined) {
    return Object.freeze({
      ok: false,
      reason: "unsupported-semantics",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  return Object.freeze({
    ok: true,
    closure: Object.freeze({
      module,
      entryFunction: entries[0].fn,
      entryFunctionIndex: entries[0].index,
      constantOrder,
      measurements: measureModule(module),
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
