import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import {
  libraryBytes,
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
} from "./source-library-fixture.js";

type Opcode = { name: string; bytes: number; cycles: number; access?: "read" | "write" };
const opcodes = new Map<number, Opcode>();
for (const [code, name, cycles] of [
  [0x08, "PHP", 3],
  [0x28, "PLP", 4],
  [0x48, "PHA", 3],
  [0x68, "PLA", 4],
  [0xba, "TSX", 2],
  [0x9a, "TXS", 2],
  [0xaa, "TAX", 2],
  [0xa8, "TAY", 2],
  [0x8a, "TXA", 2],
  [0x98, "TYA", 2],
  [0xd8, "CLD", 2],
  [0x58, "CLI", 2],
  [0x78, "SEI", 2],
  [0x18, "CLC", 2],
  [0x38, "SEC", 2],
  [0xea, "NOP", 2],
  [0x60, "RTS", 6],
] as const)
  opcodes.set(code, { name, bytes: 1, cycles });
for (const [immediate, zeroPage, absolute, name] of [
  [0xa9, 0xa5, 0xad, "LDA"],
  [0xa2, 0xa6, 0xae, "LDX"],
  [0xa0, 0xa4, 0xac, "LDY"],
  [0x29, 0x25, 0x2d, "AND"],
  [0x09, 0x05, 0x0d, "ORA"],
  [0x49, 0x45, 0x4d, "EOR"],
  [0xc9, 0xc5, 0xcd, "CMP"],
  [0xe0, 0xe4, 0xec, "CPX"],
  [0xc0, 0xc4, 0xcc, "CPY"],
] as const) {
  opcodes.set(immediate, { name, bytes: 2, cycles: 2 });
  opcodes.set(zeroPage, { name, bytes: 2, cycles: 3, access: "read" });
  opcodes.set(absolute, { name, bytes: 3, cycles: 4, access: "read" });
}
for (const [zeroPage, absolute, name] of [
  [0x85, 0x8d, "STA"],
  [0x86, 0x8e, "STX"],
  [0x84, 0x8c, "STY"],
] as const) {
  opcodes.set(zeroPage, { name, bytes: 2, cycles: 3, access: "write" });
  opcodes.set(absolute, { name, bytes: 3, cycles: 4, access: "write" });
}

function decodeStraightLine(bytes: readonly number[], start: number) {
  const result: (Opcode & { address: number; operand?: number })[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const form = opcodes.get(opcode);
    if (form === undefined)
      throw new Error(
        `Nominal startup cost is Unknown for unsupported opcode $${opcode.toString(16)} at $${(start + offset).toString(16)}; this bounded comparison does not analyze control-flow paths`,
      );
    expect(
      offset + form.bytes,
      "The component ends on an instruction boundary",
    ).toBeLessThanOrEqual(bytes.length);
    result.push({
      ...form,
      address: start + offset,
      ...(form.access === undefined
        ? {}
        : { operand: bytes[offset + 1]! | (form.bytes === 3 ? bytes[offset + 2]! << 8 : 0) }),
    });
    offset += form.bytes;
    if (form.name === "RTS")
      expect(offset, "RTS terminates the straight-line component").toBe(bytes.length);
  }
  expect(result.length).toBeGreaterThan(0);
  return result;
}

