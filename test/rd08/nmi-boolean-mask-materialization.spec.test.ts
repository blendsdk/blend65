import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult } from "@blend65/compiler";
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

/** The placed Boolean flag stays at its declared address. */
const FLAG_ADDRESS = 0xc000;
/** The second placed Boolean of the shared-retention form. */
const SECOND_ADDRESS = 0xc001;
/** A placed runtime mask is addressed directly by the handler. */
const MASK_ADDRESS = 0xc001;
/** A placed word value occupies two bytes at its declared address. */
const WORD_ADDRESS = 0xc100;
/** CIA2 interrupt control register; reading it also clears the pending bits. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** The installed exclusive NMI handler under test. */
const HANDLER = "src/game.blend::Game.handler";
/** The frozen rejection text for an execution path with a private-storage home. */
const NMI_PRIVATE_STORAGE_MESSAGE =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The imports every cooperative handler uses. */
const IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;`;

/** The only placed global of the ordinary forms is the Boolean flag. */
const FLAG_DECLARATION = "place(at: $C000) let finished: boolean = false;";

/**
 * Build one witness whose handler body is the only variable. The exclusive install
 * keeps the handler on the cooperative route, so the private-storage proof applies.
 */
function program(declaration: string, handlerBody: string): string {
  return `${IMPORTS}
${declaration}
interrupt function handler(): void {
${handlerBody}
}
function main(): void {
    setNMIExclusive(&handler);
    restoreNMI();
}`;
}

/** One explicitly placed data object, recorded by its start address and byte width. */
interface PlacedSymbol {
  /** First placed address. */
  readonly address: number;
  /** Byte width of the placed object. */
  readonly size: number;
}

/**
 * One delivered source form and the exact machine result the platform contract promises.
 * The mask is an immediate value, a direct absolute load, absent because the value folds,
 * or absent because the mask leaves the value unchanged.
 */
interface PositiveForm {
  /** Behavior described in plain language for the test name. */
  readonly title: string;
  /** Placed declarations that differ from the shared flag declaration. */
  readonly declaration: string;
  /** Handler body exactly as a program author writes it. */
  readonly body: string;
  /** Immediate AND mask, an absolute mask load, or no AND for a folded or identity value. */
  readonly mask: number | "memory" | null;
  /** Whether the handler performs the single pending-source read. */
  readonly readsDevice: boolean;
  /** Absolute word address loaded instead of the device when the source names a word. */
  readonly wordAddress: number | null;
  /** Whether the zero test is lowered as the inline branch. */
  readonly branch: boolean;
  /** Whether the zero test is lowered as one accumulator shift instead of a branch. */
  readonly shift?: boolean;
  /**
   * Whether the masked byte is already the canonical zero or one, so the store
   * consumes the accumulator directly instead of a loaded constant.
   */
  readonly direct?: boolean;
  /** Whether the Boolean is the `== 0` inverse of the masked value. */
  readonly inverse: boolean;
  /** Constant stored when the comparison folds at compile time. */
  readonly constant: number | null;
  /** Complete handler size including the interrupt wrapper. */
  readonly handlerBytes: number;
  /** Exactly the placed globals this form adds. */
  readonly placed: readonly PlacedSymbol[];
}

const FLAG_ONLY: readonly PlacedSymbol[] = [{ address: FLAG_ADDRESS, size: 1 }];
const FLAG_AND_MASK: readonly PlacedSymbol[] = [
  { address: FLAG_ADDRESS, size: 1 },
  { address: MASK_ADDRESS, size: 1 },
];
const FLAG_AND_WORD: readonly PlacedSymbol[] = [
  { address: FLAG_ADDRESS, size: 1 },
  { address: WORD_ADDRESS, size: 2 },
];

/**
 * The delivered forms: single-bit and multi-bit constant masks in both polarities,
 * the zero-mask fold, an all-ones mask that leaves the value unchanged, an addressable
 * runtime mask in both operand orders, a byte-masked word, a bit-zero-masked word, a
 * single-use constant word local, a single-use constant byte local, a single-use
 * sampled byte local, a word local widened from a device byte read, and the mirrored
 * comparison orders. Each materialization is the expert inline branch, a folded constant
 * load, a direct store of the already-canonical masked byte, or — for a value masked with
 * the constant two — a single shift, with no private storage.
 */
const POSITIVE_FORMS: readonly PositiveForm[] = [
  {
    title: "a Boolean from the single-bit constant mask eight",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 8) != 0);",
    mask: 0x08,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 16,
    placed: FLAG_ONLY,
  },
  {
    title: "the Boolean inverse of the single-bit constant mask eight",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 8) == 0);",
    mask: 0x08,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: true,
    constant: null,
    handlerBytes: 18,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from the multi-bit constant mask three",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 3) != 0);",
    mask: 0x03,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 16,
    placed: FLAG_ONLY,
  },
  {
    title: "the Boolean inverse of the multi-bit constant mask three",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 3) == 0);",
    mask: 0x03,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: true,
    constant: null,
    handlerBytes: 18,
    placed: FLAG_ONLY,
  },
  {
    title: "a false Boolean from the zero constant mask",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 0) != 0);",
    mask: null,
    readsDevice: true,
    wordAddress: null,
    branch: false,
    inverse: false,
    constant: 0,
    handlerBytes: 12,
    placed: FLAG_ONLY,
  },
  {
    title: "a true Boolean from the zero constant mask inverse",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 0) == 0);",
    mask: null,
    readsDevice: true,
    wordAddress: null,
    branch: false,
    inverse: false,
    constant: 1,
    handlerBytes: 12,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from the all-ones constant mask",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((readAndClearPendingSources() & 255) != 0);",
    mask: null,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 14,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from an addressable runtime mask",
    declaration: `${FLAG_DECLARATION}
