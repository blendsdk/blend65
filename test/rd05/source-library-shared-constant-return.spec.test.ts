import { describe, expect, it } from "vitest";
import { cia2Instructions, expectCia2NoPrivateHomes } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const values = [0, 1, 0x80, 0xff] as const;
const chains = [
  { name: "two ordered tests", reads: 2, bytes: 16 },
  { name: "three ordered tests", reads: 3, bytes: 21 },
] as const;

function source(reads: number): string {
  return `module Game;
place(at: $3300) let input: byte;
place(at: $3200) let result: byte;
function classify(): byte {
    if (input != 0) { return 2; }
    if (peek($3301) != 0) { return 2; }
    ${reads === 3 ? "if (peek($3302) != 0) { return 2; }" : ""}
    return 1;
}
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { result = classify(); observed(); }
}`;
}

/** Charge complete acyclic paths without requiring a particular shared-label layout. */
function expectSharedReturnPaths(bytes: number[], start: number, maximumReads: number): void {
  const instructions = cia2Instructions(Buffer.from(bytes));
  const byOffset = new Map(instructions.map((instruction) => [instruction.offset, instruction]));
  expect(
    instructions.every(({ opcode }) => [0xad, 0xa9, 0xf0, 0xd0, 0x4c, 0x60].includes(opcode)),
    "Constant returns need no stores, scratch or explicit stack traffic",
  ).toBe(true);
  for (const { opcode, operand } of instructions) {
    if (opcode === 0xad)
      expect(Array.from({ length: maximumReads }, (_, index) => 0x3300 + index)).toContain(operand);
    if (opcode === 0xa9) expect([1, 2]).toContain(operand);
  }
  const paths: { reads: readonly number[]; cycles: number; pagePenalty: number }[] = [];
  const walk = (
    offset: number,
    cycles: number,
    pagePenalty: number,
    reads: readonly number[],
    visited: ReadonlySet<number>,
    constant: number | undefined,
  ): void => {
    expect(visited.has(offset), "Every constant-return path must terminate").toBe(false);
    const instruction = byOffset.get(offset);
    if (instruction === undefined) throw new Error("Return path leaves its complete function");
    const nextVisited = new Set([...visited, offset]);
    const { opcode, operand } = instruction;
    if (opcode === 0x60) {
      expect([1, 2], "Ordinary byte return retains the selected constant").toContain(constant);
      paths.push({ reads, cycles: cycles + 6, pagePenalty });
      return;
    }
    if (opcode === 0xad) {
      walk(offset + 3, cycles + 4, pagePenalty, [...reads, operand!], nextVisited, undefined);
      return;
    }
    if (opcode === 0xa9) {
      walk(offset + 2, cycles + 2, pagePenalty, reads, nextVisited, operand!);
      return;
    }
    if (opcode === 0x4c) {
      walk(operand! - start, cycles + 3, pagePenalty, reads, nextVisited, constant);
      return;
    }
    const next = offset + 2;
    const target = next + (operand! < 0x80 ? operand! : operand! - 0x100);
    // A known immediate value is nonzero; BEQ cannot take its edge and BNE cannot fall through.
    if (constant === undefined || opcode === 0xf0)
      walk(next, cycles + 2, pagePenalty, reads, nextVisited, constant);
    if (constant === undefined || opcode === 0xd0) {
      const crossing = Number((start + next) >> 8 !== (start + target) >> 8);
      walk(target, cycles + 3 + crossing, pagePenalty + crossing, reads, nextVisited, constant);
    }
  };
  walk(0, 0, 0, [], new Set(), undefined);
  expect(paths.length).toBeGreaterThan(1);
  for (const path of paths) {
    expect(path.reads.length).toBeGreaterThanOrEqual(1);
    expect(path.reads.length).toBeLessThanOrEqual(maximumReads);
    expect(path.reads).toEqual(
      Array.from({ length: path.reads.length }, (_, index) => 0x3300 + index),
    );
    // Each absolute LDA is 4 cycles, each branch 2/3, immediate LDA 2 and full RTS 6.
    expect(path.cycles - path.pagePenalty).toBeLessThanOrEqual(6 * path.reads.length + 9);
  }
  for (let reads = 1; reads <= maximumReads; reads += 1)
    expect(paths.some((path) => path.reads.length === reads)).toBe(true);
}

describe("ordinary shared constant-return arms", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const chain of chains) {
      it(`${profile}: ${chain.name} shares pure returns within complete expert costs`, async () => {
        await withLibraryBuild(
          source(chain.reads),
          "module Library;",
          profile,
          async (artifacts) => {
            const name = "src/game.blend::Game.classify";
            const bytes = libraryFunctionBytes(artifacts, name);
            // Count the whole published body before decoding, including jumps, padding and all returns.
            expect(bytes.length).toBeLessThanOrEqual(chain.bytes);
            expectSharedReturnPaths(bytes, libraryEntry(artifacts, name), chain.reads);
            expectCia2NoPrivateHomes(artifacts, ["classify"]);
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);

      it(`${profile}: ${chain.name} preserves byte values and ordered bypass in native execution`, async () => {
        await withLibraryBuild(
          source(chain.reads),
          "module Library;",
          profile,
          async (artifacts, built) => {
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              const entry = libraryEntry(artifacts, "src/game.blend::Game.classify");
              const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
              await stopAt(entry);
              const events = new Map<number, string>();
              for (const address of [0x3300, 0x3301, 0x3302]) {
                for (const operation of ["load", "store"] as const) {
                  events.set(
                    await monitor.setAccessTracepoint(address, operation),
                    `${operation}:$${address.toString(16)}`,
                  );
                }
              }
              for (const address of [0x3200, 0x3201]) {
                events.set(
                  await monitor.setAccessTracepoint(address, "store"),
                  `store:$${address.toString(16)}`,
                );
              }
              const trace = () =>
                monitor.takeCheckpointHits().flatMap((id) => {
                  const event = events.get(id);
                  return event === undefined ? [] : [event];
                });
              try {
                for (const first of values) {
                  for (const second of values) {
                    for (const third of chain.reads === 3 ? values : [0]) {
                      const input = [first, second, third];
                      await monitor.writeMemory(0x3300, new Uint8Array(input));
                      await monitor.writeMemory(0x3200, new Uint8Array([0x5a, 0]));
                      const before = await monitor.readCpuRegisters();
                      trace();
                      await stopAt(observed);
                      const after = await monitor.readCpuRegisters();
                      const firstMatch = input
                        .slice(0, chain.reads)
                        .findIndex((value) => value !== 0);
                      const reads = firstMatch < 0 ? chain.reads : firstMatch + 1;
                      expect((await monitor.readMemory(0x3200, 0x3200))[0]).toBe(
                        firstMatch < 0 ? 1 : 2,
                      );
                      expect(trace()).toEqual([
                        ...Array.from(
                          { length: reads },
                          (_, i) => `load:$${(0x3300 + i).toString(16)}`,
                        ),
                        "store:$3200",
                      ]);
                      expect([...(await monitor.readMemory(0x3300, 0x3302))]).toEqual(input);
                      expect(after.sp).toBe(before.sp);
                      expect(after.p & 0x0c).toBe(before.p & 0x0c);
                      await stopAt(entry);
                      expect(trace()).toEqual(["store:$3201"]);
                      expect((await monitor.readMemory(0x3201, 0x3201))[0]).toBe(0xa5);
                    }
                  }
                }
              } finally {
                for (const checkpoint of events.keys()) await monitor.deleteCheckpoint(checkpoint);
              }
            });
          },
        );
      }, 180_000);
    }
  }
});
