import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleDiagnostic,
  oracleFailure,
  snapshotOracleInput,
  type OracleFailure,
} from "./oracle-input.js";
import { ORACLE_V1_LIMITS, type OracleBudgetV1, type OracleDiagnostic } from "./oracle-model.js";

/** One independently limited resource consumed by oracle evaluation. */
export type OracleBudgetDimensionV1 = keyof OracleBudgetV1;

/** Immutable budget usage captured after a successful or rejected charge. */
export type OracleBudgetUsageV1 = Readonly<OracleBudgetV1>;

/** Result of one transactional charge against an oracle budget. */
export type OracleBudgetChargeResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Usage after the accepted charge. */
      readonly usage: OracleBudgetUsageV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Usage before the rejected charge. */
      readonly usage: OracleBudgetUsageV1;
      /** Bounded budget failure. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Shared monotonic meter used by evaluator and transform operations. */
export interface OracleBudgetMeterV1 {
  /**
   * Charges one positive amount without retaining a rejected increment.
   *
   * @param dimension Resource counter to increment.
   * @param amount Positive increment.
   * @param path Pointer used when the increment exceeds its selected limit.
   * @returns Usage after success, or unchanged usage with one diagnostic.
   */
  readonly charge: (
    dimension: OracleBudgetDimensionV1,
    amount: bigint,
    path: string,
  ) => OracleBudgetChargeResultV1;

  /**
   * Returns a fresh immutable usage snapshot.
   *
   * @returns Current monotonic usage.
   */
  readonly snapshot: () => OracleBudgetUsageV1;
}

/** Successful validated version-one oracle budget. */
export interface OracleBudgetValidationSuccessV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Immutable bounded budget. */
  readonly budget: OracleBudgetV1;
  /** Empty diagnostic tuple for success. */
  readonly diagnostics: readonly [];
}

/** Closed result of validating a hostile oracle budget. */
export type OracleBudgetValidationResultV1 = OracleBudgetValidationSuccessV1 | OracleFailure;

/** Input accepted by the private production budget conformance probe. */
export interface OracleBudgetProbeInputV1 {
  /** Supported probe schema version. */
  readonly schemaVersion: 1;
  /** Selected resource limits. */
  readonly budget: OracleBudgetV1;
  /** Ordered charges applied to one shared meter. */
  readonly charges: readonly {
    /** Resource counter to charge. */
    readonly dimension: OracleBudgetDimensionV1;
    /** Positive charge amount. */
    readonly amount: bigint;
  }[];
}

/** Closed output returned by the private budget conformance probe. */
export type OracleBudgetProbeResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Usage after every charge. */
      readonly usage: OracleBudgetUsageV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Usage exactly as it stood before the rejected charge. */
      readonly usage: OracleBudgetUsageV1;
      /** Zero-based index of the rejected charge. */
      readonly rejectedChargeIndex: number;
      /** Exact budget diagnostic for the rejected amount. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

const BUDGET_DIMENSIONS = [
  "inputNodes",
  "expressionDepth",
  "evaluationSteps",
  "frames",
  "memoryCells",
  "effects",
  "transformedNodes",
] as const satisfies readonly OracleBudgetDimensionV1[];

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const BUDGET_MAXIMA: Readonly<Record<OracleBudgetDimensionV1, bigint>> = Object.freeze({
  inputNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
  expressionDepth: BigInt(ORACLE_V1_LIMITS.inputDepth),
  evaluationSteps: ORACLE_V1_LIMITS.executionEvents,
  frames: ORACLE_V1_LIMITS.executionEvents,
  memoryCells: ORACLE_V1_LIMITS.memoryCells,
  effects: ORACLE_V1_LIMITS.executionEvents,
  transformedNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
});

function zeroUsage(): OracleBudgetUsageV1 {
  return Object.freeze({
    inputNodes: 0n,
    expressionDepth: 0n,
    evaluationSteps: 0n,
    frames: 0n,
    memoryCells: 0n,
    effects: 0n,
    transformedNodes: 0n,
  });
}

function isBudgetDimension(value: unknown): value is OracleBudgetDimensionV1 {
  return typeof value === "string" && BUDGET_DIMENSIONS.some((dimension) => dimension === value);
}

/**
 * Validates a hostile caller-selected budget against fixed hard maxima.
 *
 * @param input Unknown budget candidate.
 * @param path Pointer assigned to the budget record.
 * @returns Immutable validated limits or one closed input failure.
 *
 * @example
 * ```ts
 * const checked = validateOracleBudget({
 *   inputNodes: 10n,
 *   expressionDepth: 4n,
 *   evaluationSteps: 20n,
 *   frames: 1n,
 *   memoryCells: 2n,
 *   effects: 2n,
 *   transformedNodes: 10n,
 * });
 * ```
 */
