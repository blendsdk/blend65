/**
 * Implementation tests for the shared observables runner: landmark walk
 * order, option-validation branches, strategy wiring, and block-file
 * resolution edges — all against fake drivers. The specification tier pins
 * the user-facing contract; these pin the internals.
 */

import { describe, expect, it } from "vitest";

import type { Registers } from "../emulator/driver.js";
import { TimeoutError } from "../run/strategies.js";
import { FakeDriver, FakeMeasurementDriver } from "./fake-driver.js";
import { assertObservables, type ProgramObservables } from "./observables.js";

/** A fake driver that records the start address of every memory read, in order. */
class RecordingDriver extends FakeDriver {
  readonly reads: number[] = [];

  override async readMemory(start: number, length: number): Promise<Uint8Array> {
    this.reads.push(start);
    return super.readMemory(start, length);
  }
}

/** A register file stopped at `pc`, flags clear. */
function stoppedAt(pc: number): Registers {
  return {
    a: 0,
    x: 0,
    y: 0,
    sp: 0,
    pc,
    flags: {
      carry: false,
      zero: false,
      interrupt: false,
      decimal: false,
      break_: false,
      overflow: false,
      negative: false,
    },
  };
}

describe("Implementation: assertObservables landmark walk", () => {
  it("should walk landmarks in table order before running any check", async () => {
    const driver = new RecordingDriver({
      memory: new Map([
        [0xc000, 1],
        [0xc001, 2],
        [0xc002, 3],
      ]),
    });
    const observables: ProgramObservables = {
      landmarks: [
        { kind: "memory", address: 0xc000, value: 1 },
        { kind: "memory", address: 0xc001, value: 2 },
      ],
      checks: [{ address: 0xc002, value: 3 }],
    };
    await assertObservables(driver, observables);
    expect(driver.reads).toEqual([0xc000, 0xc001, 0xc002]);
  });

  it("should resolve an empty observable set without touching the driver", async () => {
    const driver = new RecordingDriver();
    await assertObservables(driver, { landmarks: [], checks: [] });
    expect(driver.reads).toEqual([]);
    expect(driver.advanceCalls).toBe(0);
  });

  it("should honor options.timeout for a memory landmark that never settles", async () => {
    const driver = new FakeDriver();
    const observables: ProgramObservables = {
      landmarks: [{ kind: "memory", address: 0xc000, value: 7 }],
      checks: [],
    };
    await expect(assertObservables(driver, observables, { timeout: 50 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});

describe("Implementation: assertObservables loop-head option validation", () => {
  const loopHeadSet: ProgramObservables = {
    landmarks: [{ kind: "loopHead", arrivals: 2 }],
    checks: [],
  };
  const symbols = new Map<string, number>([["frame", 0x1234]]);

  it("should reject a loop-head landmark with no options, naming what the consumer must pass", async () => {
    const driver = new FakeMeasurementDriver();
    await expect(assertObservables(driver, loopHeadSet)).rejects.toThrow(
      /loop-head landmark.*loopHeadLabel/,
    );
  });

  it("should reject symbols without a loop-head label, and a label without symbols", async () => {
    const driver = new FakeMeasurementDriver();
    await expect(assertObservables(driver, loopHeadSet, { symbols })).rejects.toThrow(
      /loop-head landmark/,
    );
    await expect(
      assertObservables(driver, loopHeadSet, { loopHeadLabel: "frame" }),
    ).rejects.toThrow(/loop-head landmark/);
  });

  it("should drive the landmark through one tracked checkpoint at the consumer's label", async () => {
    const driver = new FakeMeasurementDriver({ registers: stoppedAt(0x1234) });
    await assertObservables(driver, loopHeadSet, { symbols, loopHeadLabel: "frame" });
    expect(driver.checkpointsSet).toEqual([0x1234]);
    expect(driver.resumeCalls).toBe(2);
    expect(driver.checkpointsDeleted).toEqual([1]);
  });
});

describe("Implementation: assertObservables block-file resolution", () => {
  it("should fail a block check whose file cannot be read, naming file and resolved path", async () => {
    const driver = new FakeDriver();
    const observables: ProgramObservables = {
      landmarks: [],
      checks: [{ address: 0x0340, bytesFile: "examples/balloon/no-such.bin" }],
    };
    await expect(assertObservables(driver, observables)).rejects.toThrow(
      /no-such\.bin.*could not be read.*resolved to/s,
    );
  });
});
