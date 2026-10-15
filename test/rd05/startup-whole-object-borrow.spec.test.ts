import { describe, expect, test } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import { libraryBytes, sourceLibraryProfiles } from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const pair = `module Game;
struct Pair { first: byte; second: byte; }
let inputPair: Pair;
let result: byte;
function readSecond(value: const Pair): byte { return value.second; }
function main(): void {
  inputPair.first = 7;
  inputPair.second = 9;
  result = readSecond(inputPair);
}`;
const array = `module Game;
let inputArray: byte[2];
let result: byte;
function readSecond(value: const byte[2]): byte { return value[1]; }
function main(): void {
  inputArray[0] = 7;
  inputArray[1] = 9;
  result = readSecond(inputArray);
}`;

const cases = [
  { name: "owned struct borrowed by one known ordinary consumer", source: pair, compact: true },
  {
    name: "owned fixed array borrowed by one known ordinary consumer",
    source: array,
    compact: true,
  },
  {
    name: "reached consumer reads VIC",
    source: pair.replace(
      "return value.second;",
      "let observed: byte = peek($D018); return value.second;",
    ),
    compact: false,
  },
  {
    name: "reached consumer has an uncontained array index",
    source: array.replace(
      "return value[1];",
      "let index: byte = peek($DC00); return value[index];",
    ),
    compact: false,
  },
  {
    name: "aggregate address is exposed as a scalar word",
    source: pair.replace(
      "inputPair.first = 7;",
      "let exposed: word = &inputPair; inputPair.first = 7;",
    ),
    compact: false,
  },
  {
    name: "reached consumer writes fixed high RAM",
    source: pair.replace("return value.second;", "poke($C000, 7); return value.second;"),
    compact: false,
  },
];

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error("Missing integer evidence");
  return value;
}

function interval(artifacts: LibraryArtifacts, id: string) {
  const matches = profileRecords(artifacts.memory.intervals).filter((row) => row.id === id);
  expect(matches, id).toHaveLength(1);
  const row = matches[0]!;
  const start = integer(row.start);
  const end = integer(row.end);
  expect(end).toBeGreaterThan(start);
  expect(integer(row.size)).toBe(end - start);
  return { start, end, size: end - start };
}

function borrowedBasicBytes(artifacts: LibraryArtifacts): number[] {
  const bytes = new Set<number>();
  for (const row of profileRecords(artifacts.memory.intervals)) {
    if (row.resourceClass !== "zeroPage") continue;
    const start = integer(row.start);
    const end = integer(row.end);
    expect(start).toBeGreaterThanOrEqual(2);
    expect(end).toBeLessThanOrEqual(0x90);
    expect(end).toBeGreaterThanOrEqual(start);
    expect(integer(row.size)).toBe(end - start);
    for (let address = Math.max(3, start); address < end; address += 1) bytes.add(address);
  }
  return [...bytes].sort((a, b) => a - b);
}

// Official NMOS instruction widths and nominal cycles, not compiler cost records.
// These selected startup components are straight-line. Firmware, IRQ and DMA are excluded.
function instructions(bytes: number[]) {
  const table: Record<number, readonly [number, number]> = {
    0x08: [1, 3],
    0x09: [2, 2],
    0x20: [3, 6],
    0x28: [1, 4],
    0x29: [2, 2],
    0x48: [1, 3],
    0x4c: [3, 3],
    0x60: [1, 6],
    0x68: [1, 4],
    0x84: [2, 3],
    0x85: [2, 3],
    0x86: [2, 3],
    0x88: [1, 2],
    0x8a: [1, 2],
    0x8c: [3, 4],
    0x8d: [3, 4],
    0x8e: [3, 4],
    0x98: [1, 2],
    0x9a: [1, 2],
    0xa0: [2, 2],
    0xa2: [2, 2],
    0xa4: [2, 3],
    0xa5: [2, 3],
    0xa6: [2, 3],
    0xa8: [1, 2],
    0xa9: [2, 2],
    0xaa: [1, 2],
    0xac: [3, 4],
    0xad: [3, 4],
    0xae: [3, 4],
    0xba: [1, 2],
    0xc8: [1, 2],
    0xca: [1, 2],
    0xd8: [1, 2],
    0xe8: [1, 2],
    0xea: [1, 2],
  };
  const result: { opcode: number; operand: number | null; cycles: number }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const encoding = table[opcode];
    if (encoding === undefined || offset + encoding[0] > bytes.length)
      throw new Error(`Startup nominal cost is Unknown at opcode $${opcode.toString(16)}`);
    const [width, cycles] = encoding;
    const operand =
      width === 1
        ? null
        : width === 2
          ? bytes[offset + 1]!
          : bytes[offset + 1]! + 256 * bytes[offset + 2]!;
    result.push({ opcode, operand, cycles });
    offset += width;
  }
  return result;
}

describe("whole owned objects do not imply a display dependency", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const fixture of cases) {
      test(`${profile}: ${fixture.name}`, async () => {
        const artifacts = await buildProfileSource(fixture.source, profile);
        expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
        const entry = interval(artifacts, "code.startup.entry");
        const restore = interval(artifacts, "code.startup.restore");
        const state = interval(artifacts, "platform.startup-state");
        const entryOps = instructions(libraryBytes(artifacts, entry.start, entry.size));
        const restoreOps = instructions(libraryBytes(artifacts, restore.start, restore.size));
        const borrowed = borrowedBasicBytes(artifacts);
        const codeBytes = entry.size + restore.size;
        const cycles = [...entryOps, ...restoreOps].reduce((sum, op) => sum + op.cycles, 0);
        const main = cia2FunctionVariants(artifacts, "main");
        const callee = cia2FunctionVariants(artifacts, "readSecond");
        console.info(
          JSON.stringify({
            profile,
            case: fixture.name,
            borrowed,
            startup: { codeBytes, cycles, stateBytes: state.size },
            mainBytes: main.map((body) => body.bytes.length),
            calleeBytes: callee.map((body) => body.bytes.length),
            wholePayloadBytes: artifacts.prg.length - 2,
          }),
        );
        const vic = (ops: typeof entryOps, opcode: number) =>
          ops.filter((op) => op.opcode === opcode && op.operand === 0xd018).length;
        if (fixture.compact) {
          // Equal-contract expert: entry 38B/55c + restore 22B/39c, P/CPU0/CPU1/DDRA state.
          // One saved BASIC byte adds LDAzp/STAabs and LDAabs/STAzp: 10B/14c/1 state byte.
          expect.soft(codeBytes).toBeLessThanOrEqual(60 + 10 * borrowed.length);
          expect.soft(cycles).toBeLessThanOrEqual(94 + 14 * borrowed.length);
          expect.soft(state.size).toBe(4 + borrowed.length);
          expect.soft(vic(entryOps, 0xad)).toBe(0);
          expect.soft(vic(entryOps, 0x8d)).toBe(0);
          expect.soft(vic(restoreOps, 0x8d)).toBe(0);
        } else {
          expect(state.size).toBe(49 + borrowed.length);
          expect(vic(entryOps, 0xad)).toBe(1);
          expect(vic(entryOps, 0x8d)).toBe(1);
          expect(vic(restoreOps, 0x8d)).toBe(1);
        }
      }, 60_000);
    }
  }
});
