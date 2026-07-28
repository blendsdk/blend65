import { isGenIdentifier } from "./generator-ir.js";
import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";
import { validateGeneratorIrSyntax } from "./generator-ir-validator.js";
import type { ParameterValueBinding } from "./modeled-generator-model.js";
import {
  createOracleBudgetMeter,
  validateOracleBudget,
  type OracleBudgetMeterV1,
} from "./oracle-budget.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
  type OracleFailure,
} from "./oracle-input.js";
import {
  createOracleMutableMemoryState,
  projectOracleMemory,
  readOracleMutableMemory,
  snapshotOracleMemoryEffects,
  validateOracleMemoryFixture,
  writeOracleMutableMemory,
  type OracleMutableMemoryStateV1,
} from "./oracle-memory.js";
import type {
  MemoryFixtureV1,
  OracleBudgetV1,
  OracleResultV1,
  OracleUnmodeledReason,
  OracleValueV1,
} from "./oracle-model.js";
import {
  evaluateOracleBinaryOperation,
  evaluateOracleUnaryOperation,
} from "./oracle-operations.js";
import {
  validateOracleSemanticClosure,
  type OracleSemanticClosureV1,
} from "./oracle-semantic-closure.js";
import {
  addOracleMutableConstant,
  assignOracleMutableStateValue,
  createOracleEntryFrame,
  createOracleMutableEvaluationState,
  declareOracleMutableLocal,
  getOracleStateValue,
  type OracleMutableEvaluationStateV1,
} from "./oracle-state.js";
import { createOracleScalarValue } from "./oracle-values.js";

/** Complete non-authoritative program accepted by the private conformance entry. */
export interface OracleProgramInputV1 {
  /** Supported program schema version. */
  readonly schemaVersion: 1;
  /** Structurally closed independent generator module. */
  readonly module: GenModule;
  /** Exact selected entry function. */
  readonly entryFunction: string;
  /** Every entry parameter in declaration order. */
  readonly parameterBindings: readonly ParameterValueBinding[];
  /** Explicit initialized memory. */
  readonly memory: MemoryFixtureV1;
  /** Caller-selected bounded resource limits. */
  readonly budget: OracleBudgetV1;
}

interface ParsedOracleProgramInputV1 {
  readonly closure: OracleSemanticClosureV1;
  readonly parameterBindings: readonly ParameterValueBinding[];
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
}

interface EvaluatorRuntimeV1 {
  readonly meter: OracleBudgetMeterV1;
  readonly state: OracleMutableEvaluationStateV1;
  readonly memory: OracleMutableMemoryStateV1;
}

interface ExpressionValueResultV1 {
  readonly kind: "value";
  readonly value: OracleValueV1;
  readonly memory: OracleMutableMemoryStateV1;
}

interface EvaluatorUnmodeledResultV1 {
  readonly kind: "unmodeled";
  readonly reason: OracleUnmodeledReason;
}

type ExpressionResultV1 = ExpressionValueResultV1 | EvaluatorUnmodeledResultV1 | OracleFailure;

interface StatementContinueResultV1 {
  readonly kind: "continue";
  readonly runtime: EvaluatorRuntimeV1;
}

interface StatementReturnResultV1 {
  readonly kind: "return";
  readonly value: OracleValueV1 | null;
  readonly runtime: EvaluatorRuntimeV1;
}

type StatementResultV1 =
  | StatementContinueResultV1
  | StatementReturnResultV1
  | EvaluatorUnmodeledResultV1
  | OracleFailure;

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const PROGRAM_KEYS = [
  "schemaVersion",
  "module",
  "entryFunction",
  "parameterBindings",
  "memory",
  "budget",
] as const;

function budgetFailure(
  result: Extract<ReturnType<OracleBudgetMeterV1["charge"]>, { readonly ok: false }>,
): OracleFailure {
  return Object.freeze({ ok: false, diagnostics: result.diagnostics });
}

function unmodeled(reason: OracleUnmodeledReason): EvaluatorUnmodeledResultV1 {
  return Object.freeze({ kind: "unmodeled", reason });
}

function parseParameterBindings(input: unknown): readonly ParameterValueBinding[] | OracleFailure {
  if (!Array.isArray(input)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/parameterBindings",
      "Parameter bindings must be an ordered array.",
    );
  }
  const bindings: ParameterValueBinding[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const binding = input[index];
    const path = `/parameterBindings/${index}`;
    if (
      !isOracleRecord(binding) ||
      !hasExactOracleKeys(binding, ["kind", "parameterPath", "value"]) ||
      binding.kind !== "parameter-value" ||
      typeof binding.parameterPath !== "string" ||
      (typeof binding.value !== "bigint" && typeof binding.value !== "boolean")
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        path,
        "Parameter binding must use the exact closed value shape.",
      );
    }
    bindings.push(
      Object.freeze({
        kind: "parameter-value",
        parameterPath: binding.parameterPath,
        value: binding.value,
      }),
    );
  }
  return Object.freeze(bindings);
}

