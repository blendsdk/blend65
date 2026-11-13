import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
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
/** CIA2 interrupt control register; reading it also clears the pending bits. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** The installed exclusive NMI handler under test. */
const HANDLER = "src/game.blend::Game.handler";

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

const IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources } from c64.cia2;`;

/**
 * Build one witness that differs only in its placed data and handler body.
 * The route is a source-programmed one-shot CIA2 Timer A interruption, so a
 * delivered handler is reached by a genuine NMI rather than by a direct call.
 */
function program(declaration: string, handlerBody: string): string {
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
    while (!finished) { asm_nop(); }
    restoreNMI();
}`;
}

/** The only placed global of the delivered forms is the Boolean flag. */
const FLAG_DECLARATION = "place(at: $C000) let finished: boolean = false;";

/** One delivered source form and the handler shape the language promises for it. */
interface PositiveForm {
  /** Behavior described in plain language for the test name. */
  readonly title: string;
  /** Handler body exactly as a program author writes it. */
  readonly body: string;
  /** Constant mask applied to the consuming read. */
  readonly mask: number;
  /** Number of `LSR A` instructions that normalize the masked value to 0/1. */
  readonly shifts: number;
  /** Whether the Boolean is the `== 0` inverse of the normalized value. */
  readonly inverse: boolean;
  /** Complete handler size including the interrupt wrapper. */
  readonly handlerBytes: number;
}

/**
 * The delivered forms: single-bit constant masks two and four, both polarities,
 * the same shapes where a single-use local carries the device read, and
 * mirrored forms that swap the comparison operands or place the constant mask
 * on the left of `&`.
 */
