import { describe, expect, it } from "vitest";
import { cia2Instructions, expectCia2NoPrivateHomes } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const predicates = [
  { name: "zero equality", expression: "input == 0", bytes: 11, reads: 1 },
  { name: "zero inequality", expression: "input != 0", bytes: 11, reads: 1 },
  {
    name: "ordered conjunction",
    expression: "(input != 0) && (peek($3301) != 0)",
    bytes: 16,
    reads: 2,
  },
  {
    name: "ordered disjunction",
    expression: "(input == 0) || (peek($3301) != 0)",
    bytes: 16,
    reads: 2,
  },
] as const;

function source(expression: string, raw = false): string {
  return `module Game;
place(at: $3300) let ${raw ? "rawBool: boolean" : "input: byte"};
place(at: $3200) let result: boolean;
function predicate(): boolean { return ${expression}; }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { result = predicate(); observed(); }
}`;
}

/** Charge every acyclic instruction path, including the complete return and branch page cost. */
function expectPredicatePaths(bytes: number[], start: number, maximumReads: number): void {
  const instructions = cia2Instructions(Buffer.from(bytes));
  const byOffset = new Map(instructions.map((instruction) => [instruction.offset, instruction]));
  expect(instructions[0]).toMatchObject({ opcode: 0xad, operand: 0x3300 });
  expect(
    instructions.every(({ opcode }) => [0xad, 0xa9, 0xf0, 0xd0, 0x4c, 0x60].includes(opcode)),
  ).toBe(true);
  for (const { opcode, operand } of instructions) {
    if (opcode === 0xad)
      expect([0x3300, ...(maximumReads === 2 ? [0x3301] : [])]).toContain(operand);
    if (opcode === 0xa9) expect([0, 1]).toContain(operand);
  }
  const paths: { reads: number; cycles: number; penalties: number }[] = [];
  const walk = (
    offset: number,
    cycles: number,
    penalties: number,
    reads: number,
    visited: ReadonlySet<number>,
  ): void => {
    expect(visited.has(offset), "A returned predicate must have a finite instruction path").toBe(
      false,
    );
    const instruction = byOffset.get(offset);
    if (instruction === undefined) throw new Error("Predicate path leaves its complete function");
    const nextVisited = new Set([...visited, offset]);
    const { opcode, operand } = instruction;
    if (opcode === 0x60) {
      paths.push({ reads, cycles: cycles + 6, penalties });
      return;
    }
    if (opcode === 0xad || opcode === 0xa9) {
      walk(
        offset + (opcode === 0xad ? 3 : 2),
        cycles + (opcode === 0xad ? 4 : 2),
        penalties,
        reads + Number(opcode === 0xad),
        nextVisited,
      );
      return;
    }
    if (opcode === 0x4c) {
      walk(operand! - start, cycles + 3, penalties, reads, nextVisited);
      return;
    }
    const next = offset + 2;
    const target = next + (operand! < 0x80 ? operand! : operand! - 0x100);
    const pagePenalty = Number((start + next) >> 8 !== (start + target) >> 8);
    walk(next, cycles + 2, penalties, reads, nextVisited);
    walk(target, cycles + 3 + pagePenalty, penalties + pagePenalty, reads, nextVisited);
  };
  walk(0, 0, 0, 0, new Set());
  expect(paths.length).toBeGreaterThan(1);
  for (const path of paths) {
    expect(path.reads).toBeGreaterThanOrEqual(1);
    expect(path.reads).toBeLessThanOrEqual(maximumReads);
    // Absolute LDA: 4; branch: 2/3 plus actual page crossing; immediate LDA: 2; RTS: 6.
    expect(path.cycles - path.penalties).toBeLessThanOrEqual(path.reads === 1 ? 15 : 21);
  }
  expect(paths.some(({ reads }) => reads === maximumReads)).toBe(true);
}

describe("ordinary returned predicate whole-function output", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate.name} meets complete expert byte and path-cycle bounds`, async () => {
        await withLibraryBuild(
          source(predicate.expression),
          "module Library;",
          profile,
          async (artifacts) => {
            const name = "src/game.blend::Game.predicate";
            const bytes = libraryFunctionBytes(artifacts, name);
            // Complete boundaries charge all arms, returns, jumps and any layout padding.
            expect(bytes.length).toBeLessThanOrEqual(predicate.bytes);
            expectPredicatePaths(bytes, libraryEntry(artifacts, name), predicate.reads);
            expectCia2NoPrivateHomes(artifacts, ["predicate"]);
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);
    }
    it(`${profile}: raw Boolean return preserves its representation without materialization`, async () => {
      await withLibraryBuild(
        source("rawBool", true),
        "module Library;",
        profile,
        async (artifacts) => {
          const bytes = libraryFunctionBytes(artifacts, "src/game.blend::Game.predicate");
          expect(bytes).toEqual([0xad, 0x00, 0x33, 0x60]);
          expectCia2NoPrivateHomes(artifacts, ["predicate"]);
          expectLibraryAccounting(artifacts);
        },
      );
    }, 60_000);
  }
});
