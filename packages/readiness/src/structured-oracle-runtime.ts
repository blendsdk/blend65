import type {
  GenArrayReferenceExpression,
  GenArrayType,
  GenStructuredExpression,
  GenStructuredFunction,
  GenStructuredStatement,
  ScalarType,
} from "./generator-ir.js";
import type {
  MemoryCellV1,
  MemoryEffectV1,
  OracleValueV1,
  ValueStateObservationV1,
} from "./oracle-model.js";
import type { OracleBudgetMeterV1 } from "./oracle-budget.js";
import type { StructuredOracleProgramInputV2 } from "./structured-case-families.js";
import type {
  StructuredArrayAccessTraceEntryV2,
  StructuredLoopTraceEntryV2,
} from "./structured-oracle-evaluator.js";
import { evaluateStructuredModuleConstants } from "./structured-constant-evaluator.js";

/** Private mutation decisions captured by the public evaluator facade. */
export interface StructuredOracleRuntimeMutationsV2 {
  readonly unscaledIndex: boolean;
  readonly copyArray: boolean;
  readonly aliasScalar: boolean;
  readonly reverseArguments: boolean;
  readonly oppositeBranch: boolean;
  readonly wrappedLoop: boolean;
}

/** Private successful runtime projection before public identities are attached. */
export interface StructuredOracleRuntimeResultV2 {
  readonly observation: ValueStateObservationV1;
  readonly loopTrace: readonly StructuredLoopTraceEntryV2[];
  readonly arrayAccessTrace: readonly StructuredArrayAccessTraceEntryV2[];
}

interface ScalarValue {
  readonly type: ScalarType;
  readonly value: bigint;
}

interface ScalarCell {
  value: ScalarValue;
}

interface ArrayValue {
  readonly type: GenArrayType;
  readonly values: ScalarCell[];
  readonly name: string;
}

type Binding =
  | { readonly kind: "scalar"; readonly cell: ScalarCell; readonly writable: boolean }
  | { readonly kind: "array"; readonly array: ArrayValue };
type Environment = Map<string, Binding>;

interface EvaluationState {
  readonly functions: ReadonlyMap<
    string,
    { readonly fn: GenStructuredFunction; readonly index: number }
  >;
  readonly memory: Map<number, number>;
  readonly initialized: Set<number>;
  readonly placement: ReadonlyMap<string, number>;
  readonly effects: MemoryEffectV1[];
  readonly loopTrace: StructuredLoopTraceEntryV2[];
  readonly arrayTrace: StructuredArrayAccessTraceEntryV2[];
  readonly meter: OracleBudgetMeterV1;
  readonly mutations: StructuredOracleRuntimeMutationsV2;
  readonly constants: ReadonlyMap<string, Extract<Binding, { readonly kind: "scalar" }>>;
}

interface StatementResult {
  readonly returned: boolean;
  readonly value?: ScalarValue;
}

interface ArrayAddress {
  readonly index: bigint;
  readonly effectiveAddress: bigint;
  readonly width: 1 | 2;
}

/** Private sentinel distinguishing a bounded resource failure from an evaluator invariant. */
export class StructuredOracleBudgetError extends Error {
  public constructor() {
    super("Structured oracle budget exceeded.");
    this.name = "StructuredOracleBudgetError";
  }
}

function normalize(type: ScalarType, value: bigint): ScalarValue {
  if (type === "boolean") return { type, value: value === 0n ? 0n : 1n };
  const bits = type === "byte" || type === "sbyte" ? 8n : 16n;
  const modulus = 1n << bits;
  let normalized = ((value % modulus) + modulus) % modulus;
  if ((type === "sbyte" || type === "sword") && normalized >= modulus / 2n) {
    normalized -= modulus;
  }
  return { type, value: normalized };
}

function oracleValue(value: ScalarValue): OracleValueV1 {
  return value.type === "boolean"
    ? Object.freeze({ kind: "boolean", type: "boolean", value: value.value !== 0n })
    : Object.freeze({ kind: "integer", type: value.type, value: value.value });
}

function charge(
  state: EvaluationState,
  dimension: "evaluationSteps" | "frames" | "effects",
  path: string,
): void {
  if (!state.meter.charge(dimension, 1n, path).ok) throw new StructuredOracleBudgetError();
}