// Independent equal-contract expert ledger, with absolute private saves and caller I unchanged.
// Capture CPU0 in Y; returning firmware preserves it while A copies borrows and then captures CPU1.
// Snapshot borrowed BASIC bytes before changing mapping or writing any source workspace.
// Keep freshly captured CPU1 in A for latch setup, then establish direction and I/O visibility before DDRA.
const expertBase = [
  { intent: "Capture P with PHP, CLD, PLA, STA absolute", bytes: 6, cycles: 13 },
  { intent: "Capture CPU0 with LDY zero-page and STY absolute", bytes: 5, cycles: 7 },
  {
    intent:
      "Capture CPU1 with LDA zero-page/STA absolute, keep A live for AND $f8/ORA $06/STA CPU1",
    bytes: 11,
    cycles: 14,
  },
  { intent: "TYA, ORA immediate $07, store CPU0", bytes: 5, cycles: 7 },
  { intent: "Capture DDRA, keep A live, AND immediate $fc, store DDRA", bytes: 11, cycles: 14 },
  { intent: "Restore DDRA with LDA/STA absolute", bytes: 6, cycles: 8 },
  { intent: "Restore CPU1 then CPU0 with LDA absolute/STA zero-page", bytes: 10, cycles: 14 },
  { intent: "Restore P and return with LDA absolute, PHA, PLP, RTS", bytes: 6, cycles: 17 },
] as const;
const expertBytes = expertBase.reduce((sum, group) => sum + group.bytes, 0);
const expertCycles = expertBase.reduce((sum, group) => sum + group.cycles, 0);

const fixtures = [
  {
    name: "empty returning main",
    source: "module Game;\nfunction main(): void {}\n",
    workspace: false,
  },
  {
    name: "explicit eight-byte BASIC workspace",
    source: `module Game;
zeropage { place(at: $73) workspace: byte[8]; }
function main(): void {
  workspace[0] = 1; workspace[1] = 2; workspace[2] = 3; workspace[3] = 4;
  workspace[4] = 5; workspace[5] = 6; workspace[6] = 7; workspace[7] = 8;
}
`,
    workspace: true,
  },
] as const;

