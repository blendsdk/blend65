import type { GenFunction, ScalarType } from "./generator-ir.js";
import type { ParameterValueBinding } from "./modeled-generator-model.js";
import type { OracleBudgetMeterV1 } from "./oracle-budget.js";
import { oracleFailure, type OracleFailure } from "./oracle-input.js";
import type { OracleValueV1 } from "./oracle-model.js";
import { normalizeOracleInteger } from "./oracle-values.js";

/** One immutable binding visible to evaluator expressions. */
export interface OracleStateBindingV1 {
  /** Scalar declaration type. */
  readonly type: ScalarType;
  /** Current typed value. */
  readonly value: OracleValueV1;
  /** Whether assignment may replace this binding. */
  readonly writable: boolean;
}

/** Immutable constant plus entry-frame evaluator state. */
export interface OracleEvaluationStateV1 {
  /** Resolved module constants by exact declaration name. */
  readonly constants: ReadonlyMap<string, OracleStateBindingV1>;
  /** Parameters and initialized locals by exact declaration name. */
  readonly frame: ReadonlyMap<string, OracleStateBindingV1>;
}

/**
 * Evaluator-owned state builder used while one program is executing.
 *
 * The builder never escapes a single evaluation. Mutating its owned maps avoids
 * repeatedly copying every binding as constants, locals, and assignments grow.
 */
export interface OracleMutableEvaluationStateV1 {
  /** Mutable constants owned only by the current evaluation. */
  readonly constants: Map<string, OracleStateBindingV1>;
  /** Mutable frame owned only by the current evaluation. */
  readonly frame: Map<string, OracleStateBindingV1>;
}

/** Result of creating the single supported entry frame. */
export type OracleFrameResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Immutable parameter frame. */
      readonly frame: ReadonlyMap<string, OracleStateBindingV1>;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

/** Result of an immutable local declaration or assignment. */
export type OracleStateUpdateResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** New state retaining the previous state's immutability. */
      readonly state: OracleEvaluationStateV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function valueFromBinding(type: ScalarType, value: bigint | boolean): OracleValueV1 | undefined {
  if (type === "boolean") {
    return typeof value === "boolean"
      ? Object.freeze({ kind: "boolean", type: "boolean", value })
      : undefined;
  }
  if (typeof value !== "bigint") return undefined;
  const normalized = normalizeOracleInteger(type, value);
  if (normalized !== value) return undefined;
  return Object.freeze({ kind: "integer", type, value });
}

/**
 * Builds the only evaluator frame from canonical ordered parameter bindings.
 *
 * @param fn Selected entry function.
 * @param functionIndex Entry function index used by canonical pointers.
 * @param bindings External parameter values in declaration order.
 * @param meter Shared monotonic budget meter.
 * @returns Immutable parameter frame or a closed input/budget failure.
 */