function chargeAmount(
  state: EvaluationState,
  dimension: "evaluationSteps" | "frames" | "effects",
  amount: bigint,
  path: string,
): void {
  if (amount > 0n && !state.meter.charge(dimension, amount, path).ok) {
    throw new StructuredOracleBudgetError();
  }
}

function maximum(type: ScalarType): bigint {
  switch (type) {
    case "boolean":
      return 1n;
    case "byte":
      return 255n;
    case "sbyte":
      return 127n;
    case "word":
      return 65_535n;
    case "sword":
      return 32_767n;
  }
}

function readMemory(
  state: EvaluationState,
  addressValue: bigint,
  width: 1 | 2,
  path: string,
): ScalarValue {
  charge(state, "evaluationSteps", path);
  charge(state, "effects", path);
  const address = Number(addressValue & 0xffffn);
  const low = state.memory.get(address) ?? 0;
  const value = width === 1 ? low : low | ((state.memory.get((address + 1) & 0xffff) ?? 0) << 8);
  state.effects.push(
    Object.freeze({
      ordinal: BigInt(state.effects.length),
      kind: "read",
      width,
      address: BigInt(address),
      value: BigInt(value),
    }),
  );
  return normalize(width === 1 ? "byte" : "word", BigInt(value));
}

function writeMemory(
  state: EvaluationState,
  addressValue: bigint,
  width: 1 | 2,
  value: bigint,
  path: string,
): void {
  charge(state, "evaluationSteps", path);
  charge(state, "effects", path);
  const address = Number(addressValue & 0xffffn);
  const normalized = Number(value & (width === 1 ? 0xffn : 0xffffn));
  state.memory.set(address, normalized & 0xff);
  state.initialized.add(address);
  if (width === 2) {
    state.memory.set((address + 1) & 0xffff, (normalized >> 8) & 0xff);
    state.initialized.add((address + 1) & 0xffff);
  }
  state.effects.push(
    Object.freeze({
      ordinal: BigInt(state.effects.length),
      kind: "write",
      width,
      address: BigInt(address),
      value: BigInt(normalized),
    }),
  );
}

function binary(operator: string, left: bigint, right: bigint, type: ScalarType): bigint {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0n ? maximum(type) : left / right;
    case "%":
      return right === 0n ? 0n : left % right;
    case "&":
      return left & right;
    case "|":
      return left | right;
    case "^":
      return left ^ right;
    case "<<":
      return left << right;
    case ">>":
      return left >> right;
    case "==":
      return left === right ? 1n : 0n;
    case "!=":
      return left !== right ? 1n : 0n;
    case "<":
      return left < right ? 1n : 0n;
    case "<=":
      return left <= right ? 1n : 0n;
    case ">":
      return left > right ? 1n : 0n;
    case ">=":
      return left >= right ? 1n : 0n;
    default:
      return 0n;
  }
}

function arrayAddress(
  binding: Extract<Binding, { readonly kind: "array" }>,
  indexExpression: GenStructuredExpression,
  path: string,
  environment: Environment,
  state: EvaluationState,
): ArrayAddress {
  const index = expression(indexExpression, `${path}/index`, environment, state).value;
  const base = state.placement.get(binding.array.name) ?? 0;
  const width: 1 | 2 =
    binding.array.type.elementType === "word" || binding.array.type.elementType === "sword" ? 2 : 1;
  const offset = state.mutations.unscaledIndex ? index : index * BigInt(width);
  const effectiveAddress = (BigInt(base) + offset) & 0xffffn;
  state.arrayTrace.push(
    Object.freeze({
      expressionPath: path,
      arrayName: binding.array.name,
      index,
      effectiveAddress,
    }),
  );
  return Object.freeze({ index, effectiveAddress, width });
}

