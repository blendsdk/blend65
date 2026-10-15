import { describe, expect, it } from "vitest";
import { cia2FunctionVariants, cia2PrgBytes } from "./cia2-output-fixture.js";
import type { Cia2Artifacts } from "./cia2-output-fixture.js";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";
import { expectLibraryAccounting, sourceLibraryProfiles } from "./source-library-fixture.js";

const SOURCE = `module Game;
let result: byte[11] = [; 0];
function choose(first: boolean): byte[11] {
  let left: byte[11] = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  let right: byte[11] = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  if (first) { return left; }
  return right;
}
function main(): void {
  result = choose(true);
  result = choose(false);
}`;

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integral public evidence");
  return value;
}

interface Instruction {
  address: number;
  opcode: number;
  operand: number | undefined;
  length: number;
}

/** Decode documented NMOS instructions from the complete, publicly covered function body. */
function decode(bytes: Buffer, start: number): Instruction[] {
  const lengths = new Map<number, number>();
  const forms = [
    [1, "08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8"],
    [
      2,
      "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
    ],
    [
      3,
      "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
    ],
  ] as const;
  for (const [length, opcodes] of forms)
    for (const opcode of opcodes.split(" ")) lengths.set(Number.parseInt(opcode, 16), length);
  const instructions: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const length = lengths.get(opcode);
    if (length === undefined || offset + length > bytes.length)
      throw new Error("Function coverage does not contain a complete official NMOS instruction");
    instructions.push({
      address: start + offset,
      opcode,
      operand:
        length === 1
          ? undefined
          : length === 2
            ? bytes[offset + 1]!
            : bytes.readUInt16LE(offset + 1),
      length,
    });
    offset += length;
  }
  return instructions;
}

/** Match a local declaration to its available memory piece without depending on backend labels. */
function localHome(artifacts: Cia2Artifacts, name: "left" | "right"): number {
  const declaration = `let ${name}: byte[11]`;
  const start = Buffer.byteLength(SOURCE.slice(0, SOURCE.indexOf(declaration)));
  const end = Buffer.byteLength(
    SOURCE.slice(0, SOURCE.indexOf(";", SOURCE.indexOf(declaration)) + 1),
  );
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === "src/game.blend",
  );
  const symbols = profileRecords(artifacts.debug.symbols).filter((symbol) => {
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source" || symbol.byteWidth !== 11) return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      integer(span.startByte) >= start &&
      integer(span.endByte) <= end
    );
  });
  expect(symbols, `Stored ${name} local`).toHaveLength(1);
  const locations = profileRecords(artifacts.debug.locations);
  const indexes = symbols[0]!.locationIndexes;
  if (!Array.isArray(indexes)) throw new TypeError("Local storage requires public locations");
  const pieces = indexes.flatMap((index) => {
    const availability = profileRecord(locations[integer(index)]!.availability);
    if (availability.kind !== "available") return [];
    return profileRecords(availability.pieces).filter((piece) => piece.kind === "memory");
  });
  expect(pieces).toHaveLength(1);
  expect(pieces[0]!.byteLength).toBe(11);
  expect(pieces[0]!.valueOffset).toBe(0);
  const machine = profileRecord(pieces[0]!.machine);
  expect(integer(machine.end) - integer(machine.start)).toBe(11);
  return integer(machine.start);
}

