import { describe, expect, it } from "vitest";

import { createOracleBudgetMeter } from "./oracle-budget.js";
import {
  createOracleMemoryState,
  createOracleMutableMemoryState,
  readOracleMutableMemory,
  snapshotOracleMemoryEffects,
  validateOracleMemoryFixture,
  writeOracleMemory,
  writeOracleMutableMemory,
} from "./oracle-memory.js";
import {
  addOracleMutableConstant,
  assignOracleMutableStateValue,
  createOracleMutableEvaluationState,
  declareOracleMutableLocal,
} from "./oracle-state.js";

const BUDGET = {
  inputNodes: 256n,
  expressionDepth: 64n,
  evaluationSteps: 512n,
  frames: 2n,
  memoryCells: 64n,
  effects: 64n,
  transformedNodes: 64n,
};

describe("oracle evaluator private builders", () => {
  it("should keep state and memory transactional at every rejection seam", () => {
    const value = Object.freeze({
      kind: "integer" as const,
      type: "byte" as const,
      value: 1n,
    });
    const state = createOracleMutableEvaluationState();
    expect(declareOracleMutableLocal(state, "local", "byte", value, "/local")).toBeUndefined();
    expect(declareOracleMutableLocal(state, "local", "byte", value, "/local")).toMatchObject({
      ok: false,
    });
    expect(declareOracleMutableLocal(state, "wrong", "word", value, "/local")).toMatchObject({
      ok: false,
    });
    expect(assignOracleMutableStateValue(state, "missing", value, "/assign")).toMatchObject({
      ok: false,
    });
    addOracleMutableConstant(state, "constant", "byte", value);
    expect(declareOracleMutableLocal(state, "constant", "byte", value, "/local")).toMatchObject({
      ok: false,
    });

    const memory = createOracleMutableMemoryState({
      schemaVersion: 1,
      cells: [
        { address: 0n, value: 1n },
        { address: 1n, value: 2n },
      ],
    });
    expect(
      readOracleMutableMemory(memory, 1, 2n, createOracleBudgetMeter(BUDGET), "/read"),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(
      readOracleMutableMemory(
        memory,
        2,
        0n,
        createOracleBudgetMeter({ ...BUDGET, evaluationSteps: 1n }),
        "/read",
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    const effectMeter = createOracleBudgetMeter({ ...BUDGET, effects: 1n });
    expect(readOracleMutableMemory(memory, 1, 0n, effectMeter, "/read")).toMatchObject({
      ok: true,
      value: 1n,
    });
    expect(writeOracleMutableMemory(memory, 1, 0n, 2n, effectMeter, "/write")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });
    expect(snapshotOracleMemoryEffects(memory)).toEqual([
      { kind: "read", width: 1, address: 0n, value: 1n, ordinal: 0n },
    ]);

    const readEffectMeter = createOracleBudgetMeter({ ...BUDGET, effects: 1n });
    expect(readOracleMutableMemory(memory, 1, 0n, readEffectMeter, "/read")).toMatchObject({
      ok: true,
    });
    expect(readOracleMutableMemory(memory, 1, 0n, readEffectMeter, "/read")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });

    const immutableMemory = createOracleMemoryState({
      schemaVersion: 1,
      cells: [
        { address: 0n, value: 1n },
        { address: 1n, value: 2n },
      ],
    });
    expect(
      writeOracleMemory(
        immutableMemory,
        2,
        0n,
        0x1234n,
        createOracleBudgetMeter({ ...BUDGET, evaluationSteps: 1n }),
        "/write",
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });

    expect(
      validateOracleMemoryFixture({
        schemaVersion: 1,
        cells: new Array(65_537),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit" }],
    });
  });
});