export function validateOracleBudget(
  input: unknown,
  path = "/budget",
): OracleBudgetValidationResultV1 {
  if (!isOracleRecord(input) || !hasExactOracleKeys(input, BUDGET_DIMENSIONS)) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Oracle budget must use the exact closed shape.",
    );
  }
  for (const dimension of BUDGET_DIMENSIONS) {
    const value = input[dimension];
    if (typeof value !== "bigint" || value <= 0n || value > BUDGET_MAXIMA[dimension]) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/${dimension}`,
        "Oracle budget fields must be positive bounded integers.",
      );
    }
  }
  const {
    inputNodes,
    expressionDepth,
    evaluationSteps,
    frames,
    memoryCells,
    effects,
    transformedNodes,
  } = input;
  if (
    typeof inputNodes !== "bigint" ||
    typeof expressionDepth !== "bigint" ||
    typeof evaluationSteps !== "bigint" ||
    typeof frames !== "bigint" ||
    typeof memoryCells !== "bigint" ||
    typeof effects !== "bigint" ||
    typeof transformedNodes !== "bigint"
  ) {
    return oracleFailure("oracle.input.invalid", path, "Oracle budget fields must be integers.");
  }
  return Object.freeze({
    ok: true,
    budget: Object.freeze({
      inputNodes,
      expressionDepth,
      evaluationSteps,
      frames,
      memoryCells,
      effects,
      transformedNodes,
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Creates one transactional monotonic meter.
 *
 * A charge is compared before the internal usage snapshot changes, which makes
 * a failed multi-step evaluation incapable of publishing partial success.
 *
 * @param budget Validated caller-selected limits.
 * @returns Independent meter starting at zero usage.
 */
export function createOracleBudgetMeter(budget: OracleBudgetV1): OracleBudgetMeterV1 {
  let usage = zeroUsage();
  return Object.freeze({
    charge(
      dimension: OracleBudgetDimensionV1,
      amount: bigint,
      path: string,
    ): OracleBudgetChargeResultV1 {
      if (amount <= 0n) {
        return Object.freeze({
          ok: false,
          usage,
          diagnostics: Object.freeze([
            oracleDiagnostic(
              "oracle.input.invalid",
              path,
              "Budget charges must be positive integers.",
            ),
          ]),
        });
      }
      const next = usage[dimension] + amount;
      if (next > budget[dimension]) {
        return Object.freeze({
          ok: false,
          usage,
          diagnostics: Object.freeze([
            oracleDiagnostic(
              "oracle.budget",
              path,
              `Oracle ${dimension} budget would be exceeded.`,
            ),
          ]),
        });
      }
      usage = Object.freeze({ ...usage, [dimension]: next });
      return Object.freeze({ ok: true, usage, diagnostics: EMPTY_DIAGNOSTICS });
    },
    snapshot() {
      return Object.freeze({ ...usage });
    },
  });
}

/**
 * Applies hostile conformance charges to the same meter used by evaluation.
 *
 * This function is intentionally absent from the package index. It exists so
 * specification tests can prove exact charge-before behavior without a second
 * accounting implementation.
 *
 * @param input Unknown probe candidate.
 * @returns Final or pre-rejection usage with stable diagnostics.
 */
export function probeOracleBudgetCharges(input: unknown): OracleBudgetProbeResultV1 {
  const snapshot = snapshotOracleInput(input);
  if (!snapshot.ok) {
    return Object.freeze({
      ok: false,
      usage: zeroUsage(),
      rejectedChargeIndex: 0,
      diagnostics: Object.freeze([
        snapshot.diagnostics[0] ??
          oracleDiagnostic("oracle.input.invalid", "", "Budget probe input is invalid."),
      ]),
    });
  }
  if (
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, ["schemaVersion", "budget", "charges"]) ||
    snapshot.value.schemaVersion !== 1 ||
    !Array.isArray(snapshot.value.charges)
  ) {
    return Object.freeze({
      ok: false,
      usage: zeroUsage(),
      rejectedChargeIndex: 0,
      diagnostics: Object.freeze([
        oracleDiagnostic(
          "oracle.input.invalid",
          "",
          "Budget probe must use the exact version-one shape.",
        ),
      ]),
    });
  }
  const budgetResult = validateOracleBudget(snapshot.value.budget);
  if (!budgetResult.ok) {
    return Object.freeze({
      ok: false,
      usage: zeroUsage(),
      rejectedChargeIndex: 0,
      diagnostics: Object.freeze([
        budgetResult.diagnostics[0] ??
          oracleDiagnostic("oracle.input.invalid", "/budget", "Budget is invalid."),
      ]),
    });
  }
  const meter = createOracleBudgetMeter(budgetResult.budget);
  for (let index = 0; index < snapshot.value.charges.length; index += 1) {
    const charge = snapshot.value.charges[index];
    const path = `/charges/${index}`;
    if (
      !isOracleRecord(charge) ||
      !hasExactOracleKeys(charge, ["dimension", "amount"]) ||
      !isBudgetDimension(charge.dimension) ||
      typeof charge.amount !== "bigint" ||
      charge.amount <= 0n
    ) {
      return Object.freeze({
        ok: false,
        usage: meter.snapshot(),
        rejectedChargeIndex: index,
        diagnostics: Object.freeze([
          oracleDiagnostic(
            "oracle.input.invalid",
            path,
            "Budget charge must name one dimension and a positive integer amount.",
          ),
        ]),
      });
    }
    const result = meter.charge(charge.dimension, charge.amount, `${path}/amount`);
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        usage: result.usage,
        rejectedChargeIndex: index,
        diagnostics: result.diagnostics,
      });
    }
  }
  return Object.freeze({
    ok: true,
    usage: meter.snapshot(),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