place(at: $C001) let maskValue: byte = 2;`,
    body: "    finished = ((readAndClearPendingSources() & maskValue) != 0);",
    mask: "memory",
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 17,
    placed: FLAG_AND_MASK,
  },
  {
    title: "the Boolean inverse of an addressable runtime mask",
    declaration: `${FLAG_DECLARATION}
place(at: $C001) let maskValue: byte = 2;`,
    body: "    finished = ((readAndClearPendingSources() & maskValue) == 0);",
    mask: "memory",
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: true,
    constant: null,
    handlerBytes: 19,
    placed: FLAG_AND_MASK,
  },
  {
    title: "a Boolean from a mirrored addressable runtime mask",
    declaration: `${FLAG_DECLARATION}
place(at: $C001) let maskValue: byte = 2;`,
    body: "    finished = ((maskValue & readAndClearPendingSources()) != 0);",
    mask: "memory",
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 17,
    placed: FLAG_AND_MASK,
  },
  {
    title: "a Boolean from a byte-masked word global",
    declaration: `${FLAG_DECLARATION}
place(at: $C100) let w: word = 2;`,
    body: "    finished = ((w & 2) != 0);",
    mask: 0x02,
    readsDevice: false,
    wordAddress: WORD_ADDRESS,
    branch: false,
    shift: true,
    inverse: false,
    constant: null,
    handlerBytes: 13,
    placed: FLAG_AND_WORD,
  },
  {
    title: "a Boolean from a word global masked with bit zero",
    declaration: `${FLAG_DECLARATION}