function parseOracleProgramInput(
  input: unknown,
): ParsedOracleProgramInputV1 | EvaluatorUnmodeledResultV1 | OracleFailure {
  const snapshot = snapshotOracleInput(input);
  if (!snapshot.ok) return snapshot;
  if (
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, PROGRAM_KEYS) ||
    snapshot.value.schemaVersion !== 1
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle program must use the exact version-one shape.",
    );
  }
  if (!isGenIdentifier(snapshot.value.entryFunction)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function must be a canonical source identifier.",
    );
  }
  const structural = validateGeneratorIrSyntax(snapshot.value.module);
  if (!structural.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      `/module${structural.diagnostics[0]?.path ?? ""}`,
      "Oracle module is not structurally valid generator IR.",
    );
  }
  const closure = validateOracleSemanticClosure(structural.module, snapshot.value.entryFunction);
  if (!closure.ok) return unmodeled(closure.reason);
  const budget = validateOracleBudget(snapshot.value.budget);
  if (!budget.ok) return budget;
  const memory = validateOracleMemoryFixture(snapshot.value.memory);
  if (!memory.ok) return memory;
  const bindings = parseParameterBindings(snapshot.value.parameterBindings);
  if ("ok" in bindings) return bindings;
  return Object.freeze({
    closure: closure.closure,
    parameterBindings: bindings,
    memory: memory.memory,
    budget: budget.budget,
  });
}

function expressionResult(
  value: OracleValueV1,
  memory: OracleMutableMemoryStateV1,
): ExpressionValueResultV1 {
  return Object.freeze({ kind: "value", value, memory });
}

function evaluateExpression(
  expression: GenExpression,
  runtime: EvaluatorRuntimeV1,
  path: string,
): ExpressionResultV1 {
  const charge = runtime.meter.charge("evaluationSteps", 1n, path);
  if (!charge.ok) return budgetFailure(charge);
  if (expression.kind === "literal") {
    return expressionResult(
      createOracleScalarValue(expression.type, expression.value),
      runtime.memory,
    );
  }
  if (expression.kind === "name") {
    const value = getOracleStateValue(runtime.state, expression.name);
    return value === undefined
      ? unmodeled("unsupported-semantics")
      : expressionResult(value, runtime.memory);
  }
  if (expression.kind === "unary") {
    const operand = evaluateExpression(expression.operand, runtime, `${path}/operand`);
    if ("ok" in operand) return operand;
    if (operand.kind !== "value") return operand;
    const operation = evaluateOracleUnaryOperation(
      expression.operator,
      expression.type,
      operand.value,
    );
    return operation.kind === "value"
      ? expressionResult(operation.value, operand.memory)
      : unmodeled(operation.reason);
  }
  if (expression.kind === "binary") {
    const left = evaluateExpression(expression.left, runtime, `${path}/left`);
    if ("ok" in left) return left;
    if (left.kind !== "value") return left;
    const right = evaluateExpression(
      expression.right,
      Object.freeze({ ...runtime, memory: left.memory }),
      `${path}/right`,
    );
    if ("ok" in right) return right;
    if (right.kind !== "value") return right;
    const operation = evaluateOracleBinaryOperation(
      expression.operator,
      expression.type,
      left.value,
      right.value,
    );
    return operation.kind === "value"
      ? expressionResult(operation.value, right.memory)
      : unmodeled(operation.reason);
  }
  const address = evaluateExpression(expression.address, runtime, `${path}/address`);
  if ("ok" in address) return address;
  if (
    address.kind !== "value" ||
    address.value.kind !== "integer" ||
    address.value.type !== "word"
  ) {
    return address.kind === "value" ? unmodeled("unsupported-semantics") : address;
  }
  const memory = readOracleMutableMemory(
    address.memory,
    expression.width,
    address.value.value,
    runtime.meter,
    path,
  );
  if (!memory.ok) return memory;
  if ("outcome" in memory) return unmodeled(memory.reason);
  return expressionResult(createOracleScalarValue(expression.type, memory.value), address.memory);
}

