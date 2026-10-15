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
  { name: "zero inequality", expression: "input != 0", bytes: 8, oneReadCycles: 14, reads: 1 },
  {
    name: "ordered conjunction",
    expression: "(input != 0) && (peek($3301) != 0)",
    bytes: 13,
    oneReadCycles: 13,
    reads: 2,
  },
  {
    name: "ordered disjunction",
    expression: "(input == 0) || (peek($3301) != 0)",
    bytes: 13,
    oneReadCycles: 15,
    reads: 2,
  },
] as const;

function source(expression: string): string {
  return `module Game;
place(at: $3300) let input: byte;
place(at: $3200) let result: boolean;
function predicate(): boolean { return ${expression}; }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { result = predicate(); observed(); }
}`;
}

/** Enumerate complete acyclic paths using official load, branch, jump and return costs. */
function expectCompletePaths(
  bytes: number[],
  start: number,
  predicate: (typeof predicates)[number],
): void {
  const instructions = cia2Instructions(Buffer.from(bytes));
  const byOffset = new Map(instructions.map((instruction) => [instruction.offset, instruction]));
  expect(
    instructions.every(({ opcode }) => [0xad, 0xa9, 0xf0, 0xd0, 0x4c, 0x60].includes(opcode)),
    "A zero predicate needs no stores, scratch, stack saves or additional instruction machinery",
  ).toBe(true);
  for (const { opcode, operand } of instructions) {
    if (opcode === 0xad)
      expect([0x3300, ...(predicate.reads === 2 ? [0x3301] : [])]).toContain(operand);
    if (opcode === 0xa9) expect([0, 1]).toContain(operand);
  }
  const paths: { reads: readonly number[]; nominalCycles: number; branchPagePenalty: number }[] =
    [];
  const walk = (
    offset: number,
    nominalCycles: number,
    branchPagePenalty: number,
    reads: readonly number[],
    visited: ReadonlySet<number>,
    canonical: boolean,
    zero: boolean | undefined,
  ): void => {
    expect(visited.has(offset), "Every returned predicate path must terminate").toBe(false);
    const instruction = byOffset.get(offset);
    if (instruction === undefined) throw new Error("Predicate path leaves its published function");
    const nextVisited = new Set([...visited, offset]);
    const { opcode, operand } = instruction;
    if (opcode === 0x60) {
      // A tested zero byte can return directly; every surviving nonzero byte needs canonicalization.
      expect(
        canonical || zero === true,
        "Complete predicate returns the canonical byte zero or one",
      ).toBe(true);
      paths.push({ reads, nominalCycles: nominalCycles + 6, branchPagePenalty });
      return;
    }
    if (opcode === 0xad) {
      walk(
        offset + 3,
        nominalCycles + 4,
        branchPagePenalty,
        [...reads, operand!],
        nextVisited,
        false,
        undefined,
      );
      return;
    }
    if (opcode === 0xa9) {
      walk(
        offset + 2,
        nominalCycles + 2,
        branchPagePenalty,
        reads,
        nextVisited,
        true,
        operand === 0,
      );
      return;
    }
    if (opcode === 0x4c) {
      walk(
        operand! - start,
        nominalCycles + 3,
        branchPagePenalty,
        reads,
        nextVisited,
        canonical,
        zero,
      );
      return;
    }
    const next = offset + 2;
    const target = next + (operand! < 0x80 ? operand! : operand! - 0x100);
    const takenZero = opcode === 0xf0;
    // Branches and JMP preserve the Z flag from the last load; known constant edges are infeasible.
    if (zero === undefined || zero !== takenZero)
      walk(next, nominalCycles + 2, branchPagePenalty, reads, nextVisited, canonical, !takenZero);
    if (zero === undefined || zero === takenZero) {
      const pagePenalty = Number((start + next) >> 8 !== (start + target) >> 8);
      walk(
        target,
        nominalCycles + 3,
        branchPagePenalty + pagePenalty,
        reads,
        nextVisited,
        canonical,
        takenZero,
      );
    }
  };
  walk(0, 0, 0, [], new Set(), false, undefined);
  expect(paths.length).toBeGreaterThan(1);
  for (const path of paths) {
    expect(path.reads).toEqual(path.reads.length === 1 ? [0x3300] : [0x3300, 0x3301]);
    expect(path.reads.length).toBeLessThanOrEqual(predicate.reads);
    const bound = path.reads.length === 1 ? predicate.oneReadCycles : 20;
    // Absolute LDA is 4 cycles, immediate LDA 2, branch 2/3, JMP 3 and complete RTS 6.
    expect(path.nominalCycles).toBeLessThanOrEqual(bound);
    const actualCycles = path.nominalCycles + path.branchPagePenalty;
    expect(actualCycles).toBeLessThanOrEqual(bound + path.branchPagePenalty);
  }
  expect(paths.some(({ reads }) => reads.length === 1)).toBe(true);
  expect(paths.some(({ reads }) => reads.length === predicate.reads)).toBe(true);
}

describe("compact canonical zero-predicate returns", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate.name} meets the complete compact expert return bounds`, async () => {
        await withLibraryBuild(
          source(predicate.expression),
          "module Library;",
          profile,
          async (artifacts) => {
            const name = "src/game.blend::Game.predicate";
            const bytes = libraryFunctionBytes(artifacts, name);
            // Public complete boundaries charge every return, jump, arm and padding byte first.
            expect(bytes.length).toBeLessThanOrEqual(predicate.bytes);
            expectCompletePaths(bytes, libraryEntry(artifacts, name), predicate);
            expectCia2NoPrivateHomes(artifacts, ["predicate"]);
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);
    }
  }
});
