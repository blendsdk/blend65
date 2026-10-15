import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const predicates = ["m < 128", "m > 127", "m >= 128", "m <= 127"] as const;

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

const branches = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);
// Documented NMOS forms for this capture, threshold comparison and shared-return witness.
const lengths: Readonly<Record<number, number>> = {
  0x10: 2,
  0x20: 3,
  0x30: 2,
  0x50: 2,
  0x60: 1,
  0x70: 2,
  0x85: 2,
  0x8d: 3,
  0x90: 2,
  0xa5: 2,
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
    throw new TypeError("Expected an integral public debug reference");
  return value;
}

/** Read only the small documented instruction vocabulary of this source witness. */
function instructions(bytes: readonly number[], start: number) {
  const rows: { pc: number; opcode: number; size: number; operand: number | undefined }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const size = lengths[opcode];
    if (size === undefined || offset + size > bytes.length)
      throw new Error(`Unsupported captured-local instruction $${opcode.toString(16)}`);
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

/** Prove the entry-state facts directly for the two shared-return paths, not a general CPU model. */
function witness(bytes: readonly number[], start: number, helper: number) {
  const rows = instructions(bytes, start);
  const one = (selected: typeof rows, name: string) => {
    expect(selected, name).toHaveLength(1);
    return selected[0]!;
  };
  const load = one(
    rows.filter((row) => row.opcode === 0xad && row.operand === 0x3300),
    "capture",
  );
  const store = one(
    rows.filter((row) => [0x85, 0x8d].includes(row.opcode)),
    "capture home store",
  );
  const branch = one(
    rows.filter((row) => branches.has(row.opcode)),
    "conditional helper bypass",
  );
  const call = one(
    rows.filter((row) => row.opcode === 0x20),
    "ordinary helper call",
  );
  const returned = one(
    rows.filter((row) => row.opcode === 0x60),
    "shared byte return",
  );
  expect(call.operand).toBe(helper);
  expect(load.pc).toBeLessThan(store.pc);
  expect(load.pc).toBeLessThan(branch.pc);
  expect(store.pc).toBeLessThan(call.pc);
  expect(branch.pc).toBeLessThan(call.pc);
  expect(returned).toEqual(rows.at(-1));
  const home = store.operand!;
  expect([0x3200, 0x3201, 0x3202, 0x3210, 0x3300]).not.toContain(home);
  const target =
    branch.pc + branch.size + (branch.operand! < 0x80 ? branch.operand! : branch.operand! - 0x100);
  expect(target).toBeGreaterThanOrEqual(call.pc + call.size);
  expect(target).toBeLessThanOrEqual(returned.pc);
  expect(rows.some((row) => row.pc === target)).toBe(true);
  const homeOnEveryPath = store.pc < branch.pc;
  // STA and CMP do not change A. A private reload is truthful only after this capture's store.
  for (const row of rows.filter((row) => row.pc > load.pc && row.pc < call.pc)) {
    if (row === store || row === branch || [0xc5, 0xc9, 0xcd, 0xea].includes(row.opcode)) continue;
    expect([0xa5, 0xad]).toContain(row.opcode);
    expect(row.operand).toBe(home);
    expect(row.pc).toBeGreaterThan(store.pc);
  }
  const afterCall = rows.filter((row) => row.pc > call.pc && row.pc < returned.pc);
  const reload = one(
    afterCall.filter((row) => [0xa5, 0xad].includes(row.opcode)),
    "restore after clobbering call",
  );
  expect(reload.operand).toBe(home);
  for (const row of afterCall) {
    if (row === reload) continue;
    expect([0xc5, 0xc9, 0xcd, 0xea]).toContain(row.opcode);
  }
  if (target <= reload.pc)
    expect(homeOnEveryPath, "Bypass reload requires an initialized home").toBe(true);
  return {
    home,
    checkpoints: [
      { name: "source load entry", pc: load.pc, a: false, memory: false },
      { name: "after source capture", pc: load.pc + load.size, a: true, memory: false },
      { name: "comparison branch entry", pc: branch.pc, a: true, memory: homeOnEveryPath },
      { name: "capture store entry", pc: store.pc, a: true, memory: false },
      { name: "shared return entry", pc: returned.pc, a: true, memory: homeOnEveryPath },
    ],
  };
}

describe("captured byte local debugger truth", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const predicate of predicates) {
      it(`${profile}: ${predicate} never publishes an uninitialized capture home`, async () => {
        const input = source(predicate);
        await withLibraryBuild(input, "module Library;", profile, async (artifacts) => {
          const name = "src/game.blend::Game.choose";
          const bytes = libraryFunctionBytes(artifacts, name);
          const start = libraryEntry(artifacts, name);
          const facts = witness(
            bytes,
            start,
            libraryEntry(artifacts, "src/game.blend::Game.interfere"),
          );
          const symbols = profileRecords(artifacts.debug.symbols);
          const locals = symbols.flatMap((symbol, index) =>
            symbol.kind === "local" &&
            typeof symbol.qualifiedName === "string" &&
            symbol.qualifiedName.startsWith(`${name}::`)
              ? [{ symbol, index }]
              : [],
          );
          expect(
            locals,
            "The sole captured source local retains its binding identity",
          ).toHaveLength(1);
          const { symbol, index: symbolIndex } = locals[0]!;
          expect(symbol.byteWidth).toBe(1);
          const sources = profileRecords(artifacts.debug.sources);
          const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
          expect(sourceIndex).toBeGreaterThanOrEqual(0);
          const origin = profileRecord(symbol.origin);
          expect(origin.kind).toBe("source");
          const span = profileRecord(origin.span);
          const proof = profileSpan(input, "let m: byte = peek($3300);");
          expect(span.sourceIndex).toBe(sourceIndex);
          expect(integer(span.startByte)).toBeGreaterThanOrEqual(0);
          expect(integer(span.startByte)).toBeLessThanOrEqual(proof.start);
          expect(integer(span.endByte)).toBeGreaterThanOrEqual(proof.end);
          expect(integer(span.endByte)).toBeLessThanOrEqual(
            integer(sources[sourceIndex]!.byteLength),
          );

          const locations = profileRecords(artifacts.debug.locations);
          const owned = locations.flatMap((location, index) =>
            location.symbolIndex === symbolIndex ? [{ location, index }] : [],
          );
          expect(owned.length).toBeGreaterThan(0);
          if (!Array.isArray(symbol.locationIndexes))
            throw new Error("Missing reverse local locations");
          expect(symbol.locationIndexes.map(integer)).toEqual(owned.map(({ index }) => index));
          const ranges = profileRecords(artifacts.debug.ranges);
          const covered = owned
            .flatMap(({ location }) => {
              if (!Array.isArray(location.liveRangeIndexes))
                throw new Error("Missing local live ranges");
              expect(location.liveRangeIndexes.length).toBeGreaterThan(0);
              return location.liveRangeIndexes.map((reference) => {
                const range = ranges[integer(reference)];
                if (range === undefined) throw new Error("Dangling local live range");
                const machine = profileRecord(range.machine);
                expect(machine.addressSpaceIndex).toBe(0);
                const low = integer(machine.start);
                const high = integer(machine.end);
                expect(low).toBeGreaterThanOrEqual(start);
                expect(high).toBeLessThanOrEqual(start + bytes.length);
                expect(high).toBeGreaterThan(low);
                return { low, high, availability: profileRecord(location.availability) };
              });
            })
            .sort((left, right) => left.low - right.low);
          for (let index = 1; index < covered.length; index += 1)
            expect(covered[index]!.low, "Local coverage is nonoverlapping").toBeGreaterThanOrEqual(
              covered[index - 1]!.high,
            );
          for (const checkpoint of facts.checkpoints) {
            const active = covered.filter(
              ({ low, high }) => low <= checkpoint.pc && checkpoint.pc < high,
            );
            expect(active, `${checkpoint.name} requires explicit local availability`).toHaveLength(
              1,
            );
            const availability = active[0]!.availability;
            if (availability.kind === "unavailable") {
              expect(
                checkpoint.a ? ["notResident", "notMaterialized"] : ["notLive", "notMaterialized"],
              ).toContain(availability.reason);
              if (availability.reason === "notResident") expect(checkpoint.memory).toBe(false);
              continue;
            }
            expect(availability.kind).toBe("available");
            const pieces = profileRecords(availability.pieces);
            expect(pieces).toHaveLength(1);
            const piece = pieces[0]!;
            expect(piece.valueOffset).toBe(0);
            expect(piece.byteLength).toBe(1);
            if (piece.kind === "register") {
              expect(piece.register).toBe("A");
              expect(checkpoint.a, `${checkpoint.name}: A must contain the original sample`).toBe(
                true,
              );
            } else {
              expect(piece.kind).toBe("memory");
              const machine = profileRecord(piece.machine);
              expect(machine).toMatchObject({
                addressSpaceIndex: 0,
                start: facts.home,
                end: facts.home + 1,
              });
              expect(
                checkpoint.memory,
                `${checkpoint.name}: home must be initialized on every incoming path`,
              ).toBe(true);
            }
          }
          expectLibraryAccounting(artifacts);
        });
      });
    }
  }
});
