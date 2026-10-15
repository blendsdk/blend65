import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const predicates = [
  { name: "less than 128", expression: "m < 128" },
  { name: "greater than 127", expression: "m > 127" },
  { name: "at least 128", expression: "m >= 128" },
  { name: "at most 127", expression: "m <= 127" },
] as const;

function source(expression: string): string {
  return `module Game;
place(at: $3200) let result: byte;
function choose(): byte {
    let m: byte = peek($3300);
    if (${expression}) { interfere(); }
    return m;
}
function interfere(): void { poke($3210, $A1); poke($3300, $CC); }
function step(): void { poke($3202, $5A); }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { step(); result = choose(); observed(); }
}`;
}

const instructionCosts: Readonly<Record<number, readonly [number, number]>> = {
  0x10: [2, 2],
  0x20: [3, 6],
  0x30: [2, 2],
  0x4c: [3, 3],
  0x50: [2, 2],
  0x60: [1, 6],
  0x70: [2, 2],
  0x84: [2, 3],
  0x85: [2, 3],
  0x86: [2, 3],
  0x8a: [1, 2],
  0x8c: [3, 4],
  0x8d: [3, 4],
  0x8e: [3, 4],
  0x90: [2, 2],
  0x98: [1, 2],
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
  0xb0: [2, 2],
  0xc0: [2, 2],
  0xc4: [2, 3],
  0xc5: [2, 3],
  0xc9: [2, 2],
  0xcc: [3, 4],
  0xcd: [3, 4],
  0xd0: [2, 2],
  0xe0: [2, 2],
  0xe4: [2, 3],
  0xea: [1, 2],
  0xec: [3, 4],
  0xf0: [2, 2],
};
const branches = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);
const stores = new Set([0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e]);
const memoryOperands = new Set([
  ...stores,
  0xa4,
  0xa5,
  0xa6,
  0xac,
  0xad,
  0xae,
  0xc4,
  0xc5,
  0xcc,
  0xcd,
  0xe4,
  0xec,
]);

/** Decode only the documented forms needed by this bounded byte comparison and its helper. */
function instructions(bytes: readonly number[]) {
  const result: {
    offset: number;
    opcode: number;
    operand: number | undefined;
    size: number;
    cycles: number;
  }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const cost = instructionCosts[opcode];
    if (cost === undefined || offset + cost[0] > bytes.length)
      throw new Error(
        `Unexpected captured-comparison instruction $${opcode.toString(16)} at ${offset}`,
      );
    const operand =
      cost[0] === 1
        ? undefined
        : cost[0] === 2
          ? bytes[offset + 1]!
          : bytes[offset + 1]! | (bytes[offset + 2]! << 8);
    result.push({ offset, opcode, operand, size: cost[0], cycles: cost[1] });
    offset += cost[0];
  }
  return result;
}

/** Charge complete owner paths, retaining helper-body cycles as a separate term. */
function expectOwnerPaths(
  bytes: number[],
  start: number,
  helper: number,
  helperCycles: number,
): void {
  const body = instructions(bytes);
  const byOffset = new Map(body.map((row) => [row.offset, row]));
  const paths: { cycles: number; penalty: number; calls: number; reads: number }[] = [];
  const walk = (
    offset: number,
    cycles: number,
    penalty: number,
    calls: number,
    reads: number,
    visited: ReadonlySet<number>,
  ): void => {
    expect(visited.has(offset), "Captured comparison must return along a finite path").toBe(false);
    const row = byOffset.get(offset);
    if (row === undefined)
      throw new Error("Comparison path leaves its complete published function");
    const nextVisited = new Set([...visited, offset]);
    const next = offset + row.size;
    const nextReads =
      reads + Number([0xad, 0xae, 0xac].includes(row.opcode) && row.operand === 0x3300);
    if (row.opcode === 0x60) {
      paths.push({ cycles: cycles + 6, penalty, calls, reads: nextReads });
      return;
    }
    if (row.opcode === 0x20) {
      expect(row.operand).toBe(helper);
      walk(next, cycles + 6, penalty, calls + 1, nextReads, nextVisited);
      return;
    }
    if (row.opcode === 0x4c) {
      walk(row.operand! - start, cycles + 3, penalty, calls, nextReads, nextVisited);
      return;
    }
    if (branches.has(row.opcode)) {
      const target = next + (row.operand! < 0x80 ? row.operand! : row.operand! - 0x100);
      const crossing = Number((start + next) >> 8 !== (start + target) >> 8);
      walk(next, cycles + 2, penalty, calls, nextReads, nextVisited);
      walk(target, cycles + 3 + crossing, penalty + crossing, calls, nextReads, nextVisited);
      return;
    }
    walk(next, cycles + row.cycles, penalty, calls, nextReads, nextVisited);
  };
  walk(0, 0, 0, 0, 0, new Set());
  for (const path of paths) {
    expect(path.reads).toBe(1);
    expect(path.calls).toBeLessThanOrEqual(1);
    const ownerBound = path.calls === 0 ? 13 : 26;
    expect(path.cycles - path.penalty).toBeLessThanOrEqual(ownerBound);
    expect(path.cycles + path.calls * helperCycles).toBeLessThanOrEqual(
      (path.calls === 0 ? 13 : 44) + path.penalty,
    );
  }
  expect(paths.some(({ calls }) => calls === 0)).toBe(true);
  expect(paths.some(({ calls }) => calls === 1)).toBe(true);
}

