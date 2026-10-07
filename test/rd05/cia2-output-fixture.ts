import { expect } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

/** Detached artifacts from a real public compiler and ACME build. */
export type Cia2Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** A contiguous source-owned byte slice and its emitted function variant. */
export interface Cia2CodeSlice {
  /** First loaded address covered by this slice. */
  readonly start: number;
  /** Exclusive end of the loaded coverage. */
  readonly end: number;
  /** Actual bytes from the published PRG, never assembly text. */
  readonly bytes: Buffer;
  /** Published source-function index. */
  readonly functionIndex: number;
  /** Published physical body variant within that function. */
  readonly variantIndex: number;
}

/** The fixed caller-preserving shutdown has no RAM scratch or device-state reconstruction. */
export const CIA2_SHUTDOWN = Buffer.from([
  0x08, 0x48, 0x78, 0xa9, 0xfe, 0x8d, 0x19, 0x03, 0xa9, 0x1f, 0x8d, 0x0d, 0xdd, 0xad, 0x0e, 0xdd,
  0x29, 0xc6, 0x09, 0x08, 0x8d, 0x0e, 0xdd, 0xad, 0x0f, 0xdd, 0x29, 0x86, 0x09, 0x08, 0x8d, 0x0f,
  0xdd, 0xad, 0x0d, 0xdd, 0x68, 0x28,
]);

/** External arrivals cannot be turned into a finite full-program stack or deadline claim. */
export const CIA2_EXTERNAL_EFFECT =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";

/** Validate numeric metadata before using it to index actual PRG bytes. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integer evidence metadata");
  return value;
}

/** Extract actual loaded bytes, including a bounds check against the PRG load address. */
export function cia2PrgBytes(artifacts: Cia2Artifacts, start: number, end: number): Buffer {
  const loadAddress = artifacts.prg.readUInt16LE(0);
  expect(start).toBeGreaterThanOrEqual(loadAddress);
  expect(end).toBeGreaterThan(start);
  expect(end - loadAddress + 2).toBeLessThanOrEqual(artifacts.prg.length);
  return artifacts.prg.subarray(start - loadAddress + 2, end - loadAddress + 2);
}

/** Use the public source-function identity rather than backend label spellings. */
function functionIndex(artifacts: Cia2Artifacts, name: string): number {
  const functions = profileRecords(artifacts.debug.functions);
  const index = functions.findIndex(
    ({ qualifiedName }) => qualifiedName === `src/game.blend::Game.${name}`,
  );
  if (index < 0) throw new Error(`Missing emitted source function ${name}`);
  return index;
}

/** Merge overlapping debug coverage without silently accepting gaps in emitted code. */
function sliceRanges(
  artifacts: Cia2Artifacts,
  indexes: readonly number[],
  ownerIndex: number,
  variantIndex: number,
): Cia2CodeSlice {
  const ranges = profileRecords(artifacts.debug.ranges);
  const spans = indexes
    .map((index) => {
      const row = ranges[index];
      if (row === undefined) throw new Error("Missing debug range");
      const machine = profileRecord(row.machine);
      return { start: integer(machine.start), end: integer(machine.end) };
    })
    .sort((a, b) => a.start - b.start);
  if (spans.length === 0) throw new Error("Missing emitted byte coverage");
  const start = spans[0]!.start;
  let end = start;
  for (const span of spans) {
    expect(span.start).toBeLessThanOrEqual(end);
    expect(span.end).toBeGreaterThan(span.start);
    end = Math.max(end, span.end);
  }
  return {
    start,
    end,
    bytes: cia2PrgBytes(artifacts, start, end),
    functionIndex: ownerIndex,
    variantIndex,
  };
}

/** Read complete reachable code bodies through their published range references. */
export function cia2FunctionVariants(artifacts: Cia2Artifacts, name: string): Cia2CodeSlice[] {
  const index = functionIndex(artifacts, name);
  const row = profileRecords(artifacts.debug.functions)[index]!;
  return profileRecords(row.entryVariants).map((variant, variantIndex) => {
    if (!Array.isArray(variant.rangeIndexes)) throw new Error("Missing variant ranges");
    return sliceRanges(artifacts, variant.rangeIndexes.map(integer), index, variantIndex);
  });
}

/** Locate every physical variant of one source operation, retaining context distinctions. */
export function cia2OperationGroups(
  artifacts: Cia2Artifacts,
  source: string,
  proof: string,
  name = "main",
  occurrence = 0,
): Cia2CodeSlice[] {
  let sourcePosition = -1;
  for (let i = 0; i <= occurrence; i += 1)
    sourcePosition = source.indexOf(proof, sourcePosition + 1);
  if (sourcePosition < 0) throw new Error(`Missing source operation ${proof}`);
  const bytePosition = Buffer.byteLength(source.slice(0, sourcePosition));
  const byteEnd = bytePosition + Buffer.byteLength(proof.replace(/;$/, ""));
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === "src/game.blend",
  );
  const ranges = profileRecords(artifacts.debug.ranges);
  const functions = profileRecords(artifacts.debug.functions);
  const ownerIndex = functionIndex(artifacts, name);
  return profileRecords(functions[ownerIndex]!.entryVariants).flatMap((variant, variantIndex) => {
    if (!Array.isArray(variant.rangeIndexes)) throw new Error("Missing variant ranges");
    const candidates = variant.rangeIndexes.map(integer).flatMap((index) => {
      const origin = profileRecord(ranges[index]!.origin);
      const value = origin.kind === "source" ? origin.span : origin.sourceSpan;
      if (value === undefined) return [];
      const span = profileRecord(value);
      const start = integer(span.startByte);
      const end = integer(span.endByte);
      return span.sourceIndex === sourceIndex && start <= bytePosition && byteEnd <= end
        ? [{ index, width: end - start }]
        : [];
    });
    if (candidates.length === 0) return [];
    const width = Math.min(...candidates.map((candidate) => candidate.width));
    return [
      sliceRanges(
        artifacts,
        candidates.filter((candidate) => candidate.width === width).map(({ index }) => index),
        ownerIndex,
        variantIndex,
      ),
    ];
  });
}

