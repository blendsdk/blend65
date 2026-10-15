import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const observers = [
  {
    name: "ordinary runtime-address reader after the call",
    imports: "",
    declarations: "function rawObserver(): void { poke($3211, peek(observerAddress)); }",
    setup: "",
    after: "rawObserver();",
  },
  {
    name: "ordinary unchecked runtime-word array reader after the call",
    imports: "",
    declarations: `place(at: $3400) let probe: byte[1];
function rawObserver(): void { poke($3211, probe[observerAddress]); }`,
    setup: "",
    after: "rawObserver();",
  },
  {
    name: "generated IRQ runtime-address indexed reader",
    imports: "import { setIRQ } from c64.system;",
    declarations: `interrupt function Observer(): void {
    poke($3211, peek(observerAddress + word(peek($3305))));
}`,
    setup: "setIRQ(&Observer);",
    after: "",
  },
  {
    name: "generated IRQ runtime-address writer",
    imports: "import { setIRQ } from c64.system;",
    declarations: "interrupt function Observer(): void { poke(observerAddress, $E7); }",
    setup: "setIRQ(&Observer);",
    after: "",
  },
  {
    name: "persistent VIC RAM selector publication in the caller",
    imports: "",
    declarations: "",
    setup: "poke($D018, peek($3304));",
    after: "",
  },
] as const;

function source(observer: (typeof observers)[number]): string {
  return `module Game;
${observer.imports}
place(at: $3200) let result: byte;
place(at: $3310) let observerAddress: word;
function choose(): byte {
    let m: byte = peek($3300);
    if (m < 128) { interfere(); }
    return m;
}
function interfere(): void { poke($3210, $A1); poke($3300, $CC); }
function step(): void { poke($3202, $5A); }
function observed(): void { poke($3201, $A5); }
${observer.declarations}
function main(): void {
    ${observer.setup}
    while (true) { step(); result = choose(); ${observer.after} observed(); }
}`;
}

const branches = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);
// Only documented NMOS instructions needed by the bounded capture/compare/call/return leaf.
const lengths: Readonly<Record<number, number>> = {
  0x10: 2,
  0x20: 3,
  0x30: 2,
  0x4c: 3,
  0x50: 2,
  0x60: 1,
  0x70: 2,
  0x78: 1,
  0x85: 2,
  0x8d: 3,
  0x90: 2,
  0xa5: 2,
  0xa9: 2,
  0xad: 3,
  0xb0: 2,
  0xc5: 2,
  0xc9: 2,
  0xcd: 3,
  0xd0: 2,
  0xea: 1,
  0xf0: 2,
};

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected an integral public artifact reference");
  return value;
}

/** Decode complete published function bytes without relying on private assembly label spelling. */
function instructions(bytes: readonly number[], start: number) {
  const rows: { pc: number; opcode: number; size: number; operand: number | undefined }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const size = lengths[opcode];
    if (size === undefined || offset + size > bytes.length)
      throw new Error(`Unsupported observed-capture instruction $${opcode.toString(16)}`);
    rows.push({
      pc: start + offset,
      opcode,
      size,
      operand:
        size === 1
          ? undefined
          : size === 2
            ? bytes[offset + 1]!
            : bytes[offset + 1]! | (bytes[offset + 2]! << 8),
    });
    offset += size;
  }
  return rows;
}