function evaluateStatement(
  statement: GenStatement,
  runtime: EvaluatorRuntimeV1,
  path: string,
): StatementResultV1 {
  const charge = runtime.meter.charge("evaluationSteps", 1n, path);
  if (!charge.ok) return budgetFailure(charge);
  if (statement.kind === "local") {
    const initializer = evaluateExpression(statement.initializer, runtime, `${path}/initializer`);
    if ("ok" in initializer) return initializer;
    if (initializer.kind !== "value") return initializer;
    const failure = declareOracleMutableLocal(
      runtime.state,
      statement.name,
      statement.type,
      initializer.value,
      `${path}/name`,
    );
    if (failure !== undefined) return failure;
    return Object.freeze({
      kind: "continue",
      runtime,
    });
  }
  if (statement.kind === "assign") {
    const value = evaluateExpression(statement.value, runtime, `${path}/value`);
    if ("ok" in value) return value;
    if (value.kind !== "value") return value;
    const failure = assignOracleMutableStateValue(
      runtime.state,
      statement.target,
      value.value,
      `${path}/target`,
    );
    if (failure !== undefined) return failure;
    return Object.freeze({
      kind: "continue",
      runtime,
    });
  }
  if (statement.kind === "memory-write") {
    const address = evaluateExpression(statement.address, runtime, `${path}/address`);
    if ("ok" in address) return address;
    if (
      address.kind !== "value" ||
      address.value.kind !== "integer" ||
      address.value.type !== "word"
    ) {
      return address.kind === "value" ? unmodeled("unsupported-semantics") : address;
    }
    const value = evaluateExpression(
      statement.value,
      Object.freeze({ ...runtime, memory: address.memory }),
      `${path}/value`,
    );
    if ("ok" in value) return value;
    if (value.kind !== "value" || value.value.kind !== "integer") {
      return value.kind === "value" ? unmodeled("unsupported-semantics") : value;
    }
    const written = writeOracleMutableMemory(
      value.memory,
      statement.width,
      address.value.value,
      value.value.value,
      runtime.meter,
      path,
    );
    if (!written.ok) return written;
    if ("outcome" in written) return unmodeled(written.reason);
    return Object.freeze({
      kind: "continue",
      runtime,
    });
  }
  if (statement.value === undefined) {
    return Object.freeze({ kind: "return", value: null, runtime });
  }
  const value = evaluateExpression(statement.value, runtime, `${path}/value`);
  if ("ok" in value) return value;
  return value.kind === "value"
    ? Object.freeze({
        kind: "return",
        value: value.value,
        runtime,
      })
    : value;
}

function evaluateConstants(
  closure: OracleSemanticClosureV1,
  meter: OracleBudgetMeterV1,
  memory: OracleMutableMemoryStateV1,
  state: OracleMutableEvaluationStateV1,
): EvaluatorUnmodeledResultV1 | OracleFailure | undefined {
  for (const index of closure.constantOrder) {
    const constant = closure.module.constants[index];
    if (constant === undefined) return unmodeled("unsupported-semantics");
    const charge = meter.charge("evaluationSteps", 1n, `/constants/${index}`);
    if (!charge.ok) return budgetFailure(charge);
    const value = evaluateExpression(
      constant.value,
      Object.freeze({ meter, state, memory }),
      `/constants/${index}/value`,
    );
    if ("ok" in value) return value;
    if (value.kind !== "value" || value.value.type !== constant.type) {
      return value.kind === "value" ? unmodeled("unsupported-semantics") : value;
    }
    addOracleMutableConstant(state, constant.name, constant.type, value.value);
  }
  return undefined;
}

function chargeInitialUsage(
  closure: OracleSemanticClosureV1,
  bindingCount: number,
  memory: MemoryFixtureV1,
  meter: OracleBudgetMeterV1,
): OracleFailure | undefined {
  const inputNodes =
    closure.measurements.inputNodes + BigInt(bindingCount) + BigInt(memory.cells.length);
  const nodeCharge = meter.charge("inputNodes", inputNodes, "/module");
  if (!nodeCharge.ok) return budgetFailure(nodeCharge);
  if (closure.measurements.expressionDepth > 0n) {
    const depthCharge = meter.charge(
      "expressionDepth",
      closure.measurements.expressionDepth,
      "/module",
    );
    if (!depthCharge.ok) return budgetFailure(depthCharge);
  }
  if (memory.cells.length > 0) {
    const memoryCharge = meter.charge("memoryCells", BigInt(memory.cells.length), "/memory/cells");
    if (!memoryCharge.ok) return budgetFailure(memoryCharge);
  }
  return undefined;
}