const POSITIVE_FORMS: readonly PositiveForm[] = [
  {
    title: "a Boolean from the constant mask two",
    body: "    finished = ((readAndClearPendingSources() & 2) != 0);",
    mask: 0x02,
    shifts: 1,
    inverse: false,
    handlerBytes: 13,
  },
  {
    title: "the Boolean inverse of the constant mask two",
    body: "    finished = ((readAndClearPendingSources() & 2) == 0);",
    mask: 0x02,
    shifts: 1,
    inverse: true,
    handlerBytes: 15,
  },
  {
    title: "a Boolean from the constant mask four",
    body: "    finished = ((readAndClearPendingSources() & 4) != 0);",
    mask: 0x04,
    shifts: 2,
    inverse: false,
    handlerBytes: 14,
  },
  {
    title: "the Boolean inverse of the constant mask four",
    body: "    finished = ((readAndClearPendingSources() & 4) == 0);",
    mask: 0x04,
    shifts: 2,
    inverse: true,
    handlerBytes: 16,
  },
  {
    title: "a Boolean from a single-use local and the constant mask two",
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((sample & 2) != 0);`,
    mask: 0x02,
    shifts: 1,
    inverse: false,
    handlerBytes: 13,
  },
  {
    title: "the Boolean inverse of a single-use local and the constant mask two",
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((sample & 2) == 0);`,
    mask: 0x02,
    shifts: 1,
    inverse: true,
    handlerBytes: 15,
  },
  {
    title: "a Boolean from a single-use local and the constant mask four",
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((sample & 4) != 0);`,
    mask: 0x04,
    shifts: 2,
    inverse: false,
    handlerBytes: 14,
  },
  {
    title: "the Boolean inverse of a single-use local and the constant mask four",
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((sample & 4) == 0);`,
    mask: 0x04,
    shifts: 2,
    inverse: true,
    handlerBytes: 16,
  },
  {
    title: "a Boolean from a mirrored constant-left mask two",
    body: "    finished = ((2 & readAndClearPendingSources()) != 0);",
    mask: 0x02,
    shifts: 1,
    inverse: false,
    handlerBytes: 13,
  },
  {
    title: "a Boolean from a mirrored zero test on the constant mask two",
    body: "    finished = (0 != (readAndClearPendingSources() & 2));",
    mask: 0x02,
    shifts: 1,
    inverse: false,
    handlerBytes: 13,
  },
  {
    title: "a Boolean from a single-use local and a mirrored constant-left mask two",
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((2 & sample) != 0);`,
    mask: 0x02,
    shifts: 1,
    inverse: false,
    handlerBytes: 13,
  },
];

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

const STORE_OPCODES = new Set([
  0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c, 0x95, 0x96, 0x94, 0x9d, 0x99, 0x91, 0x81,
]);
const COMPARE_OPCODES = new Set([
  0xc9, 0xc5, 0xd5, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1, 0xe0, 0xe4, 0xec, 0xc0, 0xc4, 0xcc,
]);
const ADC_OPCODES = new Set([0x69, 0x65, 0x75, 0x6d, 0x7d, 0x79, 0x61, 0x71]);

/** Require the wrapper to end in the handler's single `RTI`. */
function expectReturnsWithRti(instructions: readonly HandlerInstruction[]): void {
  expect(instructions.at(-1)!.opcode).toBe(0x40);
}

/**
 * A delivered Boolean is the shift-normalized masked value: the wrapper, one
 * consuming read, one immediate mask, one shift per bit position, an optional
 * single inversion, and one direct store of the result. Nothing is retained.
 */
function expectDeliveredBody(
  instructions: readonly HandlerInstruction[],
  form: PositiveForm,
): void {
  expectReturnsWithRti(instructions);
  const expected = [
    { opcode: 0x48, operand: null },
    { opcode: 0xd8, operand: null },
    { opcode: 0xad, operand: CIA2_INTERRUPT_CONTROL },
    { opcode: 0x29, operand: form.mask },
    ...Array.from({ length: form.shifts }, () => ({ opcode: 0x4a, operand: null })),
    ...(form.inverse ? [{ opcode: 0x49, operand: 0x01 }] : []),
    { opcode: 0x8d, operand: FLAG_ADDRESS },
    { opcode: 0x68, operand: null },
    { opcode: 0x40, operand: null },
  ];
  expect(instructions.map(({ opcode, operand }) => ({ opcode, operand }))).toEqual(expected);
  expect(instructions.at(-1)!.end - instructions[0]!.start).toBe(form.handlerBytes);

  // Exactly one consuming read of the control register, decoded as an absolute load.
  const reads = instructions.filter(
    (instruction) => instruction.operand === CIA2_INTERRUPT_CONTROL,
  );
  expect(reads).toHaveLength(1);
  expect(reads[0]!.opcode).toBe(0xad);

  // One immediate mask and exactly one `LSR A` per shift position.
  const masks = instructions.filter(
    (instruction) => instruction.opcode === 0x29 && instruction.operand === form.mask,
  );
  expect(masks).toHaveLength(1);
  expect(instructions.filter((instruction) => instruction.opcode === 0x4a)).toHaveLength(
    form.shifts,
  );

  // `EOR #$01` appears only in the `== 0` inverse form.
  expect(
    instructions.filter(
      (instruction) => instruction.opcode === 0x49 && instruction.operand === 0x01,
    ),
  ).toHaveLength(form.inverse ? 1 : 0);

  // One store, directly to the placed flag.
  const stores = instructions.filter((instruction) => STORE_OPCODES.has(instruction.opcode));
  expect(stores).toHaveLength(1);
  expect([stores[0]!.opcode, stores[0]!.operand]).toEqual([0x8d, FLAG_ADDRESS]);

  // No comparison, no addition, and no materialized zero constant.
  expect(instructions.filter((instruction) => COMPARE_OPCODES.has(instruction.opcode))).toEqual([]);
  expect(instructions.filter((instruction) => ADC_OPCODES.has(instruction.opcode))).toEqual([]);
  expect(
    instructions.filter((instruction) => instruction.opcode === 0xa9 && instruction.operand === 0),
  ).toEqual([]);

  // The only absolute addresses touched are the device read and the flag store, so
  // no retained byte gets a load or store and no second device read exists.
  expect(
    instructions
      .filter((instruction) => instruction.operand !== null && instruction.operand > 0xff)
      .map(({ opcode, operand }) => [opcode, operand]),
  ).toEqual([
    [0xad, CIA2_INTERRUPT_CONTROL],
    [0x8d, FLAG_ADDRESS],
  ]);
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

/**
 * Build one delivered form and prove it has no private storage anywhere in the
 * handler, then decode the exact machine instructions the language promises.
 */
async function buildDelivered(source: string, profile: string, form: PositiveForm): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(profileRecords(artifacts.build.artifacts).some(({ kind }) => kind === "primary")).toBe(
      true,
    );
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "zeroPage")).toBe(0);
    expect(resource(totals, "hardwareStack")).toBe(4);
    expectPlacedGlobals(artifacts, [FLAG_ADDRESS]);
    expectNoHandlerPrivateHome(artifacts);
    expectDeliveredBody(handlerInstructions(artifacts), form);
  });
}

describe.each(PROFILES)("delivered NMI Boolean values on %s", (profile) => {
  it.each(POSITIVE_FORMS)(
    "should build $title without private storage",
    async (form) => {
      await buildDelivered(program(FLAG_DECLARATION, form.body), profile, form);
    },
    60_000,
  );
});
