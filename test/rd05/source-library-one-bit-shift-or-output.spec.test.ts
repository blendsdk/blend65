import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const shifts = [
  { name: "unsigned left", operator: "<<", signed: false, bytes: 6, cycles: 14 },
  { name: "unsigned right", operator: ">>", signed: false, bytes: 7, cycles: 14 },
  { name: "signed right", operator: ">>", signed: true, bytes: 9, cycles: 16 },
] as const;
const deliveries = ["global", "poke", "return"] as const;

/** Ordinary scalar parameter and return/store forms keep their source ABI obligations explicit. */
function source(shift: (typeof shifts)[number], delivery: (typeof deliveries)[number]): string {
  const operation = `(value ${shift.operator} 1) | 1`;
  const expression = shift.signed ? `byte(${operation})` : operation;
  const body =
    delivery === "return"
      ? `return ${expression};`
      : delivery === "global"
        ? `result = ${expression};`
        : `poke($3200, ${expression});`;
  const argument = shift.signed ? "sbyte(peek($3300))" : "peek($3300)";
  return `module Game;
place(at: $3200) let result: byte;
function transform(value: ${shift.signed ? "sbyte" : "byte"}): ${delivery === "return" ? "byte" : "void"} { ${body} }
function step(): void { poke($3202, $5A); }
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { step(); ${delivery === "return" ? "result = " : ""}transform(${argument}); observed(); }
}`;
}

/** Charge complete straight-line documented NMOS leaves, including every load/store and RTS. */
function instructions(bytes: readonly number[]) {
  const costs: Readonly<Record<number, readonly [number, number]>> = {
    0x05: [2, 3],
    0x09: [2, 2],
    0x0a: [1, 2],
    0x0d: [3, 4],
    0x18: [1, 2],
    0x29: [2, 2],
    0x2a: [1, 2],
    0x38: [1, 2],
    0x4a: [1, 2],
    0x60: [1, 6],
    0x6a: [1, 2],
    0x84: [2, 3],
    0x85: [2, 3],
    0x86: [2, 3],
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
    0xc9: [2, 2],
    0xcd: [3, 4],
    0xea: [1, 2],
  };
  const rows: { opcode: number; cycles: number; operand: number | undefined }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const cost = costs[opcode];
    if (cost === undefined || offset + cost[0] > bytes.length)
      throw new Error(`Unsupported one-bit shift/OR instruction $${opcode.toString(16)}`);
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

describe("ordinary one-bit shift then OR one complete output", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const shift of shifts) {
      for (const delivery of deliveries) {
        it(`${profile}: ${shift.name} ${delivery} meets the complete expert leaf cost`, async () => {
          await withLibraryBuild(
            source(shift, delivery),
            "module Library;",
            profile,
            async (artifacts) => {
              const ownerName = "src/game.blend::Game.transform";
              const bytes = libraryFunctionBytes(artifacts, ownerName);
              const stored = delivery !== "return";
              // Left: LDA home; SEC; ROL A; RTS = 6B/14cy, without assuming incoming carry.
              // Unsigned right: LDA; LSR A; ORA #1; RTS = 7B/14cy.
              // Signed right adds CMP #$80 before ROR A = 9B/16cy. Same-width casts are bit reinterpretation.
              // A fixed absolute store adds 3B/4cy; all complete bytes and ordinary returns are charged.
              expect(bytes.length).toBeLessThanOrEqual(shift.bytes + (stored ? 3 : 0));
              const rows = instructions(bytes);
              expect(rows.reduce((sum, row) => sum + row.cycles, 0)).toBeLessThanOrEqual(
                shift.cycles + (stored ? 4 : 0),
              );
              const stores = rows.filter((row) =>
                [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(row.opcode),
              );
              expect(stores).toHaveLength(stored ? 1 : 0);
              if (stored) expect(stores[0]!.operand).toBe(0x3200);
              const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
                if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
                const owner = profileRecord(interval.owner);
                if (typeof owner.id !== "string")
                  throw new TypeError("Private homes require source identities");
                const identities: unknown = owner.id.startsWith("overlay:")
                  ? JSON.parse(owner.id.slice("overlay:".length))
                  : [owner.id];
                if (!Array.isArray(identities) || !identities.every((id) => typeof id === "string"))
                  throw new TypeError("Private overlays require complete source identities");
                return identities.some(
                  (id: string) => id === ownerName || id.startsWith(`${ownerName}::`),
                );
              });
              let privateBytes = 0;
              for (const home of homes) {
                if (typeof home.size !== "number" || !Number.isInteger(home.size) || home.size < 0)
                  throw new TypeError("Private storage requires complete integral byte costs");
                privateBytes += home.size;
              }
              expect(
                privateBytes,
                "The parameter byte is charged; no expression-only home is added",
              ).toBe(1);
              // The caller's volatile capture, argument marshalling, result store, markers and startup are separate costs.
              expectLibraryAccounting(artifacts);
            },
          );
        }, 60_000);
      }
    }
  }
});