place(at: $C100) let w: word = 2;`,
    body: "    finished = ((w & 1) != 0);",
    mask: 0x01,
    readsDevice: false,
    wordAddress: WORD_ADDRESS,
    branch: false,
    direct: true,
    inverse: false,
    constant: null,
    handlerBytes: 12,
    placed: FLAG_AND_WORD,
  },
  {
    title: "a Boolean from a single-use constant word local",
    declaration: FLAG_DECLARATION,
    body: `    let w: word = 2;
    finished = ((w & 2) != 0);`,
    mask: null,
    readsDevice: false,
    wordAddress: null,
    branch: false,
    inverse: false,
    constant: 1,
    handlerBytes: 9,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from a single-use byte local",
    declaration: FLAG_DECLARATION,
    body: `    let sample: byte = readAndClearPendingSources();
    finished = ((sample & 8) != 0);`,
    mask: 0x08,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 16,
    placed: FLAG_ONLY,
  },
  {
    // The byte read is widened in place: the low byte stays in A, the high byte is
    // proved zero, and the byte mask observes that low byte only, so no staging home
    // for the converted word is created.
    title: "a Boolean from a runtime word local",
    declaration: FLAG_DECLARATION,
    body: `    let w: word = readAndClearPendingSources();
    finished = ((w & 2) != 0);`,
    mask: 0x02,
    readsDevice: true,
    wordAddress: null,
    branch: false,
    shift: true,
    inverse: false,
    constant: null,
    handlerBytes: 13,
    placed: FLAG_ONLY,
  },
  {
    title: "a false Boolean from a folded constant byte local",
    declaration: FLAG_DECLARATION,
    body: `    let x: byte = 5;
    finished = ((x & 8) != 0);`,
    mask: null,
    readsDevice: false,
    wordAddress: null,
    branch: false,
    inverse: false,
    constant: 0,
    handlerBytes: 9,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from a mirrored constant-left mask",
    declaration: FLAG_DECLARATION,
    body: "    finished = ((8 & readAndClearPendingSources()) != 0);",
    mask: 0x08,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 16,
    placed: FLAG_ONLY,
  },
  {
    title: "a Boolean from a mirrored zero test",
    declaration: FLAG_DECLARATION,
    body: "    finished = (0 != (readAndClearPendingSources() & 8));",
    mask: 0x08,
    readsDevice: true,
    wordAddress: null,
    branch: true,
    inverse: false,
    constant: null,
    handlerBytes: 16,
    placed: FLAG_ONLY,
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

/** One expected instruction in the complete handler sequence. */
interface ExpectedInstruction {
  /** Documented instruction opcode. */
  readonly opcode: number;
  /** Immediate, absolute address, or no operand. */
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
  const instructions = rangeIndexes
    .map((rangeIndex) => {
      const machine = profileRecord(ranges[rangeIndex]!.machine);
      const start = integer(machine.start);
      const end = integer(machine.end);
      const bytes = bytesAt(artifacts, start, end);
      expect(bytes).toHaveLength(instructionLength(bytes[0]!));
      const operand =
        bytes.length === 1 ? null : bytes.length === 2 ? bytes[1]! : bytes[1]! | (bytes[2]! << 8);
      return { start, end, opcode: bytes[0]!, operand };
    })
    .sort((left, right) => left.start - right.start);

  // The published operation ranges must tile the whole handler code interval.
  const code = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === HANDLER;
  });
  expect(code).toHaveLength(1);
  expect(instructions[0]!.start).toBe(integer(code[0]!.start));
  expect(instructions.at(-1)!.end).toBe(integer(code[0]!.end));
  for (let offset = 1; offset < instructions.length; offset += 1)
    expect(instructions[offset]!.start).toBe(instructions[offset - 1]!.end);
  return instructions;
}

const STORE_OPCODES = new Set([
  0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c, 0x95, 0x96, 0x94, 0x9d, 0x99, 0x91, 0x81,
]);
const COMPARE_OPCODES = new Set([
  0xc9, 0xc5, 0xd5, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1, 0xe0, 0xe4, 0xec, 0xc0, 0xc4, 0xcc,
]);
const ADC_OPCODES = new Set([0x69, 0x65, 0x75, 0x6d, 0x7d, 0x79, 0x61, 0x71]);
const BRANCH_OPCODES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

/** Decode the signed 8-bit displacement of a conditional branch to its target address. */
function branchTarget(branch: HandlerInstruction): number {
  if (branch.operand === null || branch.operand > 0xff)
    throw new TypeError("Expected an 8-bit branch displacement");
  const displacement = branch.operand < 0x80 ? branch.operand : branch.operand - 0x100;
  return branch.end + displacement;
}

/** Build the exact instruction sequence the contract promises for one delivered form. */
function expectedInstructions(form: PositiveForm): ExpectedInstruction[] {
  const instructions: ExpectedInstruction[] = [
    { opcode: 0x48, operand: null },
    { opcode: 0xd8, operand: null },
  ];
  if (form.readsDevice) instructions.push({ opcode: 0xad, operand: CIA2_INTERRUPT_CONTROL });
  if (form.wordAddress !== null) instructions.push({ opcode: 0xad, operand: form.wordAddress });
  if (form.mask === "memory") instructions.push({ opcode: 0x2d, operand: MASK_ADDRESS });
  else if (form.mask !== null) instructions.push({ opcode: 0x29, operand: form.mask });
  if (form.branch) {
    instructions.push({ opcode: 0xf0, operand: null });
    instructions.push({ opcode: 0xa9, operand: 0x01 });
    if (form.inverse) instructions.push({ opcode: 0x49, operand: 0x01 });
    instructions.push({ opcode: 0x8d, operand: FLAG_ADDRESS });
  } else if (form.shift) {
    // Masking with the constant two leaves only bit one, so one shift turns the
    // masked value into the canonical zero or one the flag stores directly.
    instructions.push({ opcode: 0x4a, operand: null });
    instructions.push({ opcode: 0x8d, operand: FLAG_ADDRESS });
  } else if (form.direct) {
    // Masking with bit zero leaves only that bit, so the masked accumulator is
    // already the canonical zero or one and is stored without a constant load.
    instructions.push({ opcode: 0x8d, operand: FLAG_ADDRESS });
  } else {
    instructions.push({ opcode: 0xa9, operand: form.constant! });
    instructions.push({ opcode: 0x8d, operand: FLAG_ADDRESS });
  }
  instructions.push({ opcode: 0x68, operand: null }, { opcode: 0x40, operand: null });
  return instructions;
}

/** The only absolute addresses a delivered handler may touch. */
function expectedAbsoluteAccesses(form: PositiveForm): (number | null)[][] {
  const accesses: (number | null)[][] = [];
  if (form.readsDevice) accesses.push([0xad, CIA2_INTERRUPT_CONTROL]);
  if (form.wordAddress !== null) accesses.push([0xad, form.wordAddress]);
  if (form.mask === "memory") accesses.push([0x2d, MASK_ADDRESS]);
  accesses.push([0x8d, FLAG_ADDRESS]);
  return accesses;
}

/**
 * A delivered Boolean is the wrapper, one consuming read where the source names one,
 * one mask operation, the expert inline zero test, a folded constant load, a direct
 * store of the masked byte, or a single shift, and one direct store of the result.
 * Nothing is retained between the read and the store.
 */
function expectDeliveredBody(
  instructions: readonly HandlerInstruction[],
  form: PositiveForm,
): void {
  const expected = expectedInstructions(form);
  expect(instructions.map(({ opcode }) => opcode)).toEqual(expected.map(({ opcode }) => opcode));
  expected.forEach((instruction, index) => {
    if (instruction.opcode === 0xf0) return;
    expect(instructions[index]!.operand).toBe(instruction.operand);
  });

  // Exactly one zero branch for the nonzero-mask forms. It skips the nonzero arm:
  // `!=` lands on the store, and `==` lands on the inversion.
  const branches = instructions.filter(({ opcode }) => BRANCH_OPCODES.has(opcode));
  expect(branches).toHaveLength(form.branch ? 1 : 0);
  if (form.branch) {
    expect(branches[0]!.opcode).toBe(0xf0);
    const target = branchTarget(branches[0]!);
    const landing = instructions.find(({ start }) => start === target);
    if (landing === undefined) throw new Error("Branch target is not a published instruction");
    if (form.inverse) expect([landing.opcode, landing.operand]).toEqual([0x49, 0x01]);
    else expect([landing.opcode, landing.operand]).toEqual([0x8d, FLAG_ADDRESS]);
  }

  // Exactly one consuming read of the control register where the source names one.
  const deviceReads = instructions.filter(
    ({ opcode, operand }) => opcode === 0xad && operand === CIA2_INTERRUPT_CONTROL,
  );
  expect(deviceReads).toHaveLength(form.readsDevice ? 1 : 0);

  // One mask operation with the exact constant or the direct absolute mask load.
  const maskOperations = instructions.filter(({ opcode }) => opcode === 0x29 || opcode === 0x2d);
  expect(maskOperations).toHaveLength(form.mask === null ? 0 : 1);
  if (form.mask === "memory") expect(maskOperations[0]!.operand).toBe(MASK_ADDRESS);
  else if (form.mask !== null) expect(maskOperations[0]!.operand).toBe(form.mask);

  // The inversion belongs only to the `== 0` forms.
  expect(
    instructions.filter(({ opcode, operand }) => opcode === 0x49 && operand === 0x01),
  ).toHaveLength(form.inverse ? 1 : 0);

  // One store, directly to the placed flag.
  const stores = instructions.filter(({ opcode }) => STORE_OPCODES.has(opcode));
  expect(stores).toHaveLength(1);
  expect([stores[0]!.opcode, stores[0]!.operand]).toEqual([0x8d, FLAG_ADDRESS]);

  // No comparison, no addition, and no zero constant on the nonzero-mask forms.
  expect(instructions.filter(({ opcode }) => COMPARE_OPCODES.has(opcode))).toEqual([]);
  expect(instructions.filter(({ opcode }) => ADC_OPCODES.has(opcode))).toEqual([]);
  if (form.branch)
    expect(
      instructions.filter(({ opcode, operand }) => opcode === 0xa9 && operand === 0x00),
    ).toEqual([]);

  // The only absolute addresses touched are the named read, mask and flag, so no
  // retained byte gets a load or store and no second device read exists.
  expect(
    instructions
      .filter(({ operand }) => operand !== null && operand > 0xff)
      .map(({ opcode, operand }) => [opcode, operand]),
  ).toEqual(expectedAbsoluteAccesses(form));

  expect(instructions.at(-1)!.opcode).toBe(0x40);
  expect(instructions.at(-1)!.end - instructions[0]!.start).toBe(form.handlerBytes);
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
function expectPlacedGlobals(artifacts: Artifacts, symbols: readonly PlacedSymbol[]): void {
  const globals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => profileRecord(interval.owner).kind === "symbol",
  );
  expect(globals).toHaveLength(symbols.length);
  const ordered = [...globals].sort((left, right) => integer(left.start) - integer(right.start));
  symbols.forEach((symbol, index) => {
    expect(ordered[index]).toMatchObject({
      start: symbol.address,
      end: symbol.address + symbol.size,
      size: symbol.size,
      payloadBytes: symbol.size,
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
    expectPlacedGlobals(artifacts, form.placed);
    expectNoHandlerPrivateHome(artifacts);
    expectDeliveredBody(handlerInstructions(artifacts), form);
  });
}

describe.each(PROFILES)("materialized NMI Boolean masks on %s", (profile) => {
  it.each(POSITIVE_FORMS)(
    "should build $title without private storage",
    async (form) => {
      await buildDelivered(program(form.declaration, form.body), profile, form);
    },
    60_000,
  );
});

/** The shared form places the two Booleans it writes and nothing else. */
const FLAG_AND_SECOND: readonly PlacedSymbol[] = [
  { address: FLAG_ADDRESS, size: 1 },
  { address: SECOND_ADDRESS, size: 1 },
];

/** The five sampled bytes, read once each in source order. */
const SAMPLE_SOURCES: readonly number[] = [0x0400, 0x0401, 0x0402, 0x0403, 0x0404];
/** The five copy destinations, written once each in source order. */
const SAMPLE_TARGETS: readonly number[] = [0x0410, 0x0411, 0x0412, 0x0413, 0x0414];

/**
 * The masked value is shared by two consumers, so one byte is pushed once and both
 * comparisons read it back from the same stack slot.
 */
const SHARED_MASKED_VALUE = program(
  `${FLAG_DECLARATION}