describe("fixed local aggregate return source setup", () => {
  for (const profile of sourceLibraryProfiles)
    for (const name of ["left", "right"] as const)
      it(`${profile}: copies the selected ${name} local with only the existing destination pointer`, async () => {
        const artifacts = await buildProfileSource(SOURCE, profile);
        expectLibraryAccounting(artifacts);
        const home = localHome(artifacts, name);
        const other = localHome(artifacts, name === "left" ? "right" : "left");
        expect(Math.abs(home - other)).toBeGreaterThanOrEqual(11);
        const bodies = cia2FunctionVariants(artifacts, "choose");
        expect(bodies).toHaveLength(1);
        const body = bodies[0]!;
        const instructions = decode(body.bytes, body.start);
        const reads = instructions.flatMap((instruction, index) =>
          instruction.opcode === 0xb9 && instruction.operand === home ? [index] : [],
        );
        expect(reads, "One independently located absolute-indexed source-home read").toHaveLength(
          1,
        );
        const readIndex = reads[0]!;
        const first = instructions[readIndex - 1]!;
        expect(
          first.opcode,
          "Copy index initialization immediately precedes its typed source read",
        ).toBe(0xa0);
        expect([0, 10], "A complete forward or reverse eleven-byte traversal seed").toContain(
          first.operand,
        );
        const forward = first.operand === 0;
        const terminator = instructions[readIndex + (forward ? 5 : 4)]!;
        expect(
          terminator.opcode,
          "The exact copy successor is the ordinary return terminator",
        ).toBe(0x60);
        const end = terminator!.address + 1;
        const ranges = profileRecords(artifacts.debug.ranges);
        expect(
          ranges.some((range) => {
            const machine = profileRecord(range.machine);
            return integer(machine.start) <= terminator!.address && integer(machine.end) >= end;
          }),
          "The return terminator participates in public byte coverage",
        ).toBe(true);
        const bytes = cia2PrgBytes(artifacts, first.address, end);

        // The ceiling derives from the ordinary forward copy and RTS. Local initialization,
        // caller marshalling, the branch, startup and all other output remain charged above.
        // A cheaper equivalent traversal may pass this ceiling; no direction rewrite is required.
        expect(bytes.length, "Complete ordinary copy and RTS").toBeLessThanOrEqual(13);
        expect([...bytes.subarray(0, 2)]).toEqual([0xa0, forward ? 0 : 10]);
        expect([...bytes.subarray(2, 5)]).toEqual([0xb9, home & 0xff, home >>> 8]);
        expect(bytes[5]).toBe(0x91);
        const destination = bytes[6]!;
        expect(destination).toBeLessThanOrEqual(0xfe);
        expect([...bytes.subarray(7)]).toEqual(
          forward ? [0xc8, 0xc0, 11, 0xd0, 0xf6, 0x60] : [0x88, 0x10, 0xf8, 0x60],
        );
        const nominalCycles = 2 + 11 * (4 + 6 + 2 + (forward ? 2 : 0)) + 10 * 3 + 2 + 6;
        expect(nominalCycles).toBe(forward ? 194 : 172);
        const sourcePageCrossings = Math.max(0, (home & 0xff) + 11 - 256);
        const branchPageCrossings =
          (first.address + (forward ? 12 : 10)) >>> 8 === (first.address + 2) >>> 8 ? 0 : 10;

        // Inspect the complete body as well, so source-address setup cannot be hidden
        // anywhere before the typed source-home read or in other public origin ranges.
        const setups = instructions.filter((instruction, index) => {
          const [lowStore, highLoad, highStore] = instructions.slice(index + 1, index + 4);
          return (
            instruction.opcode === 0xa9 &&
            instruction.operand === (home & 0xff) &&
            lowStore?.opcode === 0x85 &&
            highLoad?.opcode === 0xa9 &&
            highLoad.operand === home >>> 8 &&
            highStore?.opcode === 0x85 &&
            highStore.operand === lowStore.operand! + 1
          );
        });
        const setupBytes = setups.reduce((sum, instruction) => {
          const index = instructions.indexOf(instruction);
          return (
            sum +
            instructions.slice(index, index + 4).reduce((count, entry) => count + entry.length, 0)
          );
        }, 0);
        expect
          .soft(bytes.length + setupBytes, "Copy, RTS and every source-address setup byte")
          .toBeLessThanOrEqual(13);
        expect
          .soft(
            nominalCycles + sourcePageCrossings + branchPageCrossings + setups.length * 10,
            "Copy, RTS and every source-address setup cycle",
          )
          .toBeLessThanOrEqual(194 + sourcePageCrossings + branchPageCrossings);
        expect
          .soft(setups, "No unused two-byte source-address setup anywhere in the function")
          .toEqual([]);
        const zeroPageStores = instructions
          .filter(({ opcode }) => opcode === 0x85)
          .map(({ operand }) => operand);
        expect
          .soft(
            [...new Set(zeroPageStores)].filter(
              (address) => address !== destination && address !== destination + 1,
            ),
            "No redundant source-pointer home is written by the function",
          )
          .toEqual([]);
        expect(artifacts.memory.acmeReconciled).toBe(true);
        expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/u);
      }, 30_000);
});
