import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import type { BuildResult } from "@blend65/compiler";
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

/** The delivered flag and helper globals have fixed, documented addresses. */
const FLAG_ADDRESS = 0xc000;
const OUTPUT_ADDRESS = 0xc001;
const WORD_ADDRESS = 0xc100;
const SAMPLE_INPUT = 0x0400;
const SAMPLE_OUTPUT = 0x0410;
/** CIA2 interrupt control register; one read consumes the event. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** The installed exclusive NMI handler under test. */
const HANDLER = "src/game.blend::Game.handler";

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The imports every handler uses. */
const IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;`;

/** One placed Boolean flag used by every single-flag form. */
const FLAG = "place(at: $C000) let finished: boolean = false;";

/** Build one handler witness whose body is the only variable. */
function program(declaration: string, body: string, helper = ""): string {
  return `${IMPORTS}
${declaration}
${helper}interrupt function handler(): void {
${body}
}
function main(): void {
    setNMIExclusive(&handler);
    restoreNMI();
}`;
}

/** One emitted handler instruction decoded from published debug ranges. */
interface DecodedInstruction {
  readonly start: number;
  readonly end: number;
  readonly length: number;
  readonly opcode: number;
  readonly operand: number | null;
}

/** Documented one-byte NMOS 6510 opcodes (implied or accumulator forms). */
const ONE_BYTE = new Set([
  0x00, 0x08, 0x0a, 0x18, 0x28, 0x2a, 0x38, 0x40, 0x48, 0x4a, 0x58, 0x60, 0x68, 0x6a, 0x78, 0x88,
  0x8a, 0x98, 0x9a, 0xa8, 0xaa, 0xb8, 0xba, 0xc8, 0xca, 0xd8, 0xe8, 0xea, 0xf8,
]);
/** Documented two-byte NMOS 6510 opcodes (immediate, zero-page or relative). */
const TWO_BYTE = new Set([
  0x01, 0x05, 0x06, 0x09, 0x10, 0x11, 0x15, 0x16, 0x21, 0x24, 0x25, 0x26, 0x29, 0x30, 0x31, 0x35,
  0x36, 0x41, 0x45, 0x46, 0x49, 0x50, 0x51, 0x55, 0x56, 0x61, 0x65, 0x66, 0x69, 0x70, 0x71, 0x75,
  0x76, 0x81, 0x84, 0x85, 0x86, 0x90, 0x91, 0x94, 0x95, 0x96, 0xa0, 0xa1, 0xa2, 0xa4, 0xa5, 0xa6,
  0xa9, 0xb0, 0xb1, 0xb5, 0xb6, 0xc0, 0xc1, 0xc4, 0xc5, 0xc6, 0xc9, 0xd0, 0xd1, 0xd5, 0xd6, 0xe0,
  0xe1, 0xe4, 0xe5, 0xe6, 0xe9, 0xf0, 0xf1, 0xf5, 0xf6,
]);

/** Return the documented encoded length of one opcode byte. */
function instructionLength(opcode: number): number {
  if (ONE_BYTE.has(opcode)) return 1;
  if (TWO_BYTE.has(opcode)) return 2;
  return 3;
}

/** Require a nonnegative integer in published evidence. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative integer in generated evidence");
  return value;
}

/** Read one byte range from the published primary artifact copy. */
function bytesAt(artifacts: Artifacts, start: number, end: number): number[] {
  const load = artifacts.prg.readUInt16LE(0);
  expect(start).toBeGreaterThanOrEqual(load);
  expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
  return [...artifacts.prg.subarray(start - load + 2, end - load + 2)];
}

/** Decode every published handler instruction in emission order. */
function decodeHandler(artifacts: Artifacts): readonly DecodedInstruction[] {
  const functions = profileRecords(artifacts.debug.functions);
  const fn = functions.find((entry) => entry.qualifiedName === HANDLER);
  if (fn === undefined) throw new Error("Missing handler debug function");
  const variants = profileRecords(fn.entryVariants);
  expect(variants).toHaveLength(1);
  const rangeIndexes = (variants[0]!.rangeIndexes as unknown[]).map(integer);
  const ranges = profileRecords(artifacts.debug.ranges);
  const instructions = rangeIndexes
    .flatMap((rangeIndex) => {
      const machine = profileRecord(ranges[rangeIndex]!.machine);
      const start = integer(machine.start);
      const end = integer(machine.end);
      const bytes = bytesAt(artifacts, start, end);
      const decoded: {
        start: number;
        end: number;
        length: number;
        opcode: number;
        operand: number | null;
      }[] = [];
      let offset = 0;
      while (offset < bytes.length) {
        const opcode = bytes[offset]!;
        const length = instructionLength(opcode);
        if (offset + length > bytes.length)
          throw new Error("Published debug range ends inside an instruction");
        const operand =
          length === 1
            ? null
            : length === 2
              ? bytes[offset + 1]!
              : bytes[offset + 1]! | (bytes[offset + 2]! << 8);
        decoded.push({
          start: start + offset,
          end: start + offset + length,
          length,
          opcode,
          operand,
        });
        offset += length;
      }
      return decoded;
    })
    .sort((left, right) => left.start - right.start);
  // The published operation ranges must tile the complete handler interval.
  const code = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === HANDLER;
  });
  expect(code).toHaveLength(1);
  expect(instructions[0]!.start).toBe(integer(code[0]!.start));
  expect(instructions.at(-1)!.end).toBe(integer(code[0]!.end));
  return instructions.map(({ start, end, length, opcode, operand }) =>
    Object.freeze({ start, end, length, opcode, operand }),
  );
}

/** Documented 6510 cycle counts for the instructions these handlers emit. */
function instructionCycles(opcode: number): number {
  switch (opcode) {
    case 0x48:
      return 3; // PHA
    case 0x68:
      return 4; // PLA
    case 0xba:
      return 2; // TSX
    case 0x8a:
      return 2; // TXA
    case 0xaa:
      return 2; // TAX
    case 0x9a:
      return 2; // TXS
    case 0x18:
      return 2; // CLC
    case 0xd8:
      return 2; // CLD
    case 0x4a:
      return 2; // LSR A
    case 0x0a:
      return 2; // ASL A
    case 0x2a:
      return 2; // ROL A
    case 0xea:
      return 2; // NOP
    case 0x60:
      return 6; // RTS
    case 0x40:
      return 6; // RTI
    case 0x20:
      return 6; // JSR abs
    case 0x4c:
      return 3; // JMP abs
    case 0xa9:
      return 2; // LDA #
    case 0xad:
      return 4; // LDA abs
    case 0xbd:
      return 4; // LDA abs,X
    case 0x29:
      return 2; // AND #
    case 0x2d:
      return 4; // AND abs
    case 0x3d:
      return 4; // AND abs,X
    case 0x09:
      return 2; // ORA #
    case 0x0d:
      return 4; // ORA abs
    case 0x49:
      return 2; // EOR #
    case 0xc9:
      return 2; // CMP #
    case 0x69:
      return 2; // ADC #
    case 0x8d:
      return 4; // STA abs
    case 0x9d:
      return 5; // STA abs,X
    default:
      if ([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0].includes(opcode)) return 2;
      throw new Error(`No documented cycle count for opcode ${opcode.toString(16)}`);
  }
}

/** Return the maximum handler path from its first instruction to RTI. */
function maxPathCycles(instructions: readonly DecodedInstruction[]): number {
  const byStart = new Map(instructions.map((instruction) => [instruction.start, instruction]));
  const memo = new Map<number, number>();
  const visit = (start: number): number => {
    const cached = memo.get(start);
    if (cached !== undefined) return cached;
    const instruction = byStart.get(start);
    if (instruction === undefined) throw new Error(`Missing instruction at ${start.toString(16)}`);
    const next = start + instruction.length;
    let value: number;
    if (instruction.opcode === 0x40 || instruction.opcode === 0x60) {
      value = instructionCycles(instruction.opcode);
    } else if (instruction.opcode === 0x4c) {
      value = 3 + visit(instruction.operand!);
    } else if ([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0].includes(instruction.opcode)) {
      const displacement =
        (instruction.operand! & 0x80) !== 0 ? instruction.operand! - 0x100 : instruction.operand!;
      const target = start + 2 + displacement;
      value = Math.max(3 + visit(target), 2 + visit(next));
    } else {
      value = instructionCycles(instruction.opcode) + visit(next);
    }
    memo.set(start, value);
    return value;
  };
  return visit(instructions[0]!.start);
}

/** One standard resource total from published cost evidence. */
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

/** Build one delivered form and prove the storage boundary and exact emitted shape. */
async function buildForm(
  source: string,
  profile: string,
  hardwareStack: number,
  handlerBytes: number,
  optimization: "none" | "balanced" = "none",
): Promise<readonly DecodedInstruction[]> {
  return withProfileProject(source, profile, async (project) => {
    const built: BuildResult = await buildProject({ project, optimization });
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
    expectNoHandlerPrivateHome(artifacts);
    const instructions = decodeHandler(artifacts);
    const bytes = instructions.reduce(
      (sum, instruction) => sum + instructionLength(instruction.opcode),
      0,
    );
    expect(bytes).toBe(handlerBytes);
    return instructions;
  });
}

/** Count one opcode in the decoded handler. */
function count(instructions: readonly DecodedInstruction[], opcode: number): number {
  return instructions.filter((instruction) => instruction.opcode === opcode).length;
}

/** Index of the first instruction with one opcode and operand. */
function find(
  instructions: readonly DecodedInstruction[],
  opcode: number,
  operand: number,
): number {
  const index = instructions.findIndex(
    (instruction) => instruction.opcode === opcode && instruction.operand === operand,
  );
  expect(index, `${opcode.toString(16)} ${operand.toString(16)}`).toBeGreaterThanOrEqual(0);
  return index;
}

/** A word mask with a possibly-nonzero high byte joins both masked bytes. */
const WIDE_WORD_MASK = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 258) != 0);",
);

/** The inverse join materializes the zero result without a temporary. */
const WIDE_WORD_ZERO = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 258) == 0);",
);

/** A word mask compared with a general nonzero constant tests both bytes. */
const WIDE_WORD_GENERAL_EQUAL = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 258) == 258);",
);

/** The inverse general word comparison swaps the true and false arms. */
const WIDE_WORD_GENERAL_NOT_EQUAL = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 258) != 258);",
);

/** A multi-bit-per-byte mask uses the two-byte branch join. */
const WIDE_MULTI = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 771) != 0);",
);

/** A multi-bit word constant uses one CMP per masked byte. */
const WIDE_MULTI_GENERAL = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 771) == 771);",
);

/** A mask confined to the high byte is the high byte's own masked value. */
const WIDE_HIGH_ONLY = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 256) != 0);",
);

/** The high byte equal to its mask is the same bit-set test. */
const WIDE_HIGH_ONLY_EQUAL = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 256) == 256);",
);

/** The high byte compared with a general nonzero high constant. */
const WIDE_HIGH_ONLY_GENERAL = program(
  `${FLAG}