place(at: $C001) let second: boolean = false;`,
  `    let m: byte = readAndClearPendingSources() & 3;
    finished = m != 0;
    second = m == 0;`,
);

/** Five sampled bytes stay live until five later copies have consumed them. */
const FIVE_RETAINED_SAMPLES = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function handler(): void {
    let a: byte = peek($0400);
    let b: byte = peek($0401);
    let c: byte = peek($0402);
    let d: byte = peek($0403);
    let e: byte = peek($0404);
    poke($0410, a);
    poke($0411, b);
    poke($0412, c);
    poke($0413, d);
    poke($0414, e);
}
function main(): void {
    setNMIExclusive(&handler);
    restoreNMI();
}`;

/** Narrow an untyped build result at the test boundary. */
function isBuildResult(value: unknown): value is BuildResult {
  if (value === null || typeof value !== "object") return false;
  const kind = Reflect.get(value, "kind");
  return kind === "success" || kind === "failure";
}

/**
 * Call the public build service with an explicit optimization mode. The static option
 * type does not yet name every runtime mode, so the mode travels through the same
 * runtime allowlist that the command line uses.
 */
async function buildWithMode(project: string, optimization: string): Promise<BuildResult> {
  const value: unknown = await Reflect.apply(buildProject, undefined, [{ project, optimization }]);
  if (!isBuildResult(value)) throw new TypeError("Expected a complete build result");
  return value;
}

