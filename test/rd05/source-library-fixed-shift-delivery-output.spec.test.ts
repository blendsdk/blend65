import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const shifts = [
  { name: "unsigned left 1", operator: "<<", count: 1, signed: false, bytes: 8, cycles: 16 },
  { name: "unsigned left 3", operator: "<<", count: 3, signed: false, bytes: 10, cycles: 20 },
  { name: "unsigned left 7", operator: "<<", count: 7, signed: false, bytes: 11, cycles: 20 },
  { name: "unsigned right 1", operator: ">>", count: 1, signed: false, bytes: 8, cycles: 16 },
  { name: "unsigned right 3", operator: ">>", count: 3, signed: false, bytes: 10, cycles: 20 },
  { name: "unsigned right 7", operator: ">>", count: 7, signed: false, bytes: 11, cycles: 20 },
  { name: "signed right 1", operator: ">>", count: 1, signed: true, bytes: 10, cycles: 18 },
] as const;
/** Keep the scalar parameter ABI and ordinary clobbering caller markers visible in the source. */
function source(shift: (typeof shifts)[number], destination: "global" | "poke"): string {
  const operation = `value ${shift.operator} ${shift.count}`;
  const expression = shift.signed ? `byte(${operation})` : operation;
  const delivery =
    destination === "global" ? `result = ${expression};` : `poke($3200, ${expression});`;
  return `module Game;
place(at: $3200) let result: byte;
function deliver(value: ${shift.signed ? "sbyte" : "byte"}): void { ${delivery} }
function step(): void { poke($3202, $5A); }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { step(); deliver(${shift.signed ? "sbyte(peek($3300))" : "peek($3300)"}); observed(); }
}`;
}

/** Documented NMOS costs for a straight-line, complete byte-shift delivery leaf. */
function instructions(bytes: readonly number[]) {
  const costs: Readonly<Record<number, readonly [number, number]>> = {
    0x05: [2, 3],
    0x06: [2, 5],
    0x09: [2, 2],
    0x0a: [1, 2],
    0x0d: [3, 4],
    0x0e: [3, 6],
    0x18: [1, 2],
    0x25: [2, 3],
    0x26: [2, 5],
    0x29: [2, 2],
    0x2a: [1, 2],
    0x2d: [3, 4],
    0x2e: [3, 6],
    0x38: [1, 2],
    0x45: [2, 3],
    0x46: [2, 5],
    0x49: [2, 2],
    0x4a: [1, 2],
    0x4d: [3, 4],
    0x4e: [3, 6],
    0x60: [1, 6],
    0x66: [2, 5],
    0x6a: [1, 2],
    0x6e: [3, 6],
    0x84: [2, 3],
    0x85: [2, 3],
    0x86: [2, 3],
    0x88: [1, 2],
    0x8a: [1, 2],
    0x8c: [3, 4],
    0x8d: [3, 4],
    0x8e: [3, 4],
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
    0xc5: [2, 3],
    0xc8: [1, 2],
    0xc9: [2, 2],
    0xca: [1, 2],
    0xcd: [3, 4],
    0xe8: [1, 2],
    0xea: [1, 2],
  };
  const rows: { opcode: number; cycles: number; operand: number | undefined }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const cost = costs[opcode];
    if (cost === undefined || offset + cost[0] > bytes.length)
      throw new Error(`Unsupported direct-delivery instruction $${opcode.toString(16)}`);
    rows.push({
      opcode,
      cycles: cost[1],
      operand:
        cost[0] === 1
          ? undefined
          : cost[0] === 2
            ? bytes[offset + 1]!
            : bytes[offset + 1]! | (bytes[offset + 2]! << 8),
    });
    offset += cost[0];
  }
  expect(rows.filter((row) => row.opcode === 0x60)).toHaveLength(1);
  expect(bytes.at(-1)).toBe(0x60);
  return rows;
}

describe("fixed byte shift delivered directly to an ordinary fixed byte store", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const shift of shifts) {
      const destination = shift.operator === "<<" && shift.count === 3 ? "poke" : "global";
      it(`${profile}: ${shift.name} to ${destination} needs only its declared parameter home`, async () => {
        await withLibraryBuild(
          source(shift, destination),
          "module Library;",
          profile,
          async (artifacts) => {
            const ownerName = "src/game.blend::Game.deliver";
            const bytes = libraryFunctionBytes(artifacts, ownerName);
            // LDA home; accumulator shifts; STA absolute; RTS charges the entire ordinary leaf.
            // Seven-bit shifts extract one endpoint bit through carry: shift, LDA #0, opposite rotate.
            // Signed right one seeds carry with CMP #$80 before ROR. Same-size casts add no instructions.
            expect(bytes.length).toBeLessThanOrEqual(shift.bytes);
            const rows = instructions(bytes);
            expect(rows.reduce((cycles, row) => cycles + row.cycles, 0)).toBeLessThanOrEqual(
              shift.cycles,
            );
            const stores = rows.filter((row) =>
              [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(row.opcode),
            );
            expect(stores).toHaveLength(1);
            expect(stores[0]!.operand).toBe(0x3200);
            const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
              if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
              const owner = profileRecord(interval.owner);
              if (typeof owner.id !== "string")
                throw new TypeError("Private homes require source owner identities");
              const identities: unknown = owner.id.startsWith("overlay:")
                ? JSON.parse(owner.id.slice("overlay:".length))
                : [owner.id];
              if (!Array.isArray(identities) || !identities.every((id) => typeof id === "string"))
                throw new TypeError("Expected source-owned private storage identities");
              return identities.some(
                (id: string) => id === ownerName || id.startsWith(`${ownerName}::`),
              );
            });
            let privateBytes = 0;
            for (const home of homes) {
              if (typeof home.size !== "number" || !Number.isInteger(home.size) || home.size < 0)
                throw new TypeError("Private homes require complete integral byte accounting");
              privateBytes += home.size;
            }
            expect(
              privateBytes,
              "The ordinary byte parameter is charged; expression-result staging is absent",
            ).toBe(1);
            // Argument capture/marshalling, caller, markers and startup remain fully charged outside the leaf.
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);
    }
  }
});