place(at: $C100) let w: word = 2;`,
  "    finished = ((w & 768) == 256);",
);

/** A constant local can fold a selected nonzero comparison; it must not ICE. */
const CONSTANT_NONZERO_LOCAL = program(
  FLAG,
  `    let x: byte = 5;
    finished = ((x & 8) == 8);`,
);

/** A masked byte compared with a general nonzero constant uses CMP, not a home. */
const GENERAL_MASKED_COMPARISON = program(
  FLAG,
  "    finished = ((readAndClearPendingSources() & 3) == 1);",
);

/** A computed mask has no address, so the handler retains it on its own stack. */
const COMPUTED_MASK = program(
  `${FLAG}
place(at: $C001) let maskValue: byte = 1;`,
  `    let m: byte = maskValue | 1;
    finished = ((readAndClearPendingSources() & m) != 0);`,
);

/** A masked value compared with a nonzero constant keeps only the masked byte. */
const NONZERO_COMPARISON = program(
  FLAG,
  "    finished = ((readAndClearPendingSources() & 8) == 8);",
);

/** Nine samples need nine stack bytes; the platform capacity is the bound. */
const NINE_SAMPLES = program(
  FLAG,
  [
    ...Array.from({ length: 9 }, (_, index) => `    let x${index}: byte = peek($040${index});`),
    ...Array.from({ length: 9 }, (_, index) => `    poke($041${index}, x${index});`),
  ].join("\n"),
);

/** A call after the final retained output must not reuse the cached X base. */
const NINE_SAMPLES_THEN_CALL = program(
  `place(at: $C004) let marker: byte = 0;`,
  [
    ...Array.from({ length: 9 }, (_, index) => `    let x${index}: byte = peek($040${index});`),
    ...Array.from({ length: 9 }, (_, index) => `    poke($041${index}, x${index});`),
    "    helper();",
  ].join("\n"),
  `function helper(): word {
    marker = $5A;
    return $1200;
}
`,
);

/** A branch join must agree on the live push count and keep the same slot. */
const CROSS_JOIN = program(
  `place(at: $C000) let flag: boolean = false;