/**
 * Build one retention witness and prove the storage boundary: the handler owns no
 * private data, the zero-page and scratch resources stay empty, and the reported
 * hardware-stack peak is the real one. Returns the decoded handler for shape checks.
 */
async function buildRetained(
  source: string,
  profile: string,
  hardwareStack: number,
  placed: readonly PlacedSymbol[],
  optimization: string = "none",
): Promise<HandlerInstruction[]> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildWithMode(project, optimization);
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(profileRecords(artifacts.build.artifacts).some(({ kind }) => kind === "primary")).toBe(
      true,
    );
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "zeroPage")).toBe(0);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "hardwareStack")).toBe(hardwareStack);
    expectPlacedGlobals(artifacts, placed);
    expectNoHandlerPrivateHome(artifacts);
    return handlerInstructions(artifacts);
  });
}

/** Count the handler instructions that use one opcode. */
function opcodeCount(instructions: readonly HandlerInstruction[], opcode: number): number {
  return instructions.filter((instruction) => instruction.opcode === opcode).length;
}

/** Resolve the published instruction a conditional branch reaches. */
function branchLanding(
  instructions: readonly HandlerInstruction[],
  branch: HandlerInstruction,
): HandlerInstruction {
  const target = branchTarget(branch);
  const landing = instructions.find(({ start }) => start === target);
  if (landing === undefined) throw new Error("Branch target is not a published instruction");
  return landing;
}

/**
 * Every absolute memory access in the handler, in emission order. Conditional
 * branches carry an eight-bit displacement, so they are not memory accesses.
 */