function expression(
  value: GenStructuredExpression,
  path: string,
  environment: Environment,
  state: EvaluationState,
  metered = true,
): ScalarValue {
  if (metered) charge(state, "evaluationSteps", path);
  if (value.kind === "literal") return normalize(value.type, value.value);
  if (value.kind === "name") {
    const binding = environment.get(value.name);
    if (binding?.kind !== "scalar") throw new TypeError("scalar binding missing");
    return binding.cell.value;
  }
  if (value.kind === "unary") {
    const operand = expression(value.operand, `${path}/operand`, environment, state, metered).value;
    return normalize(
      value.type,
      value.operator === "-"
        ? -operand
        : value.operator === "~"
          ? ~operand
          : operand === 0n
            ? 1n
            : 0n,
    );
  }
  if (value.kind === "binary") {
    const left = expression(value.left, `${path}/left`, environment, state, metered).value;
    const right = expression(value.right, `${path}/right`, environment, state, metered).value;
    return normalize(value.type, binary(value.operator, left, right, value.type));
  }
  if (value.kind === "memory-read") {
    return readMemory(
      state,
      expression(value.address, `${path}/address`, environment, state, metered).value,
      value.width,
      path,
    );
  }
  if (value.kind === "index") {
    const binding = environment.get(value.target);
    if (binding?.kind !== "array") throw new TypeError("array binding missing");
    const address = arrayAddress(binding, value.index, path, environment, state);
    const indexed = binding.array.values[Number(address.index)];
    return indexed === undefined
      ? readMemory(state, address.effectiveAddress, address.width, path)
      : indexed.value;
  }
  const definition = state.functions.get(value.callee);
  if (definition === undefined) throw new TypeError("callee missing");
  const argumentsValue = evaluateArguments(value.arguments, path, environment, state, metered);
  const result = invoke(definition.fn, definition.index, argumentsValue, state);
  if (result === undefined) throw new TypeError("void expression call");
  return result;
}

function evaluateArguments(
  argumentsValue: readonly (GenStructuredExpression | GenArrayReferenceExpression)[],
  path: string,
  environment: Environment,
  state: EvaluationState,
  metered = true,
): readonly Binding[] {
  const indexes = argumentsValue.map((_, index) => index);
  if (state.mutations.reverseArguments) indexes.reverse();
  const evaluated = new Map<number, Binding>();
  for (const index of indexes) {
    const argument = argumentsValue[index];
    if (argument === undefined) continue;
    if (argument.kind === "array-reference") {
      const binding = environment.get(argument.name);
      if (binding?.kind !== "array") throw new TypeError("array argument missing");
      const array = state.mutations.copyArray
        ? { ...binding.array, values: binding.array.values.map((cell) => ({ value: cell.value })) }
        : binding.array;
      evaluated.set(index, { kind: "array", array });
    } else {
      const result = expression(
        argument,
        `${path}/arguments/${index}`,
        environment,
        state,
        metered,
      );
      const direct = argument.kind === "name" ? environment.get(argument.name) : undefined;
      const cell =
        state.mutations.aliasScalar && direct?.kind === "scalar" ? direct.cell : { value: result };
      evaluated.set(index, { kind: "scalar", cell, writable: true });
    }
  }
  return Object.freeze(argumentsValue.map((_, index) => evaluated.get(index)!));
}

function invoke(
  fn: GenStructuredFunction,
  functionIndex: number,
  argumentsValue: readonly Binding[],
  state: EvaluationState,
): ScalarValue | undefined {
  charge(state, "frames", `/functions/${functionIndex}`);
  const environment: Environment = new Map(state.constants);
  fn.parameters.forEach((parameter, index) => {
    const argument = argumentsValue[index];
    if (
      argument?.kind === "scalar" &&
      !("kind" in parameter && parameter.kind === "array-parameter")
    ) {
      argument.cell.value = normalize(parameter.type, argument.cell.value.value);
    }
    if (argument !== undefined) environment.set(parameter.name, argument);
  });
  const result = statements(fn.body, `/functions/${functionIndex}/body`, environment, state);
  return result.value === undefined || fn.returnType === "void"
    ? undefined
    : normalize(fn.returnType, result.value.value);
}