describe("captured comparison preserves potentially observed private storage", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const observer of observers) {
      it(`${profile}: ${observer.name} retains the original save and reload effects`, async () => {
        const input = source(observer);
        await withLibraryBuild(input, "module Library;", profile, async (artifacts) => {
          const name = "src/game.blend::Game.choose";
          const functions = profileRecords(artifacts.debug.functions).filter(
            (entry) => entry.qualifiedName === name,
          );
          expect(functions).toHaveLength(1);
          const ownerName = functions[0]!.qualifiedName;
          const locals = profileRecords(artifacts.debug.symbols).filter(
            (symbol) =>
              symbol.kind === "local" &&
              typeof symbol.qualifiedName === "string" &&
              symbol.qualifiedName.startsWith(`${ownerName}::`),
          );
          expect(locals, "The sole source capture has a published binding identity").toHaveLength(
            1,
          );
          const local = locals[0]!;
          expect(local.byteWidth).toBe(1);
          const sources = profileRecords(artifacts.debug.sources);
          const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
          expect(sourceIndex).toBeGreaterThanOrEqual(0);
          const origin = profileRecord(local.origin);
          expect(origin.kind).toBe("source");
          const span = profileRecord(origin.span);
          const declaration = profileSpan(input, "let m: byte = peek($3300);");
          expect(span.sourceIndex).toBe(sourceIndex);
          expect(integer(span.startByte)).toBeGreaterThanOrEqual(0);
          expect(integer(span.startByte)).toBeLessThanOrEqual(declaration.start);
          expect(integer(span.endByte)).toBeGreaterThanOrEqual(declaration.end);
          expect(integer(span.endByte)).toBeLessThanOrEqual(
            integer(sources[sourceIndex]!.byteLength),
          );

          const bytes = libraryFunctionBytes(artifacts, name);
          const start = libraryEntry(artifacts, name);
          const rows = instructions(bytes, start);
          const captures = rows.filter((row) => row.opcode === 0xad && row.operand === 0x3300);
          const saves = rows.filter((row) => [0x85, 0x8d].includes(row.opcode));
          const conditional = rows.filter((row) => branches.has(row.opcode));
          const calls = rows.filter((row) => row.opcode === 0x20);
          expect(captures).toHaveLength(1);
          expect(
            saves,
            "Observers must see the original capture on both comparison paths",
          ).toHaveLength(1);
          expect(conditional.length).toBeGreaterThan(0);
          expect(calls).toHaveLength(1);
          expect(calls[0]!.operand).toBe(libraryEntry(artifacts, "src/game.blend::Game.interfere"));
          const capture = captures[0]!;
          const save = saves[0]!;
          const home = save.operand!;
          expect(save.pc).toBeGreaterThan(capture.pc);
          for (const row of rows.filter((row) => row.pc > capture.pc && row.pc < save.pc))
            expect(
              [0xc5, 0xc9, 0xcd, 0xea],
              "Capture prefix preserves the original A byte",
            ).toContain(row.opcode);
          expect(
            save.pc,
            "A runtime observer defeats conditional-only initialization",
          ).toBeLessThan(conditional[0]!.pc);
          expect(save.pc).toBeLessThan(calls[0]!.pc);
          // No masking can substitute for retaining the visible private byte effects.
          expect(rows.some((row) => row.opcode === 0x78)).toBe(false);
          expect(rows.filter((row) => row.opcode === 0x60)).toHaveLength(1);
          expect(rows.at(-1)?.opcode).toBe(0x60);
          const reload = rows.at(-2)!;
          expect(
            [0xa5, 0xad],
            "Return reload uses the saved byte, not the mutated input",
          ).toContain(reload.opcode);
          expect(reload.operand).toBe(home);
          expect(reload.pc).toBeGreaterThan(calls[0]!.pc);
          for (const row of rows.filter((row) => branches.has(row.opcode) || row.opcode === 0x4c)) {
            const target =
              row.opcode === 0x4c
                ? row.operand!
                : row.pc + row.size + (row.operand! < 0x80 ? row.operand! : row.operand! - 0x100);
            expect(rows.some((candidate) => candidate.pc === target)).toBe(true);
            expect(
              target,
              "Every return path passes through the observable home reload",
            ).toBeLessThanOrEqual(reload.pc);
          }

          const intervals = profileRecords(artifacts.memory.intervals).filter((interval) => {
            if (interval.kind !== "sfa") return false;
            return integer(interval.start) <= home && home < integer(interval.end);
          });
          expect(
            intervals,
            "The saved byte belongs to already-closed function storage",
          ).toHaveLength(1);
          const interval = intervals[0]!;
          const owner = profileRecord(interval.owner);
          if (typeof owner.id !== "string") throw new TypeError("Missing private storage identity");
          const identities: unknown = owner.id.startsWith("overlay:")
            ? JSON.parse(owner.id.slice("overlay:".length))
            : [owner.id];
          if (!Array.isArray(identities) || !identities.every((id) => typeof id === "string"))
            throw new TypeError("Expected source-owned private storage identities");
          expect(
            identities.some((id: string) => id === ownerName || id.startsWith(`${ownerName}::`)),
          ).toBe(true);
          // Memory locations are optional; any published home for this binding must agree with the bytes.
          if (!Array.isArray(local.locationIndexes))
            throw new Error("Missing captured-local location references");
          const locations = profileRecords(artifacts.debug.locations);
          for (const index of local.locationIndexes) {
            const location = locations[integer(index)];
            if (location === undefined) throw new Error("Dangling captured-local location");
            const availability = profileRecord(location.availability);
            if (availability.kind !== "available") continue;
            for (const piece of profileRecords(availability.pieces)) {
              if (piece.kind !== "memory") continue;
              expect(profileRecord(piece.machine)).toMatchObject({
                addressSpaceIndex: 0,
                start: home,
                end: home + 1,
              });
            }
          }
          // Charge caller, observer, generated IRQ routes, setup and every complete output byte.
          expectLibraryAccounting(artifacts);
        });
      });
    }
  }
});