describe("compact cooperative startup register and state cost", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const fixture of fixtures) {
      it(`${profile}: ${fixture.name} meets the equal-contract expert startup budget`, async () => {
        const artifacts = await buildProfileSource(fixture.source, profile);
        expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
        const intervals = profileRecords(artifacts.memory.intervals);
        const interval = (id: string) => {
          const matches = intervals.filter((entry) => entry.id === id);
          expect(matches, id).toHaveLength(1);
          const entry = matches[0]!;
          expect(typeof entry.start).toBe("number");
          expect(typeof entry.end).toBe("number");
          expect(typeof entry.size).toBe("number");
          const start = entry.start as number;
          const end = entry.end as number;
          const size = entry.size as number;
          expect(Number.isInteger(start) && Number.isInteger(end) && Number.isInteger(size)).toBe(
            true,
          );
          expect(end - start).toBe(size);
          expect(size).toBeGreaterThan(0);
          return { start, end, size };
        };
        const entry = interval("code.startup.entry");
        const restore = interval("code.startup.restore");
        const state = interval("platform.startup-state");
        expect(libraryStartup(artifacts, "startup.entry")).toBe(entry.start);
        expect(libraryStartup(artifacts, "startup.restore")).toBe(restore.start);
        const main = libraryEntry(artifacts, "src/game.blend::Game.main");
        expect(entry.end).toBeLessThanOrEqual(main);
        expect(restore.start).toBeGreaterThan(main);
        const occupied = intervals.filter((item) => item.resourceClass === "zeroPage");
        const borrowed = new Set<number>();
        for (const item of occupied) {
          expect(typeof item.start).toBe("number");
          expect(typeof item.end).toBe("number");
          const start = item.start as number;
          const end = item.end as number;
          expect(Number.isInteger(start) && Number.isInteger(end)).toBe(true);
          expect(start).toBeGreaterThanOrEqual(2);
          expect(end).toBeLessThanOrEqual(0x90);
          expect(end).toBeGreaterThan(start);
          for (let address = Math.max(3, start); address < end; address += 1) borrowed.add(address);
        }
        if (fixture.workspace)
          for (let address = 0x73; address < 0x7b; address += 1)
            expect(borrowed.has(address)).toBe(true);

        const entryInstructions = decodeStraightLine(
          libraryBytes(artifacts, entry.start, entry.size),
          entry.start,
        );
        const restoreInstructions = decodeStraightLine(
          libraryBytes(artifacts, restore.start, restore.size),
          restore.start,
        );
        const instructions = [...entryInstructions, ...restoreInstructions];
        expect(restoreInstructions.at(-1)?.name).toBe("RTS");
        expect(
          instructions.some(
            (instruction) => instruction.name === "SEI" || instruction.name === "CLI",
          ),
        ).toBe(false);
        const accesses = (address: number, access: "read" | "write") =>
          instructions.filter(
            (instruction) => instruction.access === access && instruction.operand === address,
          );
        for (const address of [0, 1, 0xdd02]) {
          expect(
            accesses(address, "read"),
            "Each captured machine register is read once",
          ).toHaveLength(1);
          expect(
            accesses(address, "write"),
            "Each captured machine register is established and restored once",
          ).toHaveLength(2);
        }
        expect(accesses(0xdd00, "read")).toHaveLength(0);
        expect(accesses(0xdd00, "write")).toHaveLength(0);
        expect(
          instructions.filter(
            (instruction) =>
              instruction.operand !== undefined &&
              instruction.operand >= 0xd000 &&
              instruction.operand < 0xd400,
          ),
        ).toHaveLength(0);
        for (const component of [entryInstructions, restoreInstructions]) {
          const latch = component.findIndex(
            (instruction) => instruction.access === "write" && instruction.operand === 1,
          );
          const direction = component.findIndex(
            (instruction) => instruction.access === "write" && instruction.operand === 0,
          );
          expect(latch).toBeGreaterThanOrEqual(0);
          expect(direction).toBeGreaterThan(latch);
        }
        const directionEstablished = entryInstructions.findIndex(
          (instruction) => instruction.access === "write" && instruction.operand === 0,
        );
        expect(
          entryInstructions.findIndex(
            (instruction) => instruction.access === "read" && instruction.operand === 0xdd02,
          ),
          "CPU mapping establishes I/O visibility before CIA2 capture",
        ).toBeGreaterThan(directionEstablished);
        const firstMappingWrite = entryInstructions.findIndex(
          (instruction) => instruction.access === "write" && instruction.operand === 1,
        );
        for (const address of borrowed) {
          expect(
            entryInstructions.filter(
              (instruction) => instruction.access === "read" && instruction.operand === address,
            ),
          ).toHaveLength(1);
          expect(
            entryInstructions.findIndex(
              (instruction) => instruction.access === "read" && instruction.operand === address,
            ),
            "BASIC bytes are captured before banking or source writes",
          ).toBeLessThan(firstMappingWrite);
          expect(
            restoreInstructions.filter(
              (instruction) => instruction.access === "write" && instruction.operand === address,
            ),
          ).toHaveLength(1);
        }

        // One borrow costs LDA zero-page/STA absolute plus LDA absolute/STA zero-page: 10 bytes/14 cycles.
        // Four base save bytes hold P, CPU0, CPU1 and DDRA. Balanced calls/returns preserve incoming SP.
        const ceiling = {
          bytes: expertBytes + 10 * borrowed.size,
          cycles: expertCycles + 14 * borrowed.size,
          state: 4 + borrowed.size,
        };
        expect(expertBytes).toBe(60);
        expect(expertCycles).toBe(94);
        const actual = {
          bytes: entry.size + restore.size,
          cycles: instructions.reduce((sum, instruction) => sum + instruction.cycles, 0),
          state: state.size,
        };
        console.info(
          "startup-register-cost",
          profile,
          fixture.name,
          JSON.stringify({
            actual,
            ceiling,
            borrowed: [...borrowed].sort((left, right) => left - right),
            wholeArtifactBytes: artifacts.prg.length - 2,
            mainEntry: main,
          }),
        );
        expect
          .soft(actual.bytes, "Startup code is no larger than the equal-contract expert")
          .toBeLessThanOrEqual(ceiling.bytes);
        expect
          .soft(
            actual.cycles,
            "Straight-line nominal startup cycles are no slower than the equal-contract expert",
          )
          .toBeLessThanOrEqual(ceiling.cycles);
        expect
          .soft(
            actual.state,
            "Startup stores only required captured machine state and actual BASIC borrows",
          )
          .toBeLessThanOrEqual(ceiling.state);
        expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
      });
    }
  }
});