function statements(
  body: readonly GenStructuredStatement[],
  path: string,
  environment: Environment,
  state: EvaluationState,
): StatementResult {
  for (let index = 0; index < body.length; index += 1) {
    const statement = body[index];
    const statementPath = `${path}/${index}`;
    charge(state, "evaluationSteps", statementPath);
    if (statement.kind === "local") {
      environment.set(statement.name, {
        kind: "scalar",
        writable: true,
        cell: {
          value: normalize(
            statement.type,
            expression(statement.initializer, `${statementPath}/initializer`, environment, state)
              .value,
          ),
        },
      });
    } else if (statement.kind === "array") {
      const type: GenArrayType = {
        kind: "array-type",
        elementType: statement.elementType,
        extent: statement.extent,
        access: "mutable",
      };
      const values = Array.from({ length: statement.extent }, (_, itemIndex) => ({
        value:
          statement.initializer[itemIndex] === undefined
            ? normalize(statement.elementType, 0n)
            : expression(
                statement.initializer[itemIndex]!,
                `${statementPath}/initializer/${itemIndex}`,
                environment,
                state,
              ),
      }));
      environment.set(statement.name, {
        kind: "array",
        array: { type, values, name: statement.name },
      });
    } else if (statement.kind === "assign") {
      const assigned = expression(statement.value, `${statementPath}/value`, environment, state);
      if (typeof statement.target === "string") {
        const binding = environment.get(statement.target);
        if (binding?.kind !== "scalar" || !binding.writable) {
          throw new TypeError("assignment binding missing");
        }
        binding.cell.value = normalize(binding.cell.value.type, assigned.value);
      } else {
        const binding = environment.get(statement.target.target);
        if (binding?.kind !== "array") throw new TypeError("indexed binding missing");
        const address = arrayAddress(
          binding,
          statement.target.index,
          `${statementPath}/target`,
          environment,
          state,
        );
        const cell = binding.array.values[Number(address.index)];
        if (cell !== undefined) {
          cell.value = normalize(binding.array.type.elementType, assigned.value);
        } else {
          writeMemory(
            state,
            address.effectiveAddress,
            address.width,
            assigned.value,
            `${statementPath}/target`,
          );
        }
      }
    } else if (statement.kind === "memory-write") {
      const address = expression(
        statement.address,
        `${statementPath}/address`,
        environment,
        state,
      ).value;
      const value = expression(statement.value, `${statementPath}/value`, environment, state).value;
      writeMemory(state, address, statement.width, value, statementPath);
    } else if (statement.kind === "return") {
      return {
        returned: true,
        ...(statement.value === undefined
          ? {}
          : { value: expression(statement.value, `${statementPath}/value`, environment, state) }),
      };
    } else if (statement.kind === "call-statement") {
      const definition = state.functions.get(statement.callee);
      if (definition === undefined) throw new TypeError("callee missing");
      invoke(
        definition.fn,
        definition.index,
        evaluateArguments(statement.arguments, statementPath, environment, state),
        state,
      );
    } else if (statement.kind === "if") {
      const condition =
        expression(statement.condition, `${statementPath}/condition`, environment, state).value !==
        0n;
      const selected =
        condition !== state.mutations.oppositeBranch ? statement.thenBody : statement.elseBody;
      const result = statements(
        selected,
        `${statementPath}/${condition !== state.mutations.oppositeBranch ? "thenBody" : "elseBody"}`,
        environment,
        state,
      );
      if (result.returned) return result;
    } else if (statement.kind === "while") {
      while (
        expression(statement.condition, `${statementPath}/condition`, environment, state).value !==
        0n
      ) {
        const result = statements(statement.body, `${statementPath}/body`, environment, state);
        if (result.returned) return result;
      }
    } else if (statement.kind === "do-while") {
      do {
        const result = statements(statement.body, `${statementPath}/body`, environment, state);
        if (result.returned) return result;
      } while (
        expression(statement.condition, `${statementPath}/condition`, environment, state).value !==
        0n
      );
    } else {
      const start = expression(
        statement.start,
        `${statementPath}/start`,
        environment,
        state,
        false,
      ).value;
      const end = expression(
        statement.end,
        `${statementPath}/end`,
        environment,
        state,
        false,
      ).value;
      let value = start;
      let iterations = 0n;
      const continues = (): boolean =>
        statement.direction === "until"
          ? value < end
          : statement.direction === "to"
            ? value <= end
            : value >= end;
      while (continues()) {
        charge(state, "evaluationSteps", statementPath);
        environment.set(statement.counter, {
          kind: "scalar",
          writable: false,
          cell: { value: normalize(statement.counterType, value) },
        });
        state.loopTrace.push(
          Object.freeze({ loopPath: statementPath, counter: statement.counter, value }),
        );
        const result = statements(statement.body, `${statementPath}/body`, environment, state);
        if (result.returned) return result;
        iterations += 1n;
        value += statement.direction === "downto" ? -statement.step : statement.step;
      }
      if (state.mutations.wrappedLoop && iterations > 0n) {
        charge(state, "evaluationSteps", statementPath);
        environment.set(statement.counter, {
          kind: "scalar",
          writable: false,
          cell: { value: normalize(statement.counterType, 0n) },
        });
        state.loopTrace.push(
          Object.freeze({ loopPath: statementPath, counter: statement.counter, value: 0n }),
        );
        const result = statements(statement.body, `${statementPath}/body`, environment, state);
        if (result.returned) return result;
      }
    }
  }
  return { returned: false };
}

