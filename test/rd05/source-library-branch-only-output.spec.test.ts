import { describe, expect, it } from "vitest";
import {
  cia2FunctionVariants,
  cia2Instructions,
  expectCia2NoPrivateHomes,
} from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

/** Fixed byte predicates need only an ordered load and a branch for each reached leaf. */
const CONDITIONS = [
  { name: "and", expression: "peek(A) != 0 && peek(B) != 0", leaves: 2 },
  { name: "or", expression: "peek(A) != 0 || peek(B) != 0", leaves: 2 },
  { name: "and zero predicates", expression: "peek(A) == 0 && peek(B) == 0", leaves: 2 },
  { name: "or zero predicates", expression: "peek(A) == 0 || peek(B) == 0", leaves: 2 },
  {
    name: "and inside or",
    expression: "(peek(A) != 0 && peek(B) != 0) || peek(C) != 0",
    leaves: 3,
  },
  {
    name: "or inside and",
    expression: "(peek(A) != 0 || peek(B) != 0) && peek(C) != 0",
    leaves: 3,
  },
  {
    name: "right nested or",
    expression: "peek(A) != 0 && (peek(B) != 0 || peek(C) != 0)",
    leaves: 3,
  },
  {
    name: "right nested and",
    expression: "peek(A) != 0 || (peek(B) != 0 && peek(C) != 0)",
    leaves: 3,
  },
] as const;

/** Both scalar result paths and their returns belong to the measured routine. */
function source(expression: string): string {
  return `module Game;
const A: word = $3300;
const B: word = $3301;
const C: word = $3302;
place(at: $3200) let result: byte;
export function choose(): byte {
  if (${expression}) { return 1; }
  return 2;
}
export function observed(): void { }
export function main(): void { while (true) { result = choose(); observed(); } }`;
}

/** Fixed NMOS base cycles for these small complete routines, including staging if present. */
const CYCLES: Readonly<Record<number, number>> = {
  0x08: 3,
  0x09: 2,
  0x20: 6,
  0x28: 4,
  0x29: 2,
  0x48: 3,
  0x4c: 3,
  0x60: 6,
  0x68: 4,
  0x78: 2,
  0x85: 3,
  0x86: 3,
  0x8a: 2,
  0x8d: 4,
  0x8e: 4,
  0x90: 2,
  0xb0: 2,
  0xa2: 2,
  0xa5: 3,
  0xa6: 3,
  0xa9: 2,
  0xaa: 2,
  0xad: 4,
  0xae: 4,
  0xc9: 2,
  0xcd: 4,
  0xd0: 2,
  0xd8: 2,
  0xe0: 2,
  0xf0: 2,
};

/**
 * Charge every possible complete control path, including taken-branch page crossings and JMP
 * bridges. Both branch successors are explored conservatively; no source-range filtering is used.
 * These leaf fixtures have no loops, calls or external control targets.
 */
function worstPathCycles(bytes: Buffer, start: number): number {
  const decoded = cia2Instructions(bytes);
  const indexes = new Map(decoded.map((instruction, index) => [instruction.offset, index]));
  const visit = (offset: number, active: ReadonlySet<number>): number => {
    const index = indexes.get(offset);
    if (index === undefined)
      throw new Error(`Control target ${offset} is not an instruction boundary`);
    if (active.has(offset)) throw new Error("A bounded condition leaf must not contain a cycle");
    const instruction = decoded[index]!;
    const base = CYCLES[instruction.opcode];
    if (base === undefined) throw new Error("Missing official NMOS cycle evidence");
    const next = decoded[index + 1]?.offset ?? bytes.length;
    const visited = new Set([...active, offset]);
    if (instruction.opcode === 0x60) return base;
    if (instruction.opcode === 0x20)
      throw new Error("These scalar condition leaves need no helper call");
    if (instruction.opcode === 0x4c) {
      if (instruction.operand === null) throw new Error("JMP requires its absolute target");
      return base + visit(instruction.operand - start, visited);
    }
    if ([0x90, 0xb0, 0xd0, 0xf0].includes(instruction.opcode)) {
      if (instruction.operand === null)
        throw new Error("A relative branch requires its displacement");
      const displacement =
        instruction.operand < 128 ? instruction.operand : instruction.operand - 256;
      const target = next + displacement;
      const pagePenalty = (start + next) >>> 8 === (start + target) >>> 8 ? 0 : 1;
      return base + Math.max(visit(next, visited), 1 + pagePenalty + visit(target, visited));
    }
    return base + visit(next, visited);
  };
  return visit(0, new Set());
}

describe.each(sourceLibraryProfiles)("complete branch-only condition leaves on %s", (profile) => {
  it.each(CONDITIONS)(
    "should meet the complete expert leaf cost for $name",
    async ({ expression, leaves }) => {
      // Each load/branch pair costs 5 bytes; two LDA-immediate/RTS arms add 6 bytes.
      // The longest expert path costs 6 cycles per reached leaf plus 9, with at most one page penalty.
      await withLibraryBuild(source(expression), "module Extra;", profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        const variants = cia2FunctionVariants(artifacts, "choose");
        expect(variants).toHaveLength(1);
        for (const { bytes, start } of variants) {
          expect(
            bytes.length,
            "Both result arms, returns and layout bridges are charged",
          ).toBeLessThanOrEqual(5 * leaves + 6);
          expect(worstPathCycles(bytes, start)).toBeLessThanOrEqual(6 * leaves + 10);
        }
      });
    },
    180_000,
  );

  it.each(CONDITIONS)(
    "should branch directly without Boolean homes or staging for $name",
    async ({ expression }) => {
      // A condition consumed only by control flow has no Boolean object to store or reload.
      await withLibraryBuild(source(expression), "module Extra;", profile, async (artifacts) => {
        const variants = cia2FunctionVariants(artifacts, "choose");
        expect(variants).toHaveLength(1);
        expectCia2NoPrivateHomes(artifacts, ["choose"]);
        for (const { bytes } of variants) {
          const decoded = cia2Instructions(bytes);
          expect(
            decoded.every(({ opcode }) => [0xad, 0xa9, 0xd0, 0xf0, 0x4c, 0x60].includes(opcode)),
            "Fixed byte-zero predicates need loads, branches and the final scalar result only",
          ).toBe(true);
          expect(
            decoded
              .filter(({ opcode }) => opcode === 0xad)
              .map(({ operand }) => operand)
              .sort((left, right) => Number(left) - Number(right)),
          ).toEqual(expression.includes("peek(C)") ? [0x3300, 0x3301, 0x3302] : [0x3300, 0x3301]);
          expect(
            decoded
              .filter(({ opcode }) => opcode === 0xa9)
              .map(({ operand }) => operand)
              .sort(),
          ).toEqual([1, 2]);
        }
      });
    },
    180_000,
  );
});
