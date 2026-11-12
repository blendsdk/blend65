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

/** The placed flag stays at its declared address and never grows a private neighbour. */
const FLAG_ADDRESS = 0xc000;
/** The second placed byte holds an operand the handler itself does not own. */
const MASK_ADDRESS = 0xc001;
/** Screen memory used as an ordinary byte write target by the memory-write form. */
const WRITE_TARGET = 0x0402;
/** CIA2 interrupt control register; reading it also clears the pending bits. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** The installed exclusive NMI handler under test. */
const HANDLER = "src/game.blend::Game.handler";
/** The frozen rejection text for an execution path with a private-storage home. */
const NMI_PRIVATE_STORAGE_MESSAGE =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

const IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources } from c64.cia2;`;

/**
 * Build one witness that differs only in its placed data, handler body and wait test.
 * The route is the same source-programmed one-shot CIA2 Timer A interruption used by
 * the runtime cases, so the handler is reached by a genuine NMI.
 */
function program(declaration: string, handlerBody: string, loopCondition: string): string {
  return `${IMPORTS}
${declaration}
interrupt function handler(): void {
${handlerBody}
}
function main(): void {
    setNMIExclusive(&handler);
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

/** A bare zero test of the consuming read decides the branch directly. */
const BARE_ZERO = program(
  "place(at: $C000) let finished: boolean = false;",
  "    if (readAndClearPendingSources() != 0) { finished = true; }",
  "!finished",
);

/** `x & 1` is already a Boolean value, so `!= 0` adds no comparison instructions. */
const BOOLEAN_MASK_ONE = program(
  "place(at: $C000) let finished: boolean = false;",
  "    finished = ((readAndClearPendingSources() & 1) != 0);",
  "!finished",
);

/** The `== 0` inverse inverts the already-Boolean masked value with one `EOR #$01`. */
const BOOLEAN_MASK_ONE_INVERSE = program(
  "place(at: $C000) let finished: boolean = false;",
  "    finished = ((readAndClearPendingSources() & 1) == 0);",
  "!finished",
);

/** The mask lives at a direct address, so the read result stays in the accumulator. */
const ADDRESSABLE_MASK = program(
  `place(at: $C000) let finished: boolean = false;
place(at: $C001) let maskValue: byte = 1;`,
  "    if ((readAndClearPendingSources() & maskValue) != 0) { finished = true; }",
  "!finished",
);

/** A register-only local has one adjacent store/load pair and no addressable home. */
const SINGLE_USE_LOCAL = program(
  "place(at: $C000) let sampleOut: byte = 0;",
  `    let sample: byte = readAndClearPendingSources();
    sampleOut = sample;`,
  "sampleOut == 0",
);

/** A byte memory write is an ordinary single-use consumer and must not force a home. */
const MEMORY_WRITE_CONSUMER = program(
  "place(at: $C000) let finished: boolean = false;",
  `    let sample: byte = readAndClearPendingSources();
    poke($0402, sample);
    finished = true;`,
  "!finished",
);

/** A local consumed by an adjacent bit test keeps the read in the accumulator. */
const LOCAL_BIT_CONDITION = program(
  "place(at: $C000) let finished: boolean = false;",
  `    let sample: byte = readAndClearPendingSources();
    if ((sample & 1) != 0) { finished = true; }`,
  "!finished",
);

/** A local consumed by an adjacent zero test keeps the read in the accumulator. */
const LOCAL_ZERO_CONDITION = program(
  "place(at: $C000) let finished: boolean = false;",
  `    let sample: byte = readAndClearPendingSources();
    if (sample != 0) { finished = true; }`,
  "!finished",
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

/** One decoded instruction with its published machine range. */
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

/**
 * Decode the complete handler from its published operation ranges and linked bytes.
 * The ranges must tile the handler's code interval exactly, and every range must be a
 * documented instruction, so no hidden instruction can sit inside the reported code.
 */
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
const COMPARE_OPCODES = new Set([
  0xc9, 0xc5, 0xd5, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1, 0xe0, 0xe4, 0xec, 0xc0, 0xc4, 0xcc,
]);
const ADC_OPCODES = new Set([0x69, 0x65, 0x75, 0x6d, 0x7d, 0x79, 0x61, 0x71]);

/** The wrapper must end in the handler's single RTI. */
function expectReturnsWithRti(instructions: readonly HandlerInstruction[]): void {
  expect(instructions.at(-1)!.opcode).toBe(0x40);
}

/** All reads of the CIA2 interrupt control register, which clear its pending bits. */
function deviceReads(instructions: readonly HandlerInstruction[]): HandlerInstruction[] {
  return instructions.filter(
    (instruction) =>
      ABSOLUTE_READ_OPCODES.has(instruction.opcode) &&
      instruction.operand === CIA2_INTERRUPT_CONTROL,
  );
}

/** Exactly one consuming read, decoded as a single absolute load. */
function expectSingleDeviceRead(instructions: readonly HandlerInstruction[]): {
  readonly read: HandlerInstruction;
  readonly index: number;
} {
  const reads = deviceReads(instructions);
  expect(reads).toHaveLength(1);
  expect(reads[0]!.opcode).toBe(0xad);
  return { read: reads[0]!, index: instructions.indexOf(reads[0]!) };
}

/** Decode the signed 8-bit displacement of a conditional branch to its target address. */
function branchTarget(branch: HandlerInstruction): number {
  if (branch.operand === null || branch.operand > 0xff)
    throw new TypeError("Expected an 8-bit branch displacement");
  const displacement = branch.operand < 0x80 ? branch.operand : branch.operand - 0x100;
  return branch.end + displacement;
}

/**
 * A conditional test of the read must guard the flag store with the correct polarity.
 * The compact encoding branches on zero past the store and falls through to it; the
 * only accepted alternative jumps to exactly the store block and leaves the handler
 * on fallthrough. An inverted branch is a defect, not another legal encoding.
 */
function expectGuardedFlagStore(
  instructions: readonly HandlerInstruction[],
  branch: HandlerInstruction,
  loadOne: HandlerInstruction,
  store: HandlerInstruction,
): void {
  const fallthrough = instructions[instructions.indexOf(branch) + 1]!;
  const target = branchTarget(branch);
  if (branch.opcode === 0xf0) {
    expect(target).toBe(store.end);
    expect(fallthrough).toBe(loadOne);
    return;
  }
  expect(branch.opcode).toBe(0xd0);
  expect(target).toBe(loadOne.start);
  expect(fallthrough.opcode).toBe(0x68);
}

/** The bare zero test is read, conditional branch, load one, store the flag. */
function expectBareZeroTest(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const branch = instructions[index + 1]!;
  const flag = instructions[index + 2]!;
  expect([flag.opcode, flag.operand]).toEqual([0xa9, 0x01]);
  const store = instructions[index + 3]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  expectGuardedFlagStore(instructions, branch, flag, store);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(instructions.filter((instruction) => BRANCH_OPCODES.has(instruction.opcode))).toHaveLength(
    1,
  );
}

/** The mask-one Boolean is the masked value itself: no comparison and no new constant. */
function expectBooleanMaskOne(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const mask = instructions[index + 1]!;
  expect([mask.opcode, mask.operand]).toEqual([0x29, 0x01]);
  const store = instructions[index + 2]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(instructions.filter((instruction) => COMPARE_OPCODES.has(instruction.opcode))).toEqual([]);
  expect(
    instructions.filter((instruction) => instruction.opcode === 0xa9 && instruction.operand === 0),
  ).toEqual([]);
  expect(instructions.filter((instruction) => ADC_OPCODES.has(instruction.opcode))).toEqual([]);
}

/** The `== 0` inverse adds exactly one `EOR #$01` to the already-Boolean masked value. */
function expectBooleanMaskOneInverse(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const mask = instructions[index + 1]!;
  expect([mask.opcode, mask.operand]).toEqual([0x29, 0x01]);
  const inverse = instructions[index + 2]!;
  expect([inverse.opcode, inverse.operand]).toEqual([0x49, 0x01]);
  const store = instructions[index + 3]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(
    instructions.filter((instruction) => instruction.opcode === 0x49 && instruction.operand === 1),
  ).toHaveLength(1);
  expect(instructions.filter((instruction) => COMPARE_OPCODES.has(instruction.opcode))).toEqual([]);
  expect(
    instructions.filter((instruction) => instruction.opcode === 0xa9 && instruction.operand === 0),
  ).toEqual([]);
  expect(instructions.filter((instruction) => ADC_OPCODES.has(instruction.opcode))).toEqual([]);
}

/** The placed mask is addressed directly, so the sample is never reloaded. */
function expectAddressableMask(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const mask = instructions[index + 1]!;
  expect([mask.opcode, mask.operand]).toEqual([0x2d, MASK_ADDRESS]);
  const branch = instructions[index + 2]!;
  const flag = instructions[index + 3]!;
  expect([flag.opcode, flag.operand]).toEqual([0xa9, 0x01]);
  const store = instructions[index + 4]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  expectGuardedFlagStore(instructions, branch, flag, store);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(instructions.filter((instruction) => BRANCH_OPCODES.has(instruction.opcode))).toHaveLength(
    1,
  );
}

/** The local lives only in the accumulator: the read is stored once, with no home. */
function expectSingleUseLocal(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const store = instructions[index + 1]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
}

/** A byte memory write consumes the read directly and then the flag is set. */
function expectMemoryWriteConsumer(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const write = instructions[index + 1]!;
  expect([write.opcode, write.operand]).toEqual([0x8d, WRITE_TARGET]);
  const flag = instructions[index + 2]!;
  expect([flag.opcode, flag.operand]).toEqual([0xa9, 0x01]);
  const flagStore = instructions[index + 3]!;
  expect([flagStore.opcode, flagStore.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  expect(instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode))).toHaveLength(
    2,
  );
}

/** A local bit test reuses the read in A: constant mask, guarded branch, flag store. */
function expectLocalBitCondition(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const mask = instructions[index + 1]!;
  expect([mask.opcode, mask.operand]).toEqual([0x29, 0x01]);
  const branch = instructions[index + 2]!;
  const flag = instructions[index + 3]!;
  expect([flag.opcode, flag.operand]).toEqual([0xa9, 0x01]);
  const store = instructions[index + 4]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  expectGuardedFlagStore(instructions, branch, flag, store);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(instructions.filter((instruction) => BRANCH_OPCODES.has(instruction.opcode))).toHaveLength(
    1,
  );
}

/** A local zero test branches directly on the read in A, with no local home or reload. */
function expectLocalZeroCondition(instructions: readonly HandlerInstruction[]): void {
  const { index } = expectSingleDeviceRead(instructions);
  const branch = instructions[index + 1]!;
  const flag = instructions[index + 2]!;
  expect([flag.opcode, flag.operand]).toEqual([0xa9, 0x01]);
  const store = instructions[index + 3]!;
  expect([store.opcode, store.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  expectGuardedFlagStore(instructions, branch, flag, store);
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect(stores[0]).toBe(store);
  expect(instructions.filter((instruction) => BRANCH_OPCODES.has(instruction.opcode))).toHaveLength(
    1,
  );
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

/** Only the explicitly placed globals may add resident data bytes. */
function expectPlacedGlobals(artifacts: Artifacts, addresses: readonly number[]): void {
  const globals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => profileRecord(interval.owner).kind === "symbol",
  );
  expect(globals).toHaveLength(addresses.length);
  const ordered = [...globals].sort((left, right) => integer(left.start) - integer(right.start));
  addresses.forEach((address, index) => {
    expect(ordered[index]).toMatchObject({
      start: address,
      end: address + 1,
      size: 1,
      payloadBytes: 1,
      resourceClass: "general",
      mutability: "mutable",
    });
  });
}

/** A clean build has a primary artifact, charges no scratch or zero page, and no home. */
async function buildClean(
  source: string,
  profile: string,
  addresses: readonly number[],
): Promise<HandlerInstruction[]> {
  const artifacts = await buildProfileSource(source, profile);
  expect(profileRecords(artifacts.build.artifacts).some(({ kind }) => kind === "primary")).toBe(
    true,
  );
  expect(artifacts.memory.acmeReconciled).toBe(true);
  const totals = profileRecord(artifacts.costs.totals);
  expect(resource(totals, "scratch")).toBe(0);
  expect(resource(totals, "zeroPage")).toBe(0);
  expectPlacedGlobals(artifacts, addresses);
  expectNoHandlerPrivateHome(artifacts);
  const instructions = handlerInstructions(artifacts);
  expectReturnsWithRti(instructions);
  return instructions;
}

/** The delivered ordinary source-read forms build without any handler private storage. */
describe.each(PROFILES)("residual register-only NMI source reads on %s", (profile) => {
  it("should build a bare zero test of the consuming read", async () => {
    const instructions = await buildClean(BARE_ZERO, profile, [FLAG_ADDRESS]);
    expectBareZeroTest(instructions);
  }, 60_000);

  it("should build a Boolean value from the constant mask one", async () => {
    const instructions = await buildClean(BOOLEAN_MASK_ONE, profile, [FLAG_ADDRESS]);
    expectBooleanMaskOne(instructions);
  }, 60_000);

  it("should build the Boolean inverse of the constant mask one with one inversion", async () => {
    const instructions = await buildClean(BOOLEAN_MASK_ONE_INVERSE, profile, [FLAG_ADDRESS]);
    expectBooleanMaskOneInverse(instructions);
  }, 60_000);

  it("should build a bit test against a placed mask byte", async () => {
    const instructions = await buildClean(ADDRESSABLE_MASK, profile, [FLAG_ADDRESS, MASK_ADDRESS]);
    expectAddressableMask(instructions);
  }, 60_000);

  it("should build a single-use local consumed by a byte store", async () => {
    const instructions = await buildClean(SINGLE_USE_LOCAL, profile, [FLAG_ADDRESS]);
    expectSingleUseLocal(instructions);
  }, 60_000);

  it("should build a single-use local consumed by a byte memory write", async () => {
    const instructions = await buildClean(MEMORY_WRITE_CONSUMER, profile, [FLAG_ADDRESS]);
    expectMemoryWriteConsumer(instructions);
  }, 60_000);

  it("should build a single-use local consumed by a bit condition", async () => {
    const instructions = await buildClean(LOCAL_BIT_CONDITION, profile, [FLAG_ADDRESS]);
    expectLocalBitCondition(instructions);
  }, 60_000);

  it("should build a single-use local consumed by a zero condition", async () => {
    const instructions = await buildClean(LOCAL_ZERO_CONDITION, profile, [FLAG_ADDRESS]);
    expectLocalZeroCondition(instructions);
  }, 60_000);
});

/** A Boolean value from mask two is not already 0/1, so it keeps a real private home. */
const BOOLEAN_MASK_TWO = program(
  "place(at: $C000) let finished: boolean = false;",
  "    finished = ((readAndClearPendingSources() & 2) != 0);",
  "!finished",
);

/** Five simultaneously live samples cannot all stay in the accumulator. */
const FIVE_RETAINED_SAMPLES = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function handler(): void {
    let a: byte = peek($0400); let b: byte = peek($0401);
    let c: byte = peek($0402); let d: byte = peek($0403);
    let e: byte = peek($0404);
    poke($0410, a); poke($0411, b); poke($0412, c);
    poke($0413, d); poke($0414, e);
}
function main(): void { setNMIExclusive(&handler); restoreNMI(); }`;

/** Reading the local through its borrowed address needs a real home that NMI may not own. */
const ADDRESS_TAKEN_LOCAL = program(
  "place(at: $C000) let sampleOut: byte = 0;",
  `    let sample: byte = readAndClearPendingSources();
    sampleOut = peek(&sample);`,
  "sampleOut == 0",
);

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
      const proofIndex = source.indexOf(primary);
      expect(proofIndex).toBeGreaterThanOrEqual(0);
      const start = Buffer.byteLength(source.slice(0, proofIndex));
      expect(span!.start).toBeGreaterThanOrEqual(start);
      expect(span!.end).toBeLessThanOrEqual(Buffer.byteLength(source));
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

/** Real private homes and unsupported operand shapes stay rejected on every profile. */
describe.each(PROFILES)("residual NMI private-home rejection on %s", (profile) => {
  it("should reject a Boolean value from the constant mask two", async () => {
    await expectRejected(BOOLEAN_MASK_TWO, profile, "& 2) != 0");
  }, 60_000);

  it("should reject five simultaneously retained sampled bytes", async () => {
    await expectRejected(FIVE_RETAINED_SAMPLES, profile, "peek($0404)");
  }, 60_000);

  it("should reject a local read through the borrowed address peek(&sample)", async () => {
    await expectRejected(ADDRESS_TAKEN_LOCAL, profile, "peek(&sample)");
  }, 60_000);
});