describe("captured byte comparison complete output", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate.name} preserves the capture within the smallest shared-return costs`, async () => {
        await withLibraryBuild(
          source(predicate.expression),
          "module Library;",
          profile,
          async (artifacts) => {
            const name = "src/game.blend::Game.choose";
            const bytes = libraryFunctionBytes(artifacts, name);
            // LDA sets N. Branch first, save only on the clobbered path, then share the final RTS.
            expect(bytes.length).toBeLessThanOrEqual(15);
            const helperName = "src/game.blend::Game.interfere";
            const helper = libraryFunctionBytes(artifacts, helperName);
            expect(helper.length).toBeLessThanOrEqual(11);
            const helperBody = instructions(helper);
            expect(
              helperBody.some(
                ({ opcode }) => branches.has(opcode) || opcode === 0x20 || opcode === 0x4c,
              ),
            ).toBe(false);
            expect(helperBody.filter(({ opcode }) => opcode === 0x60)).toHaveLength(1);
            expect(helper.at(-1)).toBe(0x60);
            for (const row of helperBody) {
              if (!memoryOperands.has(row.opcode)) continue;
              expect(stores.has(row.opcode), "Pure constant helper performs no data reads").toBe(
                true,
              );
              expect([0x3210, 0x3300]).toContain(row.operand);
            }
            const helperCycles = helperBody.reduce((total, row) => total + row.cycles, 0);
            expect(helperCycles).toBeLessThanOrEqual(18);
            expectOwnerPaths(
              bytes,
              libraryEntry(artifacts, name),
              libraryEntry(artifacts, helperName),
              helperCycles,
            );
            let privateBytes = 0;
            const privateAddresses = new Set<number>();
            for (const interval of profileRecords(artifacts.memory.intervals)) {
              if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) continue;
              const owner = profileRecord(interval.owner);
              if (typeof owner.id !== "string")
                throw new TypeError("Private storage requires an owner identity");
              const identities: unknown = owner.id.startsWith("overlay:")
                ? JSON.parse(owner.id.slice("overlay:".length))
                : [owner.id];
              if (!Array.isArray(identities) || !identities.every((id) => typeof id === "string"))
                throw new TypeError("Private storage overlay identities must be strings");
              if (!identities.some((id: string) => id === name || id.startsWith(`${name}::`)))
                continue;
              if (
                typeof interval.size !== "number" ||
                !Number.isInteger(interval.size) ||
                interval.size < 0
              )
                throw new TypeError("Private storage requires complete integral byte costs");
              if (typeof interval.start !== "number" || !Number.isInteger(interval.start))
                throw new TypeError("Private storage requires a physical integral start address");
              privateBytes += interval.size;
              for (let index = 0; index < interval.size; index += 1)
                privateAddresses.add(interval.start + index);
            }
            expect(privateBytes).toBeLessThanOrEqual(1);
            for (const row of instructions(bytes)) {
              if (!memoryOperands.has(row.opcode)) continue;
              expect(
                privateAddresses.has(row.operand!) ||
                  (!stores.has(row.opcode) && row.operand === 0x3300),
                "Owner accesses only the captured source and its accounted private home",
              ).toBe(true);
            }
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);
    }
  }
});
