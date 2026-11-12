import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  withProfileProject,
} from "../rd05/profile-fixture.js";

/** Every cooperative profile shares the same source-level NMI contract. */
const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** The placed global is one byte and must never grow a private neighbour. */
const GLOBAL_ADDRESS = 0xc000;
/** Timer A is bit 0 of the CIA2 interrupt control register. */
const TIMER_A_SOURCE_BIT = 0x01;
/** The frozen private-storage rejection text, independent of emitted code. */
const NMI_PRIVATE_STORAGE_MESSAGE =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;
const HANDLER = "src/game.blend::Game.timerHandler";

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

const IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources, readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;`;

/** One shared route so each witness differs only in its handler body and flag. */
function program(declaration: string, handlerBody: string, loopCondition: string): string {
  return `${IMPORTS}
${declaration}
interrupt function timerHandler(): void {
${handlerBody}
}
function main(): void {
    setNMIExclusive(&timerHandler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (${loopCondition}) { asm_nop(); }
    restoreNMI();
}`;
}

/** The delivered assignment witness: one consuming read into the placed global. */
const ASSIGNMENT = program(
  "place(at: $C000) let pendingSources: byte = 0;",
  "    pendingSources = readAndClearPendingSources();",
  "(pendingSources & sourceTimerA) == 0",
);

/** The reported defect: a consuming read tested against a constant bit mask. */
const CONDITIONAL = program(
  "place(at: $C000) let timerFinished: boolean = false;",
  "    if ((readAndClearPendingSources() & sourceTimerA) != 0) { timerFinished = true; }",
  "!timerFinished",
);

/** The same bit test written with the constant on the left. */
const REVERSED = program(
  "place(at: $C000) let timerFinished: boolean = false;",
  "    if ((sourceTimerA & readAndClearPendingSources()) != 0) { timerFinished = true; }",
  "!timerFinished",
);

/** Require a nonnegative integer in public evidence instead of trusting metadata. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative integer in generated evidence");
  return value;
}

/** Read exact linked bytes from the PRG's explicit load address. */
function bytesAt(artifacts: Artifacts, start: number, end: number): number[] {
  const load = artifacts.prg.readUInt16LE(0);
  expect(start).toBeGreaterThanOrEqual(load);
  expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
  return [...artifacts.prg.subarray(start - load + 2, end - load + 2)];
}

/** Prove instruction boundaries come from published per-operation machine ranges. */
interface HandlerInstruction {
  /** First loaded address of the emitted operation. */
  readonly start: number;
  /** Exclusive machine end of the emitted operation. */
  readonly end: number;
  /** Documented instruction opcode. */
  readonly opcode: number;
  /** Immediate, little-endian absolute address, or no operand. */
  readonly operand: number | null;
}

/** One-byte opcode length table for the documented NMOS 6510 instructions. */
const ONE_BYTE_OPCODES = new Set([
  0x00, 0x08, 0x0a, 0x18, 0x28, 0x2a, 0x38, 0x40, 0x48, 0x4a, 0x58, 0x60, 0x68, 0x6a, 0x78, 0x88,
  0x8a, 0x98, 0x9a, 0xa8, 0xaa, 0xb8, 0xba, 0xc8, 0xca, 0xd8, 0xe8, 0xea, 0xf8,
]);
const TWO_BYTE_OPCODES = new Set([
  0x01, 0x05, 0x06, 0x09, 0x10, 0x11, 0x15, 0x16, 0x21, 0x24, 0x25, 0x26, 0x29, 0x30, 0x31, 0x35,
  0x36, 0x41, 0x45, 0x46, 0x49, 0x50, 0x51, 0x55, 0x56, 0x61, 0x65, 0x66, 0x69, 0x70, 0x71, 0x75,
  0x76, 0x81, 0x84, 0x85, 0x86, 0x90, 0x91, 0x94, 0x95, 0x96, 0xa0, 0xa1, 0xa2, 0xa4, 0xa5, 0xa6,
  0xa9, 0xb0, 0xb1, 0xb5, 0xb6, 0xc0, 0xc1, 0xc4, 0xc5, 0xc6, 0xc9, 0xd0, 0xd1, 0xd5, 0xd6, 0xe0,
  0xe1, 0xe4, 0xe5, 0xe6, 0xe9, 0xf0, 0xf1, 0xf5, 0xf6,
]);
const THREE_BYTE_OPCODES = new Set([
  0x0d, 0x0e, 0x19, 0x1d, 0x1e, 0x20, 0x2c, 0x2d, 0x2e, 0x39, 0x3d, 0x3e, 0x4c, 0x4d, 0x4e, 0x59,
  0x5d, 0x5e, 0x6c, 0x6d, 0x6e, 0x79, 0x7d, 0x7e, 0x8c, 0x8d, 0x8e, 0x99, 0x9d, 0xac, 0xad, 0xae,
  0xb9, 0xbc, 0xbd, 0xbe, 0xcc, 0xcd, 0xce, 0xd9, 0xdd, 0xde, 0xec, 0xed, 0xee, 0xf9, 0xfd, 0xfe,
]);

/** Require each published operation to contain exactly one documented instruction. */
function instructionLength(opcode: number): number {
  if (ONE_BYTE_OPCODES.has(opcode)) return 1;
  if (TWO_BYTE_OPCODES.has(opcode)) return 2;
  if (THREE_BYTE_OPCODES.has(opcode)) return 3;
  throw new Error(`Unexpected NMOS 6510 opcode $${opcode.toString(16)} in the handler`);
}

/** Decode the complete handler from its published operation ranges and actual PRG bytes. */
function handlerInstructions(artifacts: Artifacts): HandlerInstruction[] {
  const functions = profileRecords(artifacts.debug.functions);
  const index = functions.findIndex((fn) => fn.qualifiedName === HANDLER);
  expect(index).toBeGreaterThanOrEqual(0);
  const fn = functions[index]!;
  const variants = profileRecords(fn.entryVariants);
  expect(variants).toHaveLength(1);
  const rangeIndexes = (variants[0]!.rangeIndexes as unknown[]).map(integer);
  expect(rangeIndexes.length).toBeGreaterThan(0);
  const ranges = profileRecords(artifacts.debug.ranges);
  const instructions = rangeIndexes.map((rangeIndex) => {
    const machine = profileRecord(ranges[rangeIndex]!.machine);
    const start = integer(machine.start);
    const end = integer(machine.end);
    const bytes = bytesAt(artifacts, start, end);
    expect(bytes).toHaveLength(instructionLength(bytes[0]!));
    const operand =
      bytes.length === 1 ? null : bytes.length === 2 ? bytes[1]! : bytes[1]! | (bytes[2]! << 8);
    return { start, end, opcode: bytes[0]!, operand };
  });
  for (let offset = 1; offset < instructions.length; offset += 1)
    expect(instructions[offset]!.start).toBe(instructions[offset - 1]!.end);

  // The published operation ranges must tile the whole handler code interval.
  const code = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === HANDLER;
  });
  expect(code).toHaveLength(1);
  expect(instructions[0]!.start).toBe(integer(code[0]!.start));
  expect(instructions.at(-1)!.end).toBe(integer(code[0]!.end));
  return instructions;
}

const ABSOLUTE_READ_OPCODES = new Set([
  0x0d, 0x2d, 0x4d, 0x6d, 0xad, 0xae, 0xac, 0xcd, 0xec, 0xcc, 0xed, 0x1d, 0x3d, 0x5d, 0x7d, 0xbd,
  0xbe, 0xbc, 0xdd, 0xfd, 0x19, 0x39, 0x59, 0x79, 0xb9, 0xd9, 0xf9,
]);
const STORE_OPCODES = new Set([
  0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c, 0x95, 0x96, 0x94, 0x9d, 0x99, 0x91, 0x81,
]);
const BRANCH_OPCODES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

/** One consuming device read and one fixup-free store to the placed global. */
function expectSingleReadAndGlobalStore(instructions: readonly HandlerInstruction[]): {
  readonly read: HandlerInstruction;
  readonly store: HandlerInstruction;
} {
  const reads = instructions.filter(
    (instruction) =>
      ABSOLUTE_READ_OPCODES.has(instruction.opcode) && instruction.operand === 0xdd0d,
  );
  expect(reads).toHaveLength(1);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]!.opcode).toBe(0x8d);
  expect(stores[0]!.operand).toBe(GLOBAL_ADDRESS);
  expect(reads[0]!.start).toBeLessThan(stores[0]!.start);
  expect(instructions.at(-1)!.opcode).toBe(0x40);
  return { read: reads[0]!, store: stores[0]! };
}

/** The direct bit condition lowers to read, constant mask, branch, with no private store. */
function expectDirectMaskedBranch(instructions: readonly HandlerInstruction[]): void {
  const { read, store } = expectSingleReadAndGlobalStore(instructions);
  const readIndex = instructions.indexOf(read);
  expect(read.opcode).toBe(0xad);
  const mask = instructions[readIndex + 1]!;
  expect(mask.opcode).toBe(0x29);
  expect(mask.operand).toBe(TIMER_A_SOURCE_BIT);
  const branch = instructions[readIndex + 2]!;
  expect(BRANCH_OPCODES.has(branch.opcode)).toBe(true);
  expect(branch.start).toBeLessThan(store.start);
  // Exactly the constant mask sits between the read and the branch, so no private home can exist.
  expect(instructions.slice(readIndex + 1, instructions.indexOf(branch))).toEqual([mask]);
  expect(
    instructions
      .slice(readIndex, instructions.indexOf(branch))
      .filter((instruction) => STORE_OPCODES.has(instruction.opcode)),
  ).toEqual([]);
}

/** Resolve one charged standard resource by its public identity. */
function resource(totals: Record<string, unknown>, id: string): number {
  const rows = profileRecords(totals.resources).filter(
    (row) => row.kind === "standard" && row.id === id,
  );
  expect(rows, id).toHaveLength(1);
  return integer(rows[0]!.value);
}

/** An interrupt-private home is any data interval owned by the handler or its helpers. */
function expectNoHandlerPrivateHome(artifacts: Artifacts): void {
  const privateKinds = new Set(["sfa", "zeroPage", "scratch"]);
  const offending = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!privateKinds.has(String(interval.kind))) return false;
    const owner = profileRecord(interval.owner);
    if (typeof owner.id !== "string") throw new TypeError("Missing interval owner identity");
    const owners: unknown = owner.id.startsWith("overlay:")
      ? JSON.parse(owner.id.slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(owners) || !owners.every((id) => typeof id === "string"))
      throw new TypeError("Malformed interval owner associations");
    return owners.some((id: string) => id === HANDLER || id.startsWith(`${HANDLER}::`));
  });
  expect(offending).toEqual([]);
}

/** The placed global is the source program's only resident data byte. */
function expectOnlyPlacedGlobal(artifacts: Artifacts): void {
  const globals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => profileRecord(interval.owner).kind === "symbol",
  );
  expect(globals).toHaveLength(1);
  expect(globals[0]).toMatchObject({
    start: GLOBAL_ADDRESS,
    end: GLOBAL_ADDRESS + 1,
    size: 1,
    payloadBytes: 1,
    resourceClass: "general",
    mutability: "mutable",
  });
}

/** Both normal forms admit, build, and carry no private handler storage on every profile. */
describe.each(PROFILES)("register-only NMI source reads on %s", (profile) => {
  it("should build the assignment witness without private storage", async () => {
    const artifacts = await buildProfileSource(ASSIGNMENT, profile);
    expect(profileRecords(artifacts.build.artifacts).some(({ kind }) => kind === "primary")).toBe(
      true,
    );
    expect(artifacts.memory.acmeReconciled).toBe(true);
    expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "zeroPage")).toBe(0);
    expectOnlyPlacedGlobal(artifacts);
    expectNoHandlerPrivateHome(artifacts);
    expectSingleReadAndGlobalStore(handlerInstructions(artifacts));
  }, 60_000);

  it("should build the masked bit condition with a constant mask and no private home", async () => {
    const artifacts = await buildProfileSource(CONDITIONAL, profile);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "zeroPage")).toBe(0);
    expectOnlyPlacedGlobal(artifacts);
    expectNoHandlerPrivateHome(artifacts);
    expectDirectMaskedBranch(handlerInstructions(artifacts));
  }, 60_000);

  it("should build the reversed operands without private storage", async () => {
    const artifacts = await buildProfileSource(REVERSED, profile);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "zeroPage")).toBe(0);
    expectOnlyPlacedGlobal(artifacts);
    expectNoHandlerPrivateHome(artifacts);
    expectSingleReadAndGlobalStore(handlerInstructions(artifacts));
  }, 60_000);
});

/** Five simultaneously retained samples cannot be register-only. */
const FIVE_RETAINED_SAMPLES = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function timerHandler(): void {
    let first: byte = peek($0400); let second: byte = peek($0401);
    let third: byte = peek($0402); let fourth: byte = peek($0403);
    let fifth: byte = peek($0404);
    poke($0410, first); poke($0411, second); poke($0412, third);
    poke($0413, fourth); poke($0414, fifth);
}
function main(): void { setNMIExclusive(&timerHandler); restoreNMI(); }`;

/** Both services must reject with the canonical diagnostic and publish nothing. */
async function expectRejected(source: string, profile: string, primary: string): Promise<void> {
  await withProfileProject(source, profile, async (project, root) => {
    const results: readonly (BuildResult | CheckResult)[] = [
      await checkProject({ project }),
      await buildProject({ project, optimization: "none" }),
    ];
    for (const result of results) {
      expect(result.kind).toBe("failure");
      expect(result).not.toHaveProperty("generation");
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      expect(errors[0]!.message).toMatch(NMI_PRIVATE_STORAGE_MESSAGE);
      const span = errors[0]!.primarySpan;
      expect(span?.sourceId).toBe("src/game.blend");
      const start = Buffer.byteLength(source.slice(0, source.indexOf(primary)));
      expect(span!.start).toBeGreaterThanOrEqual(start);
      expect(span!.end).toBeLessThanOrEqual(Buffer.byteLength(source));
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

/** Several simultaneously retained samples still need a private home the NMI proof forbids. */
describe.each(PROFILES)("NMI private-home rejection on %s", (profile) => {
  it("should reject five simultaneously retained samples", async () => {
    await expectRejected(FIVE_RETAINED_SAMPLES, profile, "peek($0404)");
  }, 60_000);
});