function modeledResult(
  returnValue: OracleValueV1 | null,
  memory: OracleMutableMemoryStateV1,
): OracleResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "modeled",
    observation: Object.freeze({
      kind: "value-state",
      returnValue,
      effects: snapshotOracleMemoryEffects(memory),
      finalMemory: projectOracleMemory(memory),
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function unmodeledResult(reason: OracleUnmodeledReason): OracleResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "oracle-unmodeled",
    reason,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

interface OracleProgramExecutionV1 {
  readonly result: OracleResultV1;
  readonly capturedValue?: OracleValueV1;
}

function executeOracleProgram(
  input: ParsedOracleProgramInputV1,
  captureLocalStatementIndex?: number,
): OracleProgramExecutionV1 {
  const closure = input.closure;
  const meter = createOracleBudgetMeter(input.budget);
  const initialCharge = chargeInitialUsage(
    closure,
    input.parameterBindings.length,
    input.memory,
    meter,
  );
  if (initialCharge !== undefined) return Object.freeze({ result: initialCharge });
  const memory = createOracleMutableMemoryState(input.memory);
  const constantState = createOracleMutableEvaluationState();
  const constants = evaluateConstants(closure, meter, memory, constantState);
  if (constants !== undefined && "kind" in constants) {
    return Object.freeze({ result: unmodeledResult(constants.reason) });
  }
  if (constants !== undefined) return Object.freeze({ result: constants });
  const frame = createOracleEntryFrame(
    closure.entryFunction,
    closure.entryFunctionIndex,
    input.parameterBindings,
    meter,
  );
  if (!frame.ok) return Object.freeze({ result: frame });
  let capturedValue: OracleValueV1 | undefined;
  let runtime: EvaluatorRuntimeV1 = Object.freeze({
    meter,
    state: createOracleMutableEvaluationState(constantState.constants, frame.frame),
    memory,
  });
  for (let index = 0; index < closure.entryFunction.body.length; index += 1) {
    const statement = closure.entryFunction.body[index];
    if (statement === undefined) {
      return Object.freeze({ result: unmodeledResult("unsupported-semantics") });
    }
    const result = evaluateStatement(
      statement,
      runtime,
      `/functions/${closure.entryFunctionIndex}/body/${index}`,
    );
    if ("ok" in result) return Object.freeze({ result });
    if (result.kind === "unmodeled") {
      return Object.freeze({ result: unmodeledResult(result.reason) });
    }
    if (result.kind === "return") {
      return Object.freeze({
        result: modeledResult(result.value, result.runtime.memory),
        ...(capturedValue === undefined ? {} : { capturedValue }),
      });
    }
    runtime = result.runtime;
    if (index === captureLocalStatementIndex && statement.kind === "local") {
      capturedValue = getOracleStateValue(runtime.state, statement.name);
    }
  }
  return Object.freeze({
    result:
      closure.entryFunction.returnType === "void"
        ? modeledResult(null, runtime.memory)
        : unmodeledResult("unsupported-semantics"),
    ...(capturedValue === undefined ? {} : { capturedValue }),
  });
}

/**
 * Evaluates one hostile independent program through the production evaluator.
 *
 * This conformance entry is intentionally not re-exported from the package
 * index and carries no publication or suite authority.
 *
 * @param input Unknown version-one program input.
 * @returns Exact value-state result, explicit unmodeled outcome, or closed failure.
 */
export function evaluateOracleProgram(input: unknown): OracleResultV1 {
  try {
    const parsed = parseOracleProgramInput(input);
    if ("ok" in parsed) return parsed;
    return "kind" in parsed ? unmodeledResult(parsed.reason) : executeOracleProgram(parsed).result;
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle program could not be inspected safely.",
    );
  }
}

/** Result of one evaluation that can also capture a selected entry local. */
export interface OracleProgramLocalCaptureV1 {
  /** Complete ordinary evaluator result. */
  readonly result: OracleResultV1;
  /** Selected local value when execution reached and declared it. */
  readonly capturedValue?: OracleValueV1;
}

/**
 * Evaluates a program once while capturing one entry-local value.
 *
 * This private integration seam lets semantics-preserving rewrites reuse the
 * exact source execution instead of evaluating a synthetic program first.
 *
 * @param input Unknown version-one program input.
 * @param statementIndex Entry-body local declaration index to capture.
 * @returns Ordinary result plus the captured typed value when available.
 */
export function evaluateOracleProgramWithLocalCapture(
  input: unknown,
  statementIndex: number,
): OracleProgramLocalCaptureV1 {
  try {
    if (!Number.isSafeInteger(statementIndex) || statementIndex < 0) {
      return Object.freeze({
        result: oracleFailure(
          "oracle.input.invalid",
          "/statementIndex",
          "Local capture statement index is invalid.",
        ),
      });
    }
    const parsed = parseOracleProgramInput(input);
    if ("ok" in parsed) return Object.freeze({ result: parsed });
    return "kind" in parsed
      ? Object.freeze({ result: unmodeledResult(parsed.reason) })
      : executeOracleProgram(parsed, statementIndex);
  } catch {
    return Object.freeze({
      result: oracleFailure(
        "oracle.input.invalid",
        "",
        "Oracle program could not be inspected safely.",
      ),
    });
  }
}
