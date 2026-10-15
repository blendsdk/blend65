import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const cases = [
  { name: "captured byte clears its lowest bit", expression: "m & (m - 1)", parameter: false },
  {
    name: "reversed operands retain the same captured byte",
    expression: "(m - 1) & m",
    parameter: false,
  },
  {
    name: "captured byte combines wrapped addition with OR",
    expression: "m | (m + 1)",
    parameter: false,
  },
  {
    name: "captured byte combines wrapped addition with XOR",
    expression: "m ^ (m + 1)",
    parameter: false,
  },
  {
    name: "owned byte parameter feeds arithmetic and AND",
    expression: "m & (m - 1)",
    parameter: true,
  },
] as const;

function source(expression: string, parameter: boolean): string {
  return `module Game;
place(at: $3200) let result: byte;
function combine(${parameter ? "m: byte" : ""}): byte {
    ${parameter ? "" : "let m: byte = peek($3300);"}
    return ${expression};
}
function observed(): void { poke($3201, $A5); }
function main(): void {
    while (true) { result = combine(${parameter ? "peek($3300)" : ""}); observed(); }
}`;
}

/** Sum a bounded straight-line leaf using only documented NMOS byte encodings and cycles. */
function nominalCycles(bytes: readonly number[]): number {
  const costs: Readonly<Record<number, readonly [number, number]>> = {
    0x05: [2, 3],
    0x09: [2, 2],
    0x0d: [3, 4],
    0x18: [1, 2],
    0x25: [2, 3],
    0x29: [2, 2],
    0x2d: [3, 4],
    0x38: [1, 2],
    0x45: [2, 3],
    0x49: [2, 2],
    0x4d: [3, 4],
    0x60: [1, 6],
    0x65: [2, 3],
    0x69: [2, 2],
    0x6d: [3, 4],
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
    0xc8: [1, 2],
    0xca: [1, 2],
    0xd8: [1, 2],
    0xe5: [2, 3],
    0xe8: [1, 2],
    0xe9: [2, 2],
    0xea: [1, 2],
    0xed: [3, 4],
  };
  let cycles = 0;
  let returns = 0;
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const cost = costs[opcode];
    if (cost === undefined || offset + cost[0] > bytes.length)
      throw new Error(
        `Unexpected straight-line arithmetic instruction $${opcode.toString(16)} at ${offset}`,
      );
    cycles += cost[1];
    returns += Number(opcode === 0x60);
    offset += cost[0];
  }
  expect(returns).toBe(1);
  expect(bytes.at(-1)).toBe(0x60);
  return cycles;
}

describe("ordinary byte arithmetic consumed directly by bitwise operations", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of cases) {
      it(`${profile}: ${probe.name} meets the complete capture and return floor`, async () => {
        await withLibraryBuild(
          source(probe.expression, probe.parameter),
          "module Library;",
          profile,
          async (artifacts) => {
            const ownerName = "src/game.blend::Game.combine";
            const bytes = libraryFunctionBytes(artifacts, ownerName);
            // An owned absolute parameter needs LDA/SEC/SBC#/AND/RTS: 10 bytes/18 cycles.
            // A volatile source adds STA after its initial LDA: 13 bytes/22 cycles; addition uses CLC/ADC.
            expect(bytes.length).toBeLessThanOrEqual(probe.parameter ? 10 : 13);
            expect(nominalCycles(bytes)).toBeLessThanOrEqual(probe.parameter ? 18 : 22);
            const homes = profileRecords(artifacts.memory.intervals).filter((interval) => {
              if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
              const owner = profileRecord(interval.owner);
              if (typeof owner.id !== "string")
                throw new TypeError("Private homes need complete owner identities");
              const identities: unknown = owner.id.startsWith("overlay:")
                ? JSON.parse(owner.id.slice("overlay:".length))
                : [owner.id];
              if (!Array.isArray(identities) || !identities.every((id) => typeof id === "string"))
                throw new TypeError("Private-home overlay identities must be strings");
              return identities.some(
                (id: string) => id === ownerName || id.startsWith(`${ownerName}::`),
              );
            });
            let privateBytes = 0;
            for (const home of homes) {
              if (typeof home.size !== "number" || !Number.isInteger(home.size) || home.size < 0)
                throw new TypeError("Private homes require complete nonnegative byte accounting");
              privateBytes += home.size;
            }
            expect(privateBytes).toBeLessThanOrEqual(1);
            // The complete public artifact also charges the caller, argument capture/marshalling and startup.
            expectLibraryAccounting(artifacts);
          },
        );
      }, 60_000);
    }
  }
});
