import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

/** A sole branch-only Boolean call result selects immediate byte-return continuations. */
const SOURCE = `module Game;
place(at: $3300) let input: boolean;
place(at: $3200) let result: byte;
place(at: $3401) let marker: byte;
export function ready(): boolean { return input; }
export function choose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
export function observed(): void { marker = $5a; }
export function main(): void { while (true) { result = choose(); observed(); } }`;

/** Official NMOS forms include older materialization idioms so rejection is a real cost/storage failure. */
const SHAPES = new Map<number, readonly [number, number]>();
for (const row of [
  "08:1:3 09:2:2 18:1:2 20:3:6 24:2:3 28:1:4 29:2:2 2c:3:4 38:1:2",
  "48:1:3 49:2:2 4c:3:3 60:1:6 65:2:3 68:1:4 69:2:2 6d:3:4",
  "84:2:3 85:2:3 86:2:3 8a:1:2 8c:3:4 8d:3:4 8e:3:4 98:1:2",
  "a0:2:2 a2:2:2 a4:2:3 a5:2:3 a6:2:3 a8:1:2 a9:2:2 aa:1:2 ac:3:4 ad:3:4 ae:3:4",
  "c5:2:3 c9:2:2 cd:3:4 e5:2:3 e9:2:2 ea:1:2 ed:3:4",
  "10:2:2 30:2:2 50:2:2 70:2:2 90:2:2 b0:2:2 d0:2:2 f0:2:2",
]) {
  for (const entry of row.split(" ")) {
    const [opcode, width, cycles] = entry.split(":");
    SHAPES.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }
}

/** Each instruction belongs to the complete published function boundary, including retained padding. */
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
      throw new Error(`Unaccounted complete byte-return instruction $${opcode.toString(16)}`);
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
const STACK_SAVES = [0x08, 0x28, 0x48, 0x68];

/** JSR traffic is charged here; the unchanged callee's body is separately measured below. */
function completeCycles(code: readonly Instruction[], start: number, pages: boolean): number {
  const byOffset = new Map(code.map((instruction) => [instruction.offset, instruction]));
  const visit = (offset: number, active: ReadonlySet<number>): number => {
    const instruction = byOffset.get(offset);
    if (!instruction || active.has(offset))
      throw new Error("Incomplete or cyclic byte-return boundary");
    const visited = new Set([...active, offset]);
    const next = offset + instruction.width;
    if (instruction.opcode === 0x60) return 6;
    if (instruction.opcode === 0x4c) return 3 + visit(Number(instruction.operand) - start, visited);
    if (BRANCHES.includes(instruction.opcode)) {
      const displacement = Number(instruction.operand);
      const target = next + (displacement < 128 ? displacement : displacement - 256);
      const page = pages && (start + next) >>> 8 !== (start + target) >>> 8 ? 1 : 0;
      return 2 + Math.max(visit(next, visited), 1 + page + visit(target, visited));
    }
    return instruction.cycles + visit(next, visited);
  };
  return visit(0, new Set());
}

describe.each(sourceLibraryProfiles)(
  "ordinary mainline constant-byte return tests on %s",
  (profile) => {
    it("should meet the twelve-byte complete wrapper floor without staging or a callee-flag promise", async () => {
      // Expert idiom: JSR (3B/6cy), A-to-index zero test (1B/2cy), branch (2B/2–3cy),
      // two LDA-immediate/RTS return arms (6B; one selected arm 8cy): 12B, paths 18/19cy.
      // The index is disposable only for this pair of immediate byte-return continuations.
      // NMI execution variants are outside this ordinary-mainline floor and retain their separate contract.
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        // The source objects' resident bytes stay charged and typed independently of the local code floor.
        expect(libraryGlobalAddress(artifacts, SOURCE, "input", 1, "src/game.blend")).toBe(0x3300);
        expect(libraryGlobalAddress(artifacts, SOURCE, "result", 1, "src/game.blend")).toBe(0x3200);
        expect(libraryGlobalAddress(artifacts, SOURCE, "marker", 1, "src/game.blend")).toBe(0x3401);
        const callee = libraryEntry(artifacts, "src/game.blend::Game.ready");
        const variants = cia2FunctionVariants(artifacts, "choose");
        expect(variants).toHaveLength(1);
        for (const { bytes, start } of variants) {
          const code = decode(bytes);
          expect(code.reduce((sum, instruction) => sum + instruction.width, 0)).toBe(bytes.length);
          expect(
            code.filter(({ opcode }) => opcode === 0x20).map(({ operand }) => operand),
          ).toEqual([callee]);
          expect(code.filter(({ opcode }) => STORES.includes(opcode))).toHaveLength(0);
          expect(code.filter(({ opcode }) => STACK_SAVES.includes(opcode))).toHaveLength(0);
          expect(bytes.length).toBeLessThanOrEqual(12);
          expect(completeCycles(code, start, false)).toBeLessThanOrEqual(19);
          // One selected relative branch may add its official final-layout page-crossing cycle.
          expect(completeCycles(code, start, true)).toBeLessThanOrEqual(20);
          // One JSR adds two transient hardware-stack bytes; there is no RAM/ZP staging traffic.
          // Loader, main, external IRQ/NMI stack, and whole-program placement are outside this leaf bound.
        }
      });
    }, 180_000);

    it("should charge the ordinary unchanged Boolean callee separately without adding scratch", async () => {
      // LDA absolute source Boolean + RTS is 4B/10cy; it does not promise returned arithmetic flags.
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        const input = libraryGlobalAddress(artifacts, SOURCE, "input", 1, "src/game.blend");
        const variants = cia2FunctionVariants(artifacts, "ready");
        expect(variants).toHaveLength(1);
        for (const { bytes, start } of variants) {
          const code = decode(bytes);
          expect(code.some(({ opcode, operand }) => opcode === 0xad && operand === input)).toBe(
            true,
          );
          expect(code.filter(({ opcode }) => STORES.includes(opcode))).toHaveLength(0);
          expect(code.filter(({ opcode }) => STACK_SAVES.includes(opcode))).toHaveLength(0);
          expect(code.filter(({ opcode }) => opcode === 0x20)).toHaveLength(0);
          expect(bytes.length).toBeLessThanOrEqual(4);
          expect(completeCycles(code, start, true)).toBeLessThanOrEqual(10);
        }
      });
    }, 180_000);
  },
);
