/**
 * Budget-file loader and ratchet check.
 *
 * The budgets data file maps each corpus program to its assembled byte
 * budget and named cycle windows. Validation is strict and loud: unknown
 * keys, missing required fields, and kind/field mismatches fail naming the
 * file and the JSON path — a malformed budget must never let an assertion
 * silently no-op. Budgets ratchet exactly: equal passes, one over fails.
 *
 * Harness-internal (not on the package barrel).
 */

import { readFileSync } from "node:fs";
import { AssertionError } from "./run/assertions.js";

/** A one-shot straight-line window with a static (and optional measured) budget. */
export interface BudgetWindowSpan {
  readonly name: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly kind: "span";
  /** Budget for the window's static max-cycle slice sum. */
  readonly staticMaxCycles: number;
  /** Budget for the quiesced measured elapsed cycles (local tier only). */
  readonly measuredMaxCycles?: number;
}

/** A loop-body window budgeted per textual iteration. */
export interface BudgetWindowPerIteration {
  readonly name: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly kind: "perIteration";
  /** Budget for one iteration's static max-cycle slice sum. */
  readonly staticCyclesPerIteration: number;
}

/** A named cycle window, discriminated by its `kind`. */
export type BudgetWindow = BudgetWindowSpan | BudgetWindowPerIteration;

/** One program's budgets: assembled bytes + its cycle windows. */
export interface ProgramBudget {
  readonly bytes: number;
  readonly windows: readonly BudgetWindow[];
}

/** The whole budgets file. */
export interface BudgetFile {
  readonly programs: Readonly<Record<string, ProgramBudget>>;
}

/** Fail validation naming the file and the JSON path. */
function fail(fileName: string, path: string, message: string): never {
  throw new Error(`${fileName}: ${path} ${message}`);
}

/** Assert `value` is a plain object (not array/null). */
function requireObject(
  fileName: string,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(fileName, path, "must be an object");
  }
  return value as Record<string, unknown>;
}

/** Assert `value` is a non-negative integer. */
function requireCount(fileName: string, path: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(fileName, path, "must be a non-negative integer");
  }
  return value;
}

/** Assert `value` is a non-empty string. */
function requireName(fileName: string, path: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(fileName, path, "must be a non-empty string");
  }
  return value;
}

/** Reject any key of `obj` outside `allowed`. */
function rejectUnknownKeys(
  fileName: string,
  path: string,
  obj: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      fail(fileName, path, `has unknown key '${key}'`);
    }
  }
}

/** Validate one window object. */
function parseWindow(fileName: string, path: string, value: unknown): BudgetWindow {
  const obj = requireObject(fileName, path, value);
  const name = requireName(fileName, `${path}.name`, obj.name);
  const fromLabel = requireName(fileName, `${path}.fromLabel`, obj.fromLabel);
  const toLabel = requireName(fileName, `${path}.toLabel`, obj.toLabel);
  const kind = obj.kind;

  if (kind === "span") {
    rejectUnknownKeys(fileName, path, obj, [
      "name",
      "fromLabel",
      "toLabel",
      "kind",
      "staticMaxCycles",
      "measuredMaxCycles",
    ]);
    if (obj.staticMaxCycles === undefined) {
      fail(fileName, `${path}.staticMaxCycles`, "is required for a span window");
    }
    const staticMaxCycles = requireCount(fileName, `${path}.staticMaxCycles`, obj.staticMaxCycles);
    const window: BudgetWindowSpan = { name, fromLabel, toLabel, kind, staticMaxCycles };
    if (obj.measuredMaxCycles !== undefined) {
      return {
        ...window,
        measuredMaxCycles: requireCount(fileName, `${path}.measuredMaxCycles`, obj.measuredMaxCycles),
      };
    }
    return window;
  }

  if (kind === "perIteration") {
    rejectUnknownKeys(fileName, path, obj, [
      "name",
      "fromLabel",
      "toLabel",
      "kind",
      "staticCyclesPerIteration",
    ]);
    if (obj.staticCyclesPerIteration === undefined) {
      fail(fileName, `${path}.staticCyclesPerIteration`, "is required for a perIteration window");
    }
    return {
      name,
      fromLabel,
      toLabel,
      kind,
      staticCyclesPerIteration: requireCount(
        fileName,
        `${path}.staticCyclesPerIteration`,
        obj.staticCyclesPerIteration,
      ),
    };
  }

  fail(fileName, `${path}.kind`, `must be 'span' or 'perIteration'`);
}

/**
 * Read, parse, and strictly validate a budgets file.
 *
 * @param path The budgets JSON file path.
 * @returns The validated {@link BudgetFile}.
 * @throws {Error} Naming the file and JSON path on any schema violation.
 * @example
 * const budgets = loadBudgetFile(join(root, "test", "golden", "budgets.json"));
 */
export function loadBudgetFile(path: string): BudgetFile {
  const fileName = path.split("/").pop() ?? path;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${fileName}: cannot read/parse '${path}': ${(error as Error).message}`);
  }

  const root = requireObject(fileName, "$", parsed);
  rejectUnknownKeys(fileName, "$", root, ["programs"]);
  const programsObj = requireObject(fileName, "programs", root.programs);

  const programs: Record<string, ProgramBudget> = {};
  for (const [programName, programValue] of Object.entries(programsObj)) {
    const programPath = `programs.${programName}`;
    const program = requireObject(fileName, programPath, programValue);
    rejectUnknownKeys(fileName, programPath, program, ["bytes", "windows"]);
    if (program.bytes === undefined) {
      fail(fileName, `${programPath}.bytes`, "is required");
    }
    const bytes = requireCount(fileName, `${programPath}.bytes`, program.bytes);
    if (!Array.isArray(program.windows)) {
      fail(fileName, `${programPath}.windows`, "must be an array");
    }
    const windows = program.windows.map((window, index) =>
      parseWindow(fileName, `${programPath}.windows[${index}]`, window),
    );
    programs[programName] = { bytes, windows };
  }
  return { programs };
}

/**
 * The exact ratchet: a cost equal to its budget passes; one over fails
 * naming the program, the metric, the actual, and the budget.
 *
 * @param program The budgeted program name.
 * @param metric A human-readable metric label (e.g. "assembled bytes").
 * @param actual The measured/computed cost.
 * @param budget The budgeted ceiling.
 * @throws {AssertionError} When `actual` exceeds `budget`.
 * @example
 * checkCostWithinBudget("slice8b", "assembled bytes", 412, 412); // passes
 */
export function checkCostWithinBudget(
  program: string,
  metric: string,
  actual: number,
  budget: number,
): void {
  if (actual > budget) {
    throw new AssertionError(
      `${program}: ${metric} is ${actual}, exceeding the budget of ${budget} — ` +
        `either fix the regression or consciously raise the budget`,
    );
  }
}