export function createOracleEntryFrame(
  fn: GenFunction,
  functionIndex: number,
  bindings: readonly ParameterValueBinding[],
  meter: OracleBudgetMeterV1,
): OracleFrameResultV1 {
  if (bindings.length !== fn.parameters.length) {
    return oracleFailure(
      "oracle.input.invalid",
      "/parameterBindings",
      "Entry parameters require one exact external binding each.",
    );
  }
  const charge = meter.charge("frames", 1n, "/entryFunction");
  if (!charge.ok) {
    return Object.freeze({ ok: false, diagnostics: charge.diagnostics });
  }
  const frame = new Map<string, OracleStateBindingV1>();
  for (let index = 0; index < fn.parameters.length; index += 1) {
    const parameter = fn.parameters[index];
    const binding = bindings[index];
    const path = `/parameterBindings/${index}`;
    if (
      parameter === undefined ||
      binding === undefined ||
      binding.kind !== "parameter-value" ||
      binding.parameterPath !== `/functions/${functionIndex}/parameters/${index}`
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        path,
        "Parameter bindings must follow canonical entry declaration order.",
      );
    }
    const value = valueFromBinding(parameter.type, binding.value);
    if (value === undefined) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/value`,
        "Parameter value does not match its declared scalar type and range.",
      );
    }
    frame.set(parameter.name, Object.freeze({ type: parameter.type, value, writable: true }));
  }
  return Object.freeze({
    ok: true,
    frame: new Map(frame),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Creates initial evaluator state from resolved constants and the entry frame.
 *
 * @param constants Resolved immutable constants.
 * @param frame Validated entry frame.
 * @returns Immutable state record.
 */
export function createOracleEvaluationState(
  constants: ReadonlyMap<string, OracleStateBindingV1>,
  frame: ReadonlyMap<string, OracleStateBindingV1>,
): OracleEvaluationStateV1 {
  return Object.freeze({
    constants: new Map(constants),
    frame: new Map(frame),
  });
}

/**
 * Creates a private mutable evaluator state from independent binding snapshots.
 *
 * @param constants Resolved immutable constants.
 * @param frame Validated entry frame.
 * @returns Owned maps that may be updated until the evaluation completes.
 */
export function createOracleMutableEvaluationState(
  constants: ReadonlyMap<string, OracleStateBindingV1> = new Map(),
  frame: ReadonlyMap<string, OracleStateBindingV1> = new Map(),
): OracleMutableEvaluationStateV1 {
  return Object.freeze({
    constants: new Map(constants),
    frame: new Map(frame),
  });
}

/**
 * Resolves one visible typed value, preferring the entry frame over constants.
 *
 * @param state Current immutable evaluator state.
 * @param name Exact declaration name.
 * @returns Visible value, or undefined when the declaration is absent.
 */
export function getOracleStateValue(
  state: OracleEvaluationStateV1 | OracleMutableEvaluationStateV1,
  name: string,
): OracleValueV1 | undefined {
  return state.frame.get(name)?.value ?? state.constants.get(name)?.value;
}

/**
 * Adds one local to an evaluator-owned frame without copying existing bindings.
 *
 * @param state Private state builder for the current evaluation.
 * @param name New local name.
 * @param type Declared local type.
 * @param value Successful initializer value.
 * @param path Pointer to the local declaration.
 * @returns A closed failure when the declaration conflicts, otherwise undefined.
 */
export function declareOracleMutableLocal(
  state: OracleMutableEvaluationStateV1,
  name: string,
  type: ScalarType,
  value: OracleValueV1,
  path: string,
): OracleFailure | undefined {
  if (state.frame.has(name) || state.constants.has(name) || value.type !== type) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Local declaration conflicts with the closed evaluator frame.",
    );
  }
  state.frame.set(name, Object.freeze({ type, value, writable: true }));
  return undefined;
}

/**
 * Updates one writable binding in an evaluator-owned frame.
 *
 * @param state Private state builder for the current evaluation.
 * @param target Existing frame binding name.
 * @param value New typed value.
 * @param path Pointer to the assignment target.
 * @returns A closed failure when the target is invalid, otherwise undefined.
 */
export function assignOracleMutableStateValue(
  state: OracleMutableEvaluationStateV1,
  target: string,
  value: OracleValueV1,
  path: string,
): OracleFailure | undefined {
  const binding = state.frame.get(target);
  if (binding === undefined || !binding.writable || binding.type !== value.type) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Assignment target is not a writable binding of the value type.",
    );
  }
  state.frame.set(target, Object.freeze({ ...binding, value }));
  return undefined;
}

/**
 * Adds one resolved constant to an evaluator-owned constant table.
 *
 * @param state Private state builder for the current evaluation.
 * @param name Constant declaration name.
 * @param type Declared scalar type.
 * @param value Evaluated initializer value.
 */
export function addOracleMutableConstant(
  state: OracleMutableEvaluationStateV1,
  name: string,
  type: ScalarType,
  value: OracleValueV1,
): void {
  state.constants.set(name, Object.freeze({ type, value, writable: false }));
}

/**
 * Adds one local only after its initializer has completed successfully.
 *
 * @param state Current immutable evaluator state.
 * @param name New local name.
 * @param type Declared local type.
 * @param value Successful initializer value.
 * @param path Pointer to the local declaration.
 * @returns Copy-on-write state or a closed invalid-frame failure.
 */
export function declareOracleLocal(
  state: OracleEvaluationStateV1,
  name: string,
  type: ScalarType,
  value: OracleValueV1,
  path: string,
): OracleStateUpdateResultV1 {
  if (state.frame.has(name) || state.constants.has(name) || value.type !== type) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Local declaration conflicts with the closed evaluator frame.",
    );
  }
  const frame = new Map(state.frame);
  frame.set(name, Object.freeze({ type, value, writable: true }));
  return Object.freeze({
    ok: true,
    state: Object.freeze({ constants: state.constants, frame }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Replaces one writable parameter or local through copy-on-write state.
 *
 * @param state Current immutable evaluator state.
 * @param target Existing frame binding name.
 * @param value New typed value.
 * @param path Pointer to the assignment target.
 * @returns Updated immutable state or a closed invalid-frame failure.
 */
export function assignOracleStateValue(
  state: OracleEvaluationStateV1,
  target: string,
  value: OracleValueV1,
  path: string,
): OracleStateUpdateResultV1 {
  const binding = state.frame.get(target);
  if (binding === undefined || !binding.writable || binding.type !== value.type) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Assignment target is not a writable binding of the value type.",
    );
  }
  const frame = new Map(state.frame);
  frame.set(target, Object.freeze({ ...binding, value }));
  return Object.freeze({
    ok: true,
    state: Object.freeze({ constants: state.constants, frame }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Adds one resolved immutable constant through copy-on-write state.
 *
 * @param constants Previously resolved constants.
 * @param name Constant declaration name.
 * @param type Declared scalar type.
 * @param value Evaluated initializer value.
 * @returns New immutable constant map.
 */
export function addOracleConstant(
  constants: ReadonlyMap<string, OracleStateBindingV1>,
  name: string,
  type: ScalarType,
  value: OracleValueV1,
): ReadonlyMap<string, OracleStateBindingV1> {
  const updated = new Map(constants);
  updated.set(name, Object.freeze({ type, value, writable: false }));
  return new Map(updated);
}