function absoluteAccesses(instructions: readonly HandlerInstruction[]): [number, number][] {
  const accesses: [number, number][] = [];
  for (const instruction of instructions) {
    if (instruction.opcode === 0xf0) continue;
    if (instruction.operand !== null && instruction.operand > 0xff)
      accesses.push([instruction.opcode, instruction.operand]);
  }
  return accesses;
}

/**
 * The wrapper saves A and X, the body pops one byte per retained slot, and the
 * wrapper then restores X with TAX and A with the final PLA before returning.
 */
function expectRestoreTail(instructions: readonly HandlerInstruction[], bodyPops: number): void {
  const tail = [...Array<number>(bodyPops + 1).fill(0x68), 0xaa, 0x68, 0x40];
  expect(instructions.slice(-tail.length).map(({ opcode }) => opcode)).toEqual(tail);
}

/**
 * The masked byte is pushed once and both comparisons load it back from the same
 * stack slot, so the device is read once, the mask is applied once, and no byte is
 * kept in RAM. The `!=` arm stores one; the `==` arm inverts before storing. The
 * X-register save exists because the body uses TSX, and that one stack-pointer read
 * serves both slot loads.
 */
function expectSharedMaskedValueBody(instructions: readonly HandlerInstruction[]): void {
  expect(opcodeCount(instructions, 0x48)).toBe(3);
  expect(opcodeCount(instructions, 0x68)).toBe(3);
  expect(opcodeCount(instructions, 0xba)).toBe(1);
  expect(opcodeCount(instructions, 0xaa)).toBe(1);
  expect(opcodeCount(instructions, 0xd8)).toBe(1);
  expect(opcodeCount(instructions, 0x49)).toBe(1);

  // One consuming device read and exactly one mask operation with the constant three.
  const deviceReads = instructions.filter(
    ({ opcode, operand }) => opcode === 0xad && operand === CIA2_INTERRUPT_CONTROL,
  );
  expect(deviceReads).toHaveLength(1);
  const masks = instructions.filter(({ opcode }) => opcode === 0x29 || opcode === 0x2d);
  expect(masks).toHaveLength(1);
  expect(masks[0]!.operand).toBe(0x03);

  // The masked value is pushed immediately after the mask; the wrapper's two saves
  // happened before the device read.
  const maskIndex = instructions.indexOf(masks[0]!);
  expect(instructions[maskIndex + 1]!.opcode).toBe(0x48);
  const pushIndexes = instructions
    .map((instruction, index) => ({ instruction, index }))
    .filter(({ instruction }) => instruction.opcode === 0x48)
    .map(({ index }) => index);
  expect(pushIndexes.filter((index) => index < maskIndex)).toHaveLength(2);

  // Two loads of the one retained slot, each immediately followed by its zero branch.
  // The stack pointer is read into X once, immediately before the first load, and the
  // second load reuses that X: an expert would not re-read SP between two loads.
  const branches = instructions.filter(({ opcode }) => opcode === 0xf0);
  expect(branches).toHaveLength(2);
  expect(instructions.filter(({ opcode }) => BRANCH_OPCODES.has(opcode))).toHaveLength(2);
  for (const branch of branches) {
    const index = instructions.indexOf(branch);
    expect([instructions[index - 1]!.opcode, instructions[index - 1]!.operand]).toEqual([
      0xbd, 0x0101,
    ]);
  }
  const slotLoads = instructions.filter(({ opcode }) => opcode === 0xbd);
  expect(slotLoads.map(({ operand }) => operand)).toEqual([0x0101, 0x0101]);
  const stackPointerRead = instructions.findIndex(({ opcode }) => opcode === 0xba);
  expect(stackPointerRead + 1).toBe(instructions.indexOf(slotLoads[0]!));

  // The `!=` branch skips only the store of one; the `==` branch lands on the
  // inversion that turns the loaded one into zero.
  expect([
    branchLanding(instructions, branches[0]!).opcode,
    branchLanding(instructions, branches[0]!).operand,
  ]).toEqual([0x8d, FLAG_ADDRESS]);
  expect([
    branchLanding(instructions, branches[1]!).opcode,
    branchLanding(instructions, branches[1]!).operand,
  ]).toEqual([0x49, 0x01]);
  expect(
    instructions.filter(({ opcode, operand }) => opcode === 0xa9 && operand === 0x01),
  ).toHaveLength(2);

  // The inverted value is stored straight away, with no further arithmetic.
  const inversion = instructions.findIndex(
    ({ opcode, operand }) => opcode === 0x49 && operand === 0x01,
  );
  expect([instructions[inversion + 1]!.opcode, instructions[inversion + 1]!.operand]).toEqual([
    0x8d,
    SECOND_ADDRESS,
  ]);

  // Exactly the two placed Booleans are stored, in source order.
  const stores = instructions.filter(({ opcode }) => STORE_OPCODES.has(opcode));
  expect(stores.map(({ opcode, operand }) => [opcode, operand])).toEqual([
    [0x8d, FLAG_ADDRESS],
    [0x8d, SECOND_ADDRESS],
  ]);

  // One device read, two slot reads of the same offset, and the two stores: no other
  // RAM address is touched, so the retained byte has no private home.
  expect(absoluteAccesses(instructions)).toEqual([
    [0xad, CIA2_INTERRUPT_CONTROL],
    [0xbd, 0x0101],
    [0x8d, FLAG_ADDRESS],
    [0xbd, 0x0101],
    [0x8d, SECOND_ADDRESS],
  ]);
  expect(instructions.filter(({ opcode }) => COMPARE_OPCODES.has(opcode))).toEqual([]);
  expect(instructions.filter(({ opcode }) => ADC_OPCODES.has(opcode))).toEqual([]);

  expectRestoreTail(instructions, 1);
  expect(instructions.at(-1)!.opcode).toBe(0x40);
}

