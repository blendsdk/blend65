import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

/** The same source Boolean is either copied into a parameter or returned by an ordinary callee. */
const SOURCE = `module Game;
place(at: $3300) let input: boolean;
place(at: $3200) let parameterResult: byte;
place(at: $3201) let callResult: byte;
export function choose(value: boolean): byte {
  if (!value) { return $11; } else { return $22; }
}
export function ready(): boolean { return input; }
export function callChoose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
export function observed(): void { }
export function main(): void {
  while (true) { parameterResult = choose(input); callResult = callChoose(); observed(); }
}`;

/** Complete parameter leaves use a real one-byte source Boolean home, not a replacement byte type. */
function booleanHome(artifacts: LibraryArtifacts): number {
  const wanted = profileSpan(SOURCE, "value: boolean");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === wanted.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const inventory = profileRecords(artifacts.debug.symbols);
  const matches = inventory.filter((symbol) => {
    if (symbol.kind !== "parameter" || symbol.scope !== "src/game.blend::Game.choose") return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte <= wanted.start &&
      span.endByte >= wanted.start + 5
    );
  });
  expect(matches, "The declared Boolean parameter must remain identifiable").toHaveLength(1);
  const symbol = matches[0]!;
  expect(symbol.type).toBe("boolean");
  expect(symbol.byteWidth).toBe(1);
  if (!Array.isArray(symbol.locationIndexes))
    throw new Error("Missing Boolean parameter locations");
  const locations = profileRecords(artifacts.debug.locations);
  const homes = symbol.locationIndexes.flatMap((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || !locations[index])
      throw new Error("Missing Boolean parameter location");
    const location = locations[index]!;
    expect(location.symbolIndex).toBe(inventory.indexOf(symbol));
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") return [];
    return profileRecords(availability.pieces)
      .filter((piece) => piece.kind === "memory")
      .map((piece) => {
        expect(piece.byteLength).toBe(1);
        expect(piece.valueOffset).toBe(0);
        const machine = profileRecord(piece.machine);
        if (typeof machine.start !== "number" || !Number.isInteger(machine.start))
          throw new Error("Missing physical Boolean parameter home");
        expect(machine.end).toBe(machine.start + 1);
        return machine.start;
      });
  });
  const unique = [...new Set(homes)];
  expect(unique, "The source parameter retains its one-byte SFA home").toHaveLength(1);
  expect(unique[0]).toBeGreaterThanOrEqual(0);
  expect(unique[0]).toBeLessThanOrEqual(65535);
  return unique[0]!;
}

/** Narrow official NMOS widths and cycles cover the complete admitted leaf, not filtered operations. */
const SHAPES = new Map<number, readonly [number, number]>();
for (const row of [
  "09:2:2 18:1:2 20:3:6 24:2:3 29:2:2 2c:3:4 38:1:2 49:2:2 4c:3:3 60:1:6",
  "65:2:3 69:2:2 6d:3:4 e5:2:3 e9:2:2 ed:3:4",
  "84:2:3 85:2:3 86:2:3 8a:1:2 8c:3:4 8d:3:4 8e:3:4 98:1:2",
  "a0:2:2 a2:2:2 a4:2:3 a5:2:3 a6:2:3 a8:1:2 a9:2:2 aa:1:2 ac:3:4 ad:3:4 ae:3:4",
  "c5:2:3 c9:2:2 cd:3:4 10:2:2 30:2:2 50:2:2 70:2:2 90:2:2 b0:2:2 d0:2:2 f0:2:2",
]) {
  for (const entry of row.split(" ")) {
    const [opcode, width, cycles] = entry.split(":");
    SHAPES.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }
}

/** Address and size remain tied to the published complete physical function range. */
interface Instruction {
  readonly offset: number;
  readonly opcode: number;
  readonly operand: number | null;
  readonly width: number;
  readonly cycles: number;
}

function decode(bytes: Buffer): Instruction[] {
  const code: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const shape = SHAPES.get(opcode);
    if (!shape || offset + shape[0] > bytes.length)
      throw new Error(`Unaccounted complete negation instruction $${opcode.toString(16)}`);
    code.push({
      offset,
      opcode,
      width: shape[0],
      cycles: shape[1],
      operand:
        shape[0] === 1
          ? null
          : shape[0] === 2
            ? bytes[offset + 1]!
            : bytes.readUInt16LE(offset + 1),
    });
    offset += shape[0];
  }
  return code;
}