place(at: $C001) let out: byte = 0;`,
  `    let sample: byte = readAndClearPendingSources();
    if (flag) {
        out = sample;
    } else {
        out = 0;
    }
    poke($0410, sample);`,
);

/** A stack-balanced call does not change SP at the load, but may change X. */
const CALL_RETENTION = program(
  `place(at: $C001) let out: byte = 0;`,
  `    let sample: byte = readAndClearPendingSources();
    helper();
    poke($0410, sample);`,
  `function helper(): void {
    out = 7;
}
`,
);

/** Pushes excluding the wrapper's A save; the body pop is counted separately. */
function expectRestoreTail(instructions: readonly DecodedInstruction[], bodyPops: number): void {
  const rti = instructions.findIndex(({ opcode }) => opcode === 0x40);
  expect(rti).toBeGreaterThanOrEqual(0);
  // A body that reads SP saves X; every other body restores only A.
  const tail =
    count(instructions, 0xba) > 0
      ? [...Array<number>(bodyPops + 1).fill(0x68), 0xaa, 0x68, 0x40]
      : [...Array<number>(bodyPops + 1).fill(0x68), 0x40];
  expect(instructions.slice(rti + 1 - tail.length, rti + 1).map(({ opcode }) => opcode)).toEqual(
    tail,
  );
}

describe.each(PROFILES)("residual NMI form delivery on %s", (profile) => {
  /**
   * Expert branch: low masked byte, high masked byte, and a join. No two-byte
   * temporary exists. 23 bytes; path-max 23 cycles (low zero, high nonzero).
   */
  it("should align both selected word-mask bits without a branch", async () => {
    const instructions = await buildForm(WIDE_WORD_MASK, profile, 4, 16);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(31);
    expect(count(instructions, 0x48)).toBe(1);
    expect(count(instructions, 0x68)).toBe(1);
    expect(count(instructions, 0xba)).toBe(0);
    expect(count(instructions, 0x2d)).toBe(0);
    // Low byte in A, one LSR aligns its selected bit, ORA brings in the high
    // byte's selected bit, AND #1 normalizes, store. No branch, no temp.
    expect(find(instructions, 0xad, WORD_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x4a)).toBeGreaterThanOrEqual(1);
    expect(find(instructions, 0x0d, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x01)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x8d, FLAG_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(instructions.filter(({ opcode }) => opcode === 0xd0 || opcode === 0xf0)).toHaveLength(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /**
   * The mask is computed in A, pushed once, and consumed as `AND absolute,X`
   * after the single volatile read. 29 bytes; 32 body path-max cycles.
   */
  it("should retain a computed mask on the handler stack", async () => {
    const instructions = await buildForm(COMPUTED_MASK, profile, 6, 29);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(57);
    expect(count(instructions, 0x48)).toBe(3);
    expect(count(instructions, 0x68)).toBe(3);
    expect(count(instructions, 0xba)).toBe(1);
    expect(count(instructions, 0xaa)).toBe(1);
    // One mask computation, one volatile read, one stack-operand AND.
    expect(find(instructions, 0xad, OUTPUT_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x09, 0x01)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0xad, CIA2_INTERRUPT_CONTROL)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x3d, 0x0101)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x29)).toBe(0);
    expectRestoreTail(instructions, 1);
  }, 60_000);

  /**
   * `(x & 8) == 8` is the bit test itself, not a redundant CMP. 16 bytes;
   * path-max 14 cycles when the bit is set.
   */
  it("should materialize a masked value compared with its own single bit", async () => {
    const instructions = await buildForm(NONZERO_COMPARISON, profile, 4, 16);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(29);
    expect(count(instructions, 0xc9)).toBe(0);
    expect(find(instructions, 0x29, 0x08)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0xad, CIA2_INTERRUPT_CONTROL)).toBeGreaterThanOrEqual(0);
    const andIndex = find(instructions, 0x29, 0x08);
    expect(instructions[andIndex + 1]!.opcode).toBe(0xf0);
    expect(instructions[andIndex + 2]).toMatchObject({ opcode: 0xa9, operand: 1 });
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** The inverse wide join adds the splitter's shared `EOR #1` arm. */
  it("should materialize the zero result of a wide word mask", async () => {
    const instructions = await buildForm(WIDE_WORD_ZERO, profile, 4, 18);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(33);
    expect(find(instructions, 0xad, WORD_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x0d, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x49, 1)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x49)).toBe(1);
    expect(count(instructions, 0x4a)).toBe(1);
    expect(count(instructions, 0x48)).toBe(1);
    expect(count(instructions, 0x68)).toBe(1);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** A multi-bit mask keeps the two-byte branch join. */
  it("should join both bytes of a multi-bit word mask", async () => {
    const instructions = await buildForm(WIDE_MULTI, profile, 4, 23);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(37);
    expect(find(instructions, 0xad, WORD_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0xad, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(
      instructions.filter(({ opcode, operand }) => opcode === 0x29 && operand === 3),
    ).toHaveLength(2);
    expect(count(instructions, 0xd0)).toBe(1);
    expect(count(instructions, 0xf0)).toBe(1);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  it("should test a multi-bit word constant with one CMP per byte", async () => {
    const instructions = await buildForm(WIDE_MULTI_GENERAL, profile, 4, 31);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(45);
    expect(
      instructions.filter(({ opcode, operand }) => opcode === 0xc9 && operand === 3),
    ).toHaveLength(2);
    expect(find(instructions, 0xa9, 0)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0xa9, 1)).toBeGreaterThanOrEqual(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** A high-byte-only mask needs no low load or join. */
  it("should test a mask confined to the word's high byte", async () => {
    const instructions = await buildForm(WIDE_HIGH_ONLY, profile, 4, 16);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(29);
    expect(find(instructions, 0xad, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x01)).toBeGreaterThanOrEqual(0);
    expect(
      instructions.filter(({ opcode, operand }) => opcode === 0xad && operand === WORD_ADDRESS),
    ).toEqual([]);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  it("should treat the high mask value as the bit-set test", async () => {
    const instructions = await buildForm(WIDE_HIGH_ONLY_EQUAL, profile, 4, 16);
    expect(find(instructions, 0xad, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x01)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0xa9, 1)).toBeGreaterThanOrEqual(0);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(29);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  it("should compare a general high-byte constant without a home", async () => {
    const instructions = await buildForm(WIDE_HIGH_ONLY_GENERAL, profile, 4, 20);
    expect(find(instructions, 0xad, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x03)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x49, 1)).toBeGreaterThanOrEqual(0);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(33);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  it("should fold a constant-local nonzero comparison without an ICE", async () => {
    const instructions = await buildForm(CONSTANT_NONZERO_LOCAL, profile, 4, 9);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(21);
    expect(count(instructions, 0xa9)).toBe(1);
    expect(find(instructions, 0xa9, 0)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x29)).toBe(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** A general nonzero constant is the expert CMP followed by the same branch. */
  it("should materialize a general masked comparison with CMP", async () => {
    const instructions = await buildForm(GENERAL_MASKED_COMPARISON, profile, 4, 20);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(33);
    expect(find(instructions, 0x29, 0x03)).toBeGreaterThanOrEqual(0);
    // EOR, not CMP: equality must leave A=0 for the shared zero-test arms.
    const andIndex = find(instructions, 0x29, 0x03);
    expect(instructions[andIndex + 1]).toMatchObject({ opcode: 0x49, operand: 1 });
    expect(instructions[andIndex + 2]!.opcode).toBe(0xf0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** A general word constant needs one CMP per masked byte and two 0/1 arms. */
  it("should require both selected bits for the general word constant", async () => {
    const instructions = await buildForm(WIDE_WORD_GENERAL_EQUAL, profile, 4, 16);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(31);
    expect(find(instructions, 0xad, WORD_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x2d, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x01)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0xc9)).toBe(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  it("should invert the aligned general word comparison", async () => {
    const instructions = await buildForm(WIDE_WORD_GENERAL_NOT_EQUAL, profile, 4, 18);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(33);
    expect(find(instructions, 0x2d, WORD_ADDRESS + 1)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x29, 0x01)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x49, 1)).toBeGreaterThanOrEqual(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** Nine pushes, one SP read and nine distinct slots; 108 bytes, peak 14. */
  it("should retain nine sampled bytes and pop every one", async () => {
    const instructions = await buildForm(NINE_SAMPLES, profile, 14, 103);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(173);
    expect(count(instructions, 0x48)).toBe(11);
    // The final sample is consumed with PLA; the eight dead slots are removed
    // with TXA/CLC/ADC #9/TAX/TXS instead of eight PLA instructions.
    expect(count(instructions, 0x68)).toBe(3);
    expect(count(instructions, 0xba)).toBe(1);
    expect(count(instructions, 0x8a)).toBe(2);
    expect(count(instructions, 0x18)).toBe(1);
    expect(find(instructions, 0x69, 9)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x9a)).toBe(1);
    const slots = instructions
      .filter(({ opcode }) => opcode === 0xbd)
      .map(({ operand }) => operand);
    expect(slots).toEqual([0x0109, 0x0108, 0x0107, 0x0106, 0x0105, 0x0104, 0x0103, 0x0102]);
    for (let index = 0; index < 9; index += 1) {
      expect(find(instructions, 0xad, SAMPLE_INPUT + index)).toBeGreaterThanOrEqual(0);
      expect(find(instructions, 0x8d, SAMPLE_OUTPUT + index)).toBeGreaterThanOrEqual(0);
    }
    expectRestoreTail(instructions, 0);
  }, 120_000);

  /** The sample crosses an if/else join and both arms reach one pop count. */
  it("should retain one sample across a control-flow join", async () => {
    const instructions = await buildForm(CROSS_JOIN, profile, 6, 36);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(61);
    // One device read and one push before the branch. The then-arm re-reads SP;
    // the join's final top-slot use is a PLA.
    expect(find(instructions, 0xad, CIA2_INTERRUPT_CONTROL)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0xba)).toBe(1);
    expect(count(instructions, 0xbd)).toBe(1);
    expect(find(instructions, 0xbd, 0x0101)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x68)).toBe(3);
    // The then-arm stores the sample; the join pokes it.
    expect(find(instructions, 0x8d, OUTPUT_ADDRESS)).toBeGreaterThanOrEqual(0);
    expect(find(instructions, 0x8d, SAMPLE_OUTPUT)).toBeGreaterThanOrEqual(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);

  /** A call after the final consume invalidates the cached X bulk base. */
  it("should rebase the bulk cleanup after a clobbering call", async () => {
    const instructions = await buildForm(NINE_SAMPLES_THEN_CALL, profile, 16, 107);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(181);
    // The call invalidated the cached X base; the return re-reads SP and adds
    // the remaining eight slots instead of using the callee's X.
    expect(count(instructions, 0x9a)).toBe(1);
    expect(find(instructions, 0x69, 8)).toBeGreaterThanOrEqual(0);
    expect(count(instructions, 0x68)).toBe(3);
    expect(count(instructions, 0x20)).toBe(1);
  }, 60_000);

  /** A balanced call restores SP; the load re-reads SP because the callee used X. */
  it("should retain one sample across a stack-balanced call", async () => {
    // Peak is the CPU frame, the A save, the retained byte and the JSR return.
    const instructions = await buildForm(CALL_RETENTION, profile, 7, 15);
    expect(maxPathCycles(instructions), "static handler path-max").toBe(36);
    expect(count(instructions, 0x20)).toBe(1);
    const callIndex = instructions.findIndex(({ opcode }) => opcode === 0x20);
    // The final top-slot use is PLA: no TSX, no X save, no return pop.
    expect(instructions[callIndex + 1]!.opcode).toBe(0x68);
    expect(instructions[callIndex + 2]).toMatchObject({ opcode: 0x8d, operand: SAMPLE_OUTPUT });
    expect(count(instructions, 0xba)).toBe(0);
    expect(count(instructions, 0xaa)).toBe(0);
    expectRestoreTail(instructions, 0);
  }, 60_000);
});

/**
 * Build one witness in the default mode and prove the storage boundary only.
 * The optimizer can legitimately change instruction selection, so this matrix
 * does not pin the exact bytes; the `none` matrix above does.
 */
async function buildFormStorage(
  source: string,
  profile: string,
  hardwareStack: number,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built: BuildResult = await buildProject({ project, optimization: "balanced" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const totals = profileRecord(artifacts.costs.totals);
    expect(resource(totals, "zeroPage")).toBe(0);
    expect(resource(totals, "scratch")).toBe(0);
    expect(resource(totals, "hardwareStack")).toBe(hardwareStack);
    expectNoHandlerPrivateHome(artifacts);
  });
}

/**
 * The acceptance requires the five witnesses to build in the default mode on
 * every cooperative profile as well as in `none`.
 */
describe.each(PROFILES)("residual NMI storage in the default mode on %s", (profile) => {
  it("should build all five witnesses without a private home", async () => {
    await buildFormStorage(WIDE_WORD_MASK, profile, 4);
    await buildFormStorage(COMPUTED_MASK, profile, 6);
    await buildFormStorage(NONZERO_COMPARISON, profile, 4);
    await buildFormStorage(NINE_SAMPLES, profile, 14);
    await buildFormStorage(CROSS_JOIN, profile, 6);
  }, 180_000);
});

/** The default optimizer must keep the same storage-free shape. */
describe("residual NMI forms in the default optimization mode", () => {
  it("should join a wide word mask and retain one sample across a join", async () => {
    await buildForm(WIDE_WORD_MASK, "c64-pal-prg-kernal-6581", 4, 16, "balanced");
    await buildForm(CROSS_JOIN, "c64-pal-prg-kernal-6581", 6, 36, "balanced");
    await buildForm(COMPUTED_MASK, "c64-pal-prg-kernal-6581", 6, 29, "balanced");
    await buildForm(NONZERO_COMPARISON, "c64-pal-prg-kernal-6581", 4, 16, "balanced");
  }, 120_000);
});

/** A form that still needs a private home must fail with the canonical diagnostic. */
describe.each(PROFILES)("residual NMI private-home refusal on %s", (profile) => {
  it("should reject a retained local read through its borrowed address", async () => {
    const source = program(
      "place(at: $C000) let sampleOut: byte = 0;",
      `    let sample: byte = readAndClearPendingSources();
    sampleOut = peek(&sample);`,
    );
    await withProfileProject(source, profile, async (project, root) => {
      const results: readonly BuildResult[] = [
        await buildProject({ project, optimization: "none" }),
      ];
      for (const result of results) {
        expect(result.kind).toBe("failure");
        expect(result).not.toHaveProperty("generation");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  }, 60_000);
});