/**
 * Five sampled bytes are pushed once each and read back from five distinct stack
 * slots, deepest first, so every copy reads its own sample and no sample is kept in
 * RAM. One stack-pointer read turns SP into X for the whole run of slot reads. The
 * handler contains no comparison, hence no branch.
 */
function expectFiveSampleBody(instructions: readonly HandlerInstruction[]): void {
  expect(opcodeCount(instructions, 0x48)).toBe(7);
  expect(opcodeCount(instructions, 0x68)).toBe(7);
  expect(opcodeCount(instructions, 0xba)).toBe(1);
  expect(opcodeCount(instructions, 0xaa)).toBe(1);
  expect(opcodeCount(instructions, 0xd8)).toBe(1);
  expect(instructions.filter(({ opcode }) => BRANCH_OPCODES.has(opcode))).toEqual([]);

  // Each sample is read once, in source order.
  const sampleReads = instructions.filter(
    ({ opcode, operand }) =>
      opcode === 0xad && operand !== null && SAMPLE_SOURCES.includes(operand),
  );
  expect(sampleReads.map(({ operand }) => operand)).toEqual([...SAMPLE_SOURCES]);

  // Five slot reads with five distinct offsets: the first pushed sample is deepest.
  // A single stack-pointer read immediately before the first read establishes X, and
  // every following read reuses it instead of re-reading SP.
  const slotLoads = instructions.filter(({ opcode }) => opcode === 0xbd);
  expect(slotLoads.map(({ operand }) => operand)).toEqual([0x0105, 0x0104, 0x0103, 0x0102, 0x0101]);
  const stackPointerRead = instructions.findIndex(({ opcode }) => opcode === 0xba);
  expect(stackPointerRead + 1).toBe(instructions.indexOf(slotLoads[0]!));

  // Each slot read feeds one copy store, in the same order.
  const stores = instructions.filter(({ opcode }) => STORE_OPCODES.has(opcode));
  expect(stores.map(({ opcode, operand }) => [opcode, operand])).toEqual(
    SAMPLE_TARGETS.map((target) => [0x8d, target]),
  );

  // All five pushes precede the first slot read: the samples are retained before use.
  const lastPush = instructions.reduce(
    (last, instruction, index) => (instruction.opcode === 0x48 ? index : last),
    -1,
  );
  expect(lastPush).toBeLessThan(instructions.indexOf(slotLoads[0]!));

  expect(absoluteAccesses(instructions)).toEqual([
    ...SAMPLE_SOURCES.map((address): [number, number] => [0xad, address]),
    ...SAMPLE_TARGETS.flatMap((target, index): [number, number][] => [
      [0xbd, 0x0105 - index],
      [0x8d, target],
    ]),
  ]);

  expectRestoreTail(instructions, 5);
  expect(instructions.at(-1)!.opcode).toBe(0x40);
}

describe.each(PROFILES)("bounded NMI stack retention on %s", (profile) => {
  it("should retain one masked byte shared by two consumers", async () => {
    const instructions = await buildRetained(SHARED_MASKED_VALUE, profile, 6, FLAG_AND_SECOND);
    expectSharedMaskedValueBody(instructions);
  }, 60_000);

  it("should retain five sampled bytes across five later copies", async () => {
    const instructions = await buildRetained(FIVE_RETAINED_SAMPLES, profile, 10, []);
    expectFiveSampleBody(instructions);
  }, 60_000);
});

/** One cooperative profile is enough to cover the default optimization mode. */
const DEFAULT_MODE_PROFILE = "c64-pal-prg-kernal-6581";