/**
 * Executes one already-closed structured evaluator request.
 *
 * @param input Facade-validated structured request.
 * @param mutations Immutable mutation decisions for this evaluation.
 * @returns Exact observation and structured traces before identity attachment.
 */
export function executeStructuredOracleRuntimeV2(
  input: StructuredOracleProgramInputV2,
  mutations: StructuredOracleRuntimeMutationsV2,
  meter: OracleBudgetMeterV1,
): StructuredOracleRuntimeResultV2 {
  const constantEvaluation = evaluateStructuredModuleConstants(input.module);
  if (!constantEvaluation.ok) throw new TypeError("module constants are invalid");
  const memory = new Map<number, number>();
  const initialized = new Set<number>();
  for (const cell of input.memory.cells) {
    const address = Number(cell.address & 0xffffn);
    memory.set(address, Number(cell.value & 0xffn));
    initialized.add(address);
  }
  const placement = new Map<string, number>();
  for (const binding of input.arrayPlacement?.bindings ?? []) {
    placement.set(binding.arrayName, binding.baseAddress);
  }
  const constants = new Map<string, Extract<Binding, { readonly kind: "scalar" }>>();
  for (const [name, constant] of constantEvaluation.values) {
    constants.set(name, {
      kind: "scalar",
      writable: false,
      cell: { value: normalize(constant.type, constant.value) },
    });
  }
  const state: EvaluationState = {
    functions: new Map(input.module.functions.map((fn, index) => [fn.name, { fn, index }])),
    memory,
    initialized,
    placement,
    effects: [],
    loopTrace: [],
    arrayTrace: [],
    meter,
    mutations,
    constants,
  };
  chargeAmount(state, "evaluationSteps", constantEvaluation.evaluationSteps, "/constants");
  const entry = input.module.functions.findIndex((fn) => fn.name === input.entryFunction);
  const entryFunction = input.module.functions[entry];
  if (entryFunction === undefined) throw new TypeError("entry function missing");
  const argumentsValue: Binding[] = [];
  for (let index = 0; index < entryFunction.parameters.length; index += 1) {
    const parameter = entryFunction.parameters[index]!;
    const binding = input.parameterBindings.find(
      (candidate) => candidate.parameterPath === `/functions/${entry}/parameters/${index}`,
    );
    if (("kind" in parameter && parameter.kind === "array-parameter") || binding === undefined) {
      throw new TypeError("entry parameter binding invalid");
    }
    argumentsValue.push({
      kind: "scalar",
      writable: true,
      cell: {
        value: normalize(
          parameter.type,
          typeof binding.value === "boolean" ? (binding.value ? 1n : 0n) : binding.value,
        ),
      },
    });
  }
  const returned = invoke(entryFunction, entry, argumentsValue, state);
  const finalMemory: MemoryCellV1[] = [...initialized]
    .sort((left, right) => left - right)
    .map((address) =>
      Object.freeze({ address: BigInt(address), value: BigInt(memory.get(address) ?? 0) }),
    );
  return Object.freeze({
    observation: Object.freeze({
      kind: "value-state",
      returnValue: returned === undefined ? null : oracleValue(returned),
      effects: Object.freeze(state.effects),
      finalMemory: Object.freeze(finalMemory),
    }),
    loopTrace: Object.freeze(state.loopTrace),
    arrayAccessTrace: Object.freeze(state.arrayTrace),
  });
}
