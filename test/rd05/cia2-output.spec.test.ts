import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, cia2Lease, cia2Source } from "./cia2-fixture.js";
import { buildProfileSource } from "./profile-fixture.js";
import {
  CIA2_SHUTDOWN,
  cia2FixedCycles,
  cia2FunctionVariants,
  cia2Instructions,
  cia2OperationGroups,
  expectCia2EntryStack,
  expectCia2ExternalUncertainty,
  expectCia2NoPrivateHomes,
} from "./cia2-output-fixture.js";
import type { Cia2Artifacts, Cia2CodeSlice } from "./cia2-output-fixture.js";

/** These straight-line source fixtures select exactly one handler entry. */
function soleVariant(artifacts: Cia2Artifacts, name: string): Cia2CodeSlice {
  const variants = cia2FunctionVariants(artifacts, name);
  expect(variants).toHaveLength(1);
  return variants[0]!;
}

/** Keep exact operation assertions tied to the corresponding source statement. */
function soleOperation(artifacts: Cia2Artifacts, source: string, proof: string): Buffer {
  const groups = cia2OperationGroups(artifacts, source, proof);
  expect(groups).toHaveLength(1);
  return groups[0]!.bytes;
}

/** Capture both predecessor bytes before a single high-only vector publication. */
function capturedLink(bytes: Buffer): number {
  const instructions = cia2Instructions(bytes);
  const lowReads = instructions.filter(
    ({ opcode, operand }) => opcode === 0xad && operand === 0x0318,
  );
  const highReads = instructions.filter(
    ({ opcode, operand }) => opcode === 0xad && operand === 0x0319,
  );
  expect(lowReads).toHaveLength(1);
  expect(highReads).toHaveLength(1);
  const lowIndex = instructions.indexOf(lowReads[0]!);
  const highIndex = instructions.indexOf(highReads[0]!);
  expect(lowIndex).toBeLessThan(highIndex);
  const lowStore = instructions[lowIndex + 1]!;
  const highStore = instructions[highIndex + 1]!;
  expect([0x85, 0x8d]).toContain(lowStore.opcode);
  expect([0x85, 0x8d]).toContain(highStore.opcode);
  expect(highStore.operand).toBe(lowStore.operand! + 1);
  expect(lowStore.operand! & 0xff).toBeLessThanOrEqual(0xfe);
  const vectorStores = instructions.filter(
    ({ opcode, operand }) =>
      [0x85, 0x8d, 0x86, 0x8e].includes(opcode) && (operand === 0x0318 || operand === 0x0319),
  );
  expect(vectorStores.map(({ operand }) => operand)).toEqual([0x0319]);
  expect(highStore.offset).toBeLessThan(vectorStores[0]!.offset);
  return lowStore.operand!;
}

/** Prove the published constant through the operation's existing register/RAM staging. */
function expectPublishedHigh(bytes: Buffer, entry: number): void {
  let accumulator: number | undefined;
  let index: number | undefined;
  const knownBytes = new Map<number, number>();
  let publications = 0;
  for (const instruction of cia2Instructions(bytes)) {
    const { opcode, operand } = instruction;
    if (opcode === 0xa9) accumulator = operand!;
    else if ([0xa5, 0xad].includes(opcode)) accumulator = knownBytes.get(operand!);
    else if (opcode === 0xa2) index = operand!;
    else if ([0xa6, 0xae].includes(opcode)) index = knownBytes.get(operand!);
    else if (opcode === 0xaa) index = accumulator;
    else if (opcode === 0x8a) accumulator = index;
    else if ([0x85, 0x8d, 0x86, 0x8e].includes(opcode)) {
      const value = [0x85, 0x8d].includes(opcode) ? accumulator : index;
      if (operand === 0x0319) {
        expect(value).toBe(entry >> 8);
        publications += 1;
      }
      if (value === undefined) knownBytes.delete(operand!);
      else knownBytes.set(operand!, value);
    }
  }
  expect(publications).toBe(1);
}

