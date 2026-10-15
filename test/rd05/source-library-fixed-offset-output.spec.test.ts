import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const CASES = sourceLibraryProfiles.flatMap((profile, index) =>
  (index === 0 ? [0, 1, 9, 255, 257] : [257]).map((offset) => ({ profile, offset })),
);

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integral public evidence");
  return value;
}

function library(offset: number): string {
  const fields =
    offset === 0 ? "value: byte; padding: byte;" : `padding: byte[${offset}]; value: byte;`;
  return `module Library;
export struct Record { ${fields} }
export function read(root: Record): byte { return root.value; }`;
}

const GAME = `module Game;
import { Record, read } from Library;
let object: Record;
let result: byte = 0;
function main(): void {
  object.value = 84;
  result = read(object);
}`;

/** Resolve the original borrowed address from its parameter declaration and available memory piece. */
function parameterHome(artifacts: LibraryArtifacts, source: string): number {
  const start = Buffer.byteLength(source.slice(0, source.indexOf("root: Record")));
  const end = start + Buffer.byteLength("root: Record");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === "src/library.blend",
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matches = symbols.filter((symbol) => {
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      integer(span.startByte) >= start &&
      integer(span.endByte) <= end
    );
  });
  const locations = profileRecords(artifacts.debug.locations);
  const homes = matches.flatMap((symbol) => {
    const indexes = symbol.locationIndexes;
    if (!Array.isArray(indexes))
      throw new TypeError("Borrowed parameter requires public locations");
    return indexes.flatMap((index) => {
      const location = locations[integer(index)]!;
      expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") return [];
      return profileRecords(availability.pieces)
        .filter((piece) => piece.kind === "memory")
        .map((piece) => {
          expect(piece.byteLength).toBe(2);
          expect(piece.valueOffset).toBe(0);
          const machine = profileRecord(piece.machine);
          expect(integer(machine.end) - integer(machine.start)).toBe(2);
          return integer(machine.start);
        });
    });
  });
  expect(homes, "Original two-byte borrowed parameter home").toHaveLength(1);
  return homes[0]!;
}

interface Instruction {
  opcode: number;
  operand: number | undefined;
  cycles: number;
}

/** Decode and charge every documented instruction in the complete opaque byte-return leaf. */
function decode(bytes: readonly number[]): Instruction[] {
  const forms: Readonly<Record<number, readonly [number, number]>> = {
    0x18: [1, 2],
    0x60: [1, 6],
    0x65: [2, 3],
    0x69: [2, 2],
    0x6d: [3, 4],
    0x85: [2, 3],
    0x8d: [3, 4],
    0x98: [1, 2],
    0xa0: [2, 2],
    0xa5: [2, 3],
    0xa9: [2, 2],
    0xad: [3, 4],
    0xb1: [2, 5],
  };
  const instructions: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const form = forms[opcode];
    if (form === undefined || offset + form[0] > bytes.length)
      throw new Error("Opaque leaf must contain complete supported official NMOS instructions");
    const [length, cycles] = form;
    instructions.push({
      opcode,
      operand:
        length === 1
          ? undefined
          : length === 2
            ? bytes[offset + 1]!
            : bytes[offset + 1]! | (bytes[offset + 2]! << 8),
      cycles,
    });
    offset += length;
  }
  return instructions;
}

describe("opaque borrowed aggregate fixed field offset output", () => {
  for (const { profile, offset } of CASES)
    it(`${profile}: offset ${offset} forms the full effective pointer once before its only byte read`, async () => {
      const source = library(offset);
      await withLibraryBuild(GAME, source, profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        const home = parameterHome(artifacts, source);
        expect(
          home,
          "RAM borrowed-parameter home used by this local cost family",
        ).toBeGreaterThanOrEqual(0x100);
        const bytes = libraryFunctionBytes(artifacts, "src/library.blend::Library.read");
        const instructions = decode(bytes);
        const cycles = instructions.reduce((sum, instruction) => sum + instruction.cycles, 0);
        const read = instructions.filter(({ opcode }) => opcode === 0xb1);
        expect(read, "Exactly one effective-pointer byte read").toHaveLength(1);
        const pointer = read[0]!.operand!;
        expect(pointer).toBeGreaterThanOrEqual(2);
        expect(pointer).toBeLessThanOrEqual(0xfe);
        const short = offset >= 1 && offset <= 255;
        if (short) {
          expect(
            bytes.slice(0, 2),
            "Y=0 supplies a carry-preserving zero for the high-byte addition",
          ).toEqual([0xa0, 0]);
          expect(
            bytes.slice(-3),
            "The full effective pointer precedes the sole read and RTS",
          ).toEqual([0xb1, pointer, 0x60]);
        } else {
          expect(bytes.slice(-5), "Effective address is complete before Y=0, read and RTS").toEqual(
            [0xa0, 0, 0xb1, pointer, 0x60],
          );
        }
        const low = [0xad, home & 0xff, home >>> 8];
        const high = [0xad, (home + 1) & 0xff, (home + 1) >>> 8];
        const expected =
          offset === 0
            ? [...low, 0x85, pointer, ...high, 0x85, pointer + 1, 0xa0, 0, 0xb1, pointer, 0x60]
            : short
              ? [
                  0xa0,
                  0,
                  ...low,
                  0x18,
                  0x69,
                  offset,
                  0x85,
                  pointer,
                  0x98,
                  0x6d,
                  (home + 1) & 0xff,
                  (home + 1) >>> 8,
                  0x85,
                  pointer + 1,
                  0xb1,
                  pointer,
                  0x60,
                ]
              : [
                  ...low,
                  0x18,
                  0x69,
                  offset & 0xff,
                  0x85,
                  pointer,
                  ...high,
                  0x69,
                  offset >>> 8,
                  0x85,
                  pointer + 1,
                  0xa0,
                  0,
                  0xb1,
                  pointer,
                  0x60,
                ];

        // Complete branch-free leaf costs include pointer formation and RTS. Caller setup,
        // object initialization, startup and every other byte remain charged separately above.
        // Y=0 prevents an indexed-load page-cross dummy read of intermediate MMIO.
        expect
          .soft(bytes.length, "All leaf instructions, with no omitted address setup")
          .toBeLessThanOrEqual(offset === 0 ? 15 : short ? 19 : 20);
        expect
          .soft(cycles, "All nominal NMOS leaf cycles, including return")
          .toBeLessThanOrEqual(offset === 0 ? 27 : 33);
        expect
          .soft(bytes, "Combine original low/high loads with the complete constant displacement")
          .toEqual(expected);
        expect(
          instructions.filter(({ opcode, operand }) => opcode === 0xad && operand === home),
        ).toHaveLength(1);
        expect(
          instructions.filter(
            ({ opcode, operand }) => opcode === (short ? 0x6d : 0xad) && operand === home + 1,
          ),
        ).toHaveLength(1);
        expect(
          instructions.filter(
            ({ opcode, operand }) =>
              [0x85, 0x8d].includes(opcode) && [home, home + 1].includes(operand!),
          ),
          "Never overwrite the borrowed address parameter",
        ).toEqual([]);
        expect(
          instructions.filter(
            ({ opcode, operand }) =>
              opcode === 0x85 && operand !== pointer && operand !== pointer + 1,
          ),
          "Only the existing private effective-address pair is written",
        ).toEqual([]);
        expect(artifacts.memory.acmeReconciled).toBe(true);
        expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/u);
      });
    }, 30_000);
});