/** One boundary-aligned instruction in a focused CIA2 vector/device transaction. */
export interface Cia2Instruction {
  /** Documented NMOS opcode at a proved instruction boundary. */
  readonly opcode: number;
  /** Immediate or little-endian address operand, or no operand. */
  readonly operand: number | null;
  /** Instruction start within the supplied operation bytes. */
  readonly offset: number;
}

/** Walk only the documented instructions admitted by these focused transaction fixtures. */
export function cia2Instructions(bytes: Buffer): Cia2Instruction[] {
  const lengths: Readonly<Record<number, number>> = {
    0x08: 1,
    0x09: 2,
    0x20: 3,
    0x28: 1,
    0x29: 2,
    0x40: 1,
    0x48: 1,
    0x4c: 3,
    0x60: 1,
    0x68: 1,
    0x6c: 3,
    0x78: 1,
    0x85: 2,
    0x86: 2,
    0x8a: 1,
    0x8d: 3,
    0x8e: 3,
    0x90: 2,
    0xb0: 2,
    0xa2: 2,
    0xa5: 2,
    0xa6: 2,
    0xa9: 2,
    0xaa: 1,
    0xad: 3,
    0xae: 3,
    0xc9: 2,
    0xcd: 3,
    0xd0: 2,
    0xd8: 1,
    0xe0: 2,
    0xf0: 2,
  };
  const instructions: Cia2Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const length = lengths[opcode];
    if (length === undefined || offset + length > bytes.length)
      throw new Error(
        `Unexpected CIA2 transaction instruction $${opcode.toString(16)} at byte ${offset}`,
      );
    const operand =
      length === 1 ? null : length === 2 ? bytes[offset + 1]! : bytes.readUInt16LE(offset + 1);
    instructions.push({ opcode, operand, offset });
    offset += length;
  }
  return instructions;
}

/** Sum nominal cycles only for the fixed, branch-free NMOS sequences asserted here. */
export function cia2FixedCycles(bytes: Buffer): number {
  const cycles: Readonly<Record<number, number>> = {
    0x08: 3,
    0x09: 2,
    0x20: 6,
    0x28: 4,
    0x29: 2,
    0x40: 6,
    0x48: 3,
    0x4c: 3,
    0x60: 6,
    0x68: 4,
    0x6c: 5,
    0x78: 2,
    0x85: 3,
    0x86: 3,
    0x8a: 2,
    0x8d: 4,
    0x8e: 4,
    0xa2: 2,
    0xa5: 3,
    0xa6: 3,
    0xa9: 2,
    0xaa: 2,
    0xad: 4,
    0xae: 4,
    0xd8: 2,
  };
  return cia2Instructions(bytes).reduce((total, instruction) => {
    const cost = cycles[instruction.opcode];
    if (cost === undefined) throw new Error("No fixed cycle claim for this instruction");
    return total + cost;
  }, 0);
}

/** Prove NMI function/helper homes absent while retaining installation-owned link words. */
export function expectCia2NoPrivateHomes(artifacts: Cia2Artifacts, names: readonly string[]): void {
  const owners = names.map((name) => `src/game.blend::Game.${name}`);
  expect(
    profileRecords(artifacts.debug.functions).some(({ qualifiedName }) =>
      owners.includes(String(qualifiedName)),
    ),
  ).toBe(true);
  const privateHomes = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
    const owner = profileRecord(interval.owner);
    if (typeof owner.id !== "string") throw new TypeError("Missing private-home owner identity");
    const ownerIds: unknown = owner.id.startsWith("overlay:")
      ? JSON.parse(owner.id.slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(ownerIds) || !ownerIds.every((id) => typeof id === "string"))
      throw new TypeError("Malformed private-home owner associations");
    return ownerIds.some((id: string) =>
      owners.some((name) => id === name || id.startsWith(`${name}::`)),
    );
  });
  expect(privateHomes).toEqual([]);
  expect(artifacts.memory.acmeReconciled).toBe(true);
}

/** Per-entry stack costs stay separate from unproved external aggregate obligations. */
export function expectCia2ExternalUncertainty(artifacts: Cia2Artifacts): void {
  expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
  expect(
    profileRecords(artifacts.memory.unboundedEffects).some(
      ({ effectClass }) => effectClass === CIA2_EXTERNAL_EFFECT,
    ),
  ).toBe(true);
}

/** Report only the bounded generated entry and its ordinary helper returns. */
export function expectCia2EntryStack(artifacts: Cia2Artifacts, bytes: number): void {
  const entries = profileRecords(artifacts.memory.stackDomains).filter(
    ({ id }) => typeof id === "string" && id.startsWith("nmi-entry:"),
  );
  expect(entries).toHaveLength(1);
  expect(entries[0]!.route).toEqual(expect.arrayContaining(["per-entry:generated-nmi"]));
  expect(entries[0]!.peakBytes).toBe(bytes);
  expectCia2ExternalUncertainty(artifacts);
}