const BRANCHES = [0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0];
const STORES = [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e];

/** A JSR is charged here; its separately bounded callee body is not silently folded into the wrapper. */
function completeCycles(
  code: readonly Instruction[],
  start: number,
  pagePenalties: boolean,
): number {
  const byOffset = new Map(code.map((instruction) => [instruction.offset, instruction]));
  const visit = (offset: number, active: ReadonlySet<number>): number => {
    const instruction = byOffset.get(offset);
    if (!instruction || active.has(offset)) throw new Error("Incomplete or cyclic leaf boundary");
    const visited = new Set([...active, offset]);
    const next = offset + instruction.width;
    if (instruction.opcode === 0x60) return 6;
    if (instruction.opcode === 0x4c) return 3 + visit(Number(instruction.operand) - start, visited);
    if (BRANCHES.includes(instruction.opcode)) {
      const displacement = Number(instruction.operand);
      const target = next + (displacement < 128 ? displacement : displacement - 256);
      const page = pagePenalties && (start + next) >>> 8 !== (start + target) >>> 8 ? 1 : 0;
      return 2 + Math.max(visit(next, visited), 1 + page + visit(target, visited));
    }
    return instruction.cycles + visit(next, visited);
  };
  return visit(0, new Set());
}

describe.each(sourceLibraryProfiles)("branch-only Boolean negation output on %s", (profile) => {
  it("should branch from the source Boolean home without creating or staging its negation", async () => {
    // LDA abs + branch + two LDA immediate/RTS arms: 11 bytes, selected paths 14/15 cycles.
    await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
      expectLibraryAccounting(artifacts);
      const home = booleanHome(artifacts);
      const variants = cia2FunctionVariants(artifacts, "choose");
      expect(variants).toHaveLength(1);
      for (const { bytes, start } of variants) {
        const code = decode(bytes);
        expect(
          code.some(
            ({ operand, opcode }) =>
              operand === home && [0xa5, 0xad, 0xa4, 0xac, 0xa6, 0xae].includes(opcode),
          ),
        ).toBe(true);
        expect(code.filter(({ opcode }) => STORES.includes(opcode))).toHaveLength(0);
        expect(code.filter(({ opcode }) => opcode === 0x20)).toHaveLength(0);
        expect(bytes.length).toBeLessThanOrEqual(11);
        expect(completeCycles(code, start, false)).toBeLessThanOrEqual(15);
        // The nominal expert floor is separate from the official extra cycle on a taken page-crossing branch.
        expect(completeCycles(code, start, true)).toBeLessThanOrEqual(16);
      }
    });
  }, 180_000);

  it("should consume one adjacent Boolean call result without staging or trusting callee flags", async () => {
    // JSR + explicit A-to-zero test + branch + two return arms: 13 bytes, selected paths 18/19 cycles.
    await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
      expectLibraryAccounting(artifacts);
      const target = libraryEntry(artifacts, "src/game.blend::Game.ready");
      const variants = cia2FunctionVariants(artifacts, "callChoose");
      expect(variants).toHaveLength(1);
      for (const { bytes, start } of variants) {
        const code = decode(bytes);
        expect(code.filter(({ opcode }) => opcode === 0x20).map(({ operand }) => operand)).toEqual([
          target,
        ]);
        expect(code.filter(({ opcode }) => STORES.includes(opcode))).toHaveLength(0);
        expect(bytes.length).toBeLessThanOrEqual(13);
        expect(completeCycles(code, start, false)).toBeLessThanOrEqual(19);
        expect(completeCycles(code, start, true)).toBeLessThanOrEqual(20);
      }
    });
  }, 180_000);

  it("should charge the unchanged Boolean callee separately as a complete routine", async () => {
    // The ordinary callee is LDA abs + RTS: 4 bytes/10 cycles, in addition to wrapper JSR traffic.
    await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
      const variants = cia2FunctionVariants(artifacts, "ready");
      expect(variants).toHaveLength(1);
      for (const { bytes, start } of variants) {
        const code = decode(bytes);
        expect(bytes.length).toBeLessThanOrEqual(4);
        expect(completeCycles(code, start, true)).toBeLessThanOrEqual(10);
        expect(code.filter(({ opcode }) => STORES.includes(opcode))).toHaveLength(0);
        expect(code.filter(({ opcode }) => opcode === 0x20)).toHaveLength(0);
      }
    });
  }, 180_000);
});