describe.each(CIA2_PROFILES)("CIA2 actual output on %s", (target) => {
  // A is the only clobbered register; RTI restores the interrupted status including D.
  it("should emit the nine-byte constant-writing exclusive entry", async () => {
    const source = cia2Lease("", "poke($0410, 7);");
    const artifacts = await buildProfileSource(source, target);
    const handler = soleVariant(artifacts, "handler");
    expect(handler.start & 0xff).toBe(0x47);
    expect(handler.bytes).toEqual(Buffer.from([0x48, 0xd8, 0xa9, 7, 0x8d, 0x10, 0x04, 0x68, 0x40]));
    // PHA 3 + CLD 2 + LDA 2 + STA 4 + PLA 4 + RTI 6 = 21 nominal CPU cycles.
    expect(handler.bytes.length).toBe(9);
    expect(cia2FixedCycles(handler.bytes)).toBe(21);
    expectCia2EntryStack(artifacts, 4);
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
  }, 60_000);

  // The source helper is an ordinary JSR/RTS function, separately charged from its NMI caller.
  it("should emit a direct ordinary helper call without private NMI homes", async () => {
    const source = cia2Lease(
      "",
      "writeConstant();",
      "function writeConstant(): void { poke($0410, 7); }",
    );
    const artifacts = await buildProfileSource(source, target);
    const helper = soleVariant(artifacts, "writeConstant");
    const handler = soleVariant(artifacts, "handler");
    expect(helper.bytes).toEqual(Buffer.from([0xa9, 7, 0x8d, 0x10, 0x04, 0x60]));
    expect(handler.bytes).toEqual(
      Buffer.from([0x48, 0xd8, 0x20, helper.start & 0xff, helper.start >> 8, 0x68, 0x40]),
    );
    // The 7-byte caller costs 21 cycles; the 6-byte helper adds 12 cycles, including RTS.
    expect(handler.bytes.length + helper.bytes.length).toBe(13);
    expect(cia2FixedCycles(handler.bytes) + cia2FixedCycles(helper.bytes)).toBe(33);
    expectCia2EntryStack(artifacts, 6);
    expectCia2NoPrivateHomes(artifacts, ["handler", "writeConstant"]);
  }, 60_000);

  // One ICR read returns the captured byte directly to the fixed store, with no private staging.
  it("should emit one direct pending-source load followed by the fixed store", async () => {
    const source = cia2Lease(
      "disableInterruptSources($1F);",
      "poke($0410, readAndClearPendingSources());",
    );
    const artifacts = await buildProfileSource(source, target);
    const handler = soleVariant(artifacts, "handler");
    expect(handler.bytes).toEqual(
      Buffer.from([0x48, 0xd8, 0xad, 0x0d, 0xdd, 0x8d, 0x10, 0x04, 0x68, 0x40]),
    );
    // The 6-byte body costs 8 cycles; its 4-byte entry/exit adds 15 cycles.
    expect(handler.bytes.length).toBe(10);
    expect(cia2FixedCycles(handler.bytes)).toBe(23);
    expectCia2EntryStack(artifacts, 4);
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
  }, 60_000);

  // Reload latches write low then high; LOAD is a single control strobe, not persistent state.
  it("should emit constant latch and control mutations in the owning callback", async () => {
    const body =
      "writeTimerALatch($1234); writeTimerBLatch($5678); configureTimerA($19); configureTimerB($49);";
    const source = cia2Lease("disableInterruptSources($1F);", body);
    const artifacts = await buildProfileSource(source, target);
    const handler = soleVariant(artifacts, "handler");
    expect(handler.bytes).toEqual(
      Buffer.from([
        0x48, 0xd8, 0xa9, 0x34, 0x8d, 0x04, 0xdd, 0xa9, 0x12, 0x8d, 0x05, 0xdd, 0xa9, 0x78, 0x8d,
        0x06, 0xdd, 0xa9, 0x56, 0x8d, 0x07, 0xdd, 0xad, 0x0e, 0xdd, 0x29, 0xc6, 0x09, 0x19, 0x8d,
        0x0e, 0xdd, 0xad, 0x0f, 0xdd, 0x29, 0x86, 0x09, 0x49, 0x8d, 0x0f, 0xdd, 0x68, 0x40,
      ]),
    );
    expect(handler.bytes.length).toBe(44);
    expect(cia2FixedCycles(handler.bytes)).toBe(63);
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
    expectCia2EntryStack(artifacts, 4);
  }, 60_000);

  // Every intermediate vector still selects a complete matching-low entry.
  it("should coherently capture the predecessor and publish only the matching high byte", async () => {
    const source = cia2Lease("");
    const artifacts = await buildProfileSource(source, target);
    const handler = soleVariant(artifacts, "handler");
    expect(handler.start & 0xff).toBe(0x47);
    expect(handler.bytes).toEqual(Buffer.from([0x40]));
    const install = soleOperation(artifacts, source, "setNMIExclusive(&handler)");
    const link = capturedLink(install);
    expectPublishedHigh(install, handler.start);
    const restore = cia2Instructions(soleOperation(artifacts, source, "restoreNMI()"));
    expect(restore.filter(({ operand }) => operand === 0x0318)).toEqual([]);
    expect(
      restore.filter(({ opcode, operand }) => [0x85, 0x8d].includes(opcode) && operand === 0x0319),
    ).toHaveLength(1);
    expect(
      restore.some(({ opcode, operand }) => [0xa5, 0xad].includes(opcode) && operand === link + 1),
    ).toBe(true);
    expect(
      restore.filter(({ operand }) => operand !== null && operand >= 0xdd00 && operand <= 0xddff),
    ).toEqual([]);
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
    expectCia2ExternalUncertainty(artifacts);
  }, 60_000);

  // Final typed handback publishes stock first, so no old application writer can undo shutdown.
  it("should emit the exact caller-preserving final timer shutdown", async () => {
    const source = cia2Lease(
      "disableInterruptSources($1F); writeTimerALatch($1234); configureTimerA($19);",
    );
    const artifacts = await buildProfileSource(source, target);
    const restore = soleOperation(artifacts, source, "restoreNMI()");
    expect(restore).toEqual(CIA2_SHUTDOWN);
    expect(restore.length).toBe(38);
    expect(cia2FixedCycles(restore)).toBe(56);
    // PHP/PHA/SEI 8 + publication 6 + mask 6 + controls 24 + drain 4 + PLA/PLP 8 = 56.
    const effects = cia2Instructions(restore)
      .filter(({ opcode }) => [0xad, 0x8d].includes(opcode))
      .map(({ opcode, operand }) => [opcode === 0xad ? "read" : "write", operand]);
    expect(effects).toEqual([
      ["write", 0x0319],
      ["write", 0xdd0d],
      ["read", 0xdd0e],
      ["write", 0xdd0e],
      ["read", 0xdd0f],
      ["write", 0xdd0f],
      ["read", 0xdd0d],
    ]);
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
    expectCia2ExternalUncertainty(artifacts);
  }, 60_000);
});