/**
 * The default optimization mode must not need private storage and must keep the
 * expert retention shape: one stack-pointer read reused by the shared slot loads.
 */
describe(`bounded NMI stack retention in the default mode on ${DEFAULT_MODE_PROFILE}`, () => {
  it("should retain one masked byte shared by two consumers", async () => {
    const instructions = await buildRetained(
      SHARED_MASKED_VALUE,
      DEFAULT_MODE_PROFILE,
      6,
      FLAG_AND_SECOND,
      "balanced",
    );
    expectSharedMaskedValueBody(instructions);
  }, 60_000);
});

/** A word mask whose high byte can be nonzero needs two masked bytes and a join. */
const WIDE_WORD_MASK = program(
  `${FLAG_DECLARATION}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 258) != 0);",
);

/** A mask computed at run time has no address the handler can read directly. */
const COMPUTED_RUNTIME_MASK = program(
  `${FLAG_DECLARATION}
place(at: $C001) let maskValue: byte = 1;`,
  `    let m: byte = maskValue | 1;
    finished = ((readAndClearPendingSources() & m) != 0);`,
);

/** Comparing the masked byte with a nonzero constant needs that masked byte kept. */
const MASKED_VALUE_AGAINST_EIGHT = program(
  FLAG_DECLARATION,
  "    finished = ((readAndClearPendingSources() & 8) == 8);",
);

/** Nine retained bytes exceed the bounded proof, which admits at most eight. */
const NINE_RETAINED_SAMPLES = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function handler(): void {
    let a0: byte = peek($0400);
    let a1: byte = peek($0401);
    let a2: byte = peek($0402);
    let a3: byte = peek($0403);
    let a4: byte = peek($0404);
    let a5: byte = peek($0405);
    let a6: byte = peek($0406);
    let a7: byte = peek($0407);
    let a8: byte = peek($0408);
    poke($0410, a0);
    poke($0411, a1);
    poke($0412, a2);
    poke($0413, a3);
    poke($0414, a4);
    poke($0415, a5);
    poke($0416, a6);
    poke($0417, a7);
    poke($0418, a8);
}
function main(): void {
    setNMIExclusive(&handler);
    restoreNMI();
}`;

/**
 * A branch splits the handler into several blocks, so the sampled byte would have to
 * survive the join in memory. The retention proof covers one straight-line block only.
 */
const SAMPLE_ACROSS_BRANCH = program(
  FLAG_DECLARATION,
  `    let sample: byte = readAndClearPendingSources();
    if ((sample & 1) != 0) {
        finished = true;
    }
    finished = sample != 0;`,
);

/** Both services must reject with the canonical diagnostic and publish nothing. */
async function expectRejected(source: string, profile: string): Promise<void> {
  await withProfileProject(source, profile, async (project, root) => {
    const results: readonly (BuildResult | CheckResult)[] = [
      await checkProject({ project }),
      await buildProject({ project, optimization: "none" }),
    ];
    const handlerStart = Buffer.byteLength(
      source.slice(0, source.indexOf("interrupt function handler")),
    );
    for (const result of results) {
      expect(result.kind).toBe("failure");
      expect(result).not.toHaveProperty("generation");
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      expect(errors[0]!.message).toMatch(NMI_PRIVATE_STORAGE_MESSAGE);
      const span = errors[0]!.primarySpan;
      expect(span?.sourceId).toBe("src/game.blend");
      expect(span!.start).toBeGreaterThanOrEqual(handlerStart);
      expect(span!.end).toBeLessThanOrEqual(Buffer.byteLength(source));
      expect(span!.start).toBeLessThan(span!.end);
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

/** Width, mask-address, comparison and proof-scope limits still need private storage. */
describe.each(PROFILES)("residual NMI mask rejection on %s", (profile) => {
  it("should reject a word mask with a possibly-nonzero high byte", async () => {
    await expectRejected(WIDE_WORD_MASK, profile);
  }, 60_000);

  it("should reject a runtime-computed mask that has no address", async () => {
    await expectRejected(COMPUTED_RUNTIME_MASK, profile);
  }, 60_000);

  it("should reject a masked value compared with a nonzero constant", async () => {
    await expectRejected(MASKED_VALUE_AGAINST_EIGHT, profile);
  }, 60_000);

  it("should reject nine simultaneously retained sampled bytes", async () => {
    await expectRejected(NINE_RETAINED_SAMPLES, profile);
  }, 60_000);

  it("should reject a sampled byte retained across a branch join", async () => {
    await expectRejected(SAMPLE_ACROSS_BRANCH, profile);
  }, 60_000);
});
