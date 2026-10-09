import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  expectSameLibraryCost,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const emptyLibrary = "module Library;";
const savedSource = `module Game;
struct Saved { rows: byte[8]; raw1: byte; raw2: byte; quality: byte; }
function sample(): void {
  let saved: Saved = { rows: [0,0,0,0,0,0,0,0], raw1: 0, raw2: 0, quality: 2 };
  asm_nop();
}
function main(): void { sample(); }`;

/** Count every function home, including pointers and snapshots, before judging construction. */
function expectOwnedBytes(artifacts: LibraryArtifacts, bytes: number) {
  expectLibraryAccounting(artifacts);
  const storage = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return (
      ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)) ||
      (interval.kind !== "code" && ["function", "helper"].includes(String(owner.kind)))
    );
  });
  const total = storage.reduce((sum, interval) => {
    if (typeof interval.size !== "number" || typeof interval.start !== "number")
      throw new TypeError("Function storage needs an exact physical byte count");
    expect(interval.size).toBeGreaterThan(0);
    return sum + interval.size;
  }, 0);
  expect(total, "Only the declared final objects need homes").toBe(bytes);
  return storage;
}

/** Decode the zero-row component using NMOS load/store costs, independently of cost reports. */
function zeroRowComponent(bytes: readonly number[]) {
  let cursor = 0;
  let cycles = 0;
  // Decimal setup is a separately visible calling-contract cost, not row construction.
  if (bytes[cursor] === 0xd8) cursor += 1;
  const setupBytes = cursor;
  expect(bytes.slice(cursor, cursor + 2), "Load the equal row value once").toEqual([0xa9, 0]);
  cursor += 2;
  cycles += 2;
  const addresses: number[] = [];
  for (let index = 0; index < 8; index += 1) {
    const opcode = bytes[cursor];
    expect([0x85, 0x8d], "Fresh rows use direct stores, without member-copy traffic").toContain(
      opcode,
    );
    const low = bytes[cursor + 1];
    if (low === undefined) throw new Error("Truncated row store");
    if (opcode === 0x85) {
      addresses.push(low);
      cursor += 2;
      cycles += 3;
    } else {
      const high = bytes[cursor + 2];
      if (high === undefined) throw new Error("Truncated absolute row store");
      addresses.push(low + high * 256);
      cursor += 3;
      cycles += 4;
    }
  }
  expect(addresses).toEqual(Array.from({ length: 8 }, (_, index) => addresses[0]! + index));
  expect(cursor - setupBytes, "Eight rows cost at most 26 machine bytes").toBeLessThanOrEqual(26);
  expect(cycles, "Eight rows cost at most 34 nominal NMOS cycles").toBeLessThanOrEqual(34);
  return { addresses, setupBytes };
}

/** Validate the public source identity without relying on generated label spellings. */
function expectSourceIdentity(artifacts: LibraryArtifacts, source: string, profile: string) {
  expect(artifacts.debug).toMatchObject({
    kind: "blend65.debug",
    schemaVersion: 1,
    profileId: profile,
    optimization: "none",
  });
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  expect(sources[sourceIndex]!.byteLength).toBe(Buffer.byteLength(source));
  const functions = profileRecords(artifacts.debug.functions);
  expect(functions.some((entry) => entry.qualifiedName === "src/game.blend::Game.sample")).toBe(
    true,
  );
  for (const field of ["symbols", "locations", "ranges"])
    expect(profileRecords(artifacts.debug[field]).length, field).toBeGreaterThan(0);
  expect(artifacts.memory).toHaveProperty("stackDomains");
  expect(profileRecord(artifacts.costs.totals)).toHaveProperty("resources");
}

describe.sequential.each(sourceLibraryProfiles)("constant nested output on %s", (profile) => {
  // A local eleven-byte value does not need a second eight-byte row object or copy pointers.
  it("should own only the final eleven bytes for an explicitly zeroed saved-row value", async () => {
    await withLibraryBuild(savedSource, emptyLibrary, profile, async (artifacts) => {
      expectSourceIdentity(artifacts, savedSource, profile);
      expectOwnedBytes(artifacts, 11);
    });
  });

  // Equal explicit literals share one load and store directly into their final packed row.
  it("should construct eight zero rows within twenty-six bytes and thirty-four nominal cycles", async () => {
    await withLibraryBuild(savedSource, emptyLibrary, profile, async (artifacts) => {
      expectLibraryAccounting(artifacts);
      const component = zeroRowComponent(
        libraryFunctionBytes(artifacts, "src/game.blend::Game.sample"),
      );
      const storage = expectOwnedBytes(artifacts, 11);
      expect(storage.some((interval) => interval.start === component.addresses[0])).toBe(true);
      expect([0, 1]).toContain(component.setupBytes);
    });
  });

  // Primitive widths, casts and nested declarations contribute only their packed final bytes.
  it("should construct typed struct-array members without child homes or pointer pairs", async () => {
    const source = `module Game;
enum Mode { FIRST = 71, SECOND }
struct Item { octet: byte; pair: word; delta: sbyte; distance: sword; flag: boolean; mode: Mode; }
struct Bundle { prefix: byte; items: Item[2]; tail: byte[3]; }
function sample(): void {
  let bundle: Bundle = { prefix: 9, items: [
    { octet: byte($1234), pair: $abcd, delta: -37, distance: -4660, flag: true, mode: Mode.FIRST },
    { octet: 87, pair: $4567, delta: sbyte($fe), distance: sword($8001), flag: false, mode: Mode.SECOND }
  ], tail: [19,23,29] };
  asm_nop();
}
function main(): void { sample(); }`;
    await withLibraryBuild(source, emptyLibrary, profile, async (artifacts) => {
      expectSourceIdentity(artifacts, source, profile);
      expectOwnedBytes(artifacts, 20);
    });
  });

  // Full-width nested offsets must not introduce a separately materialized child array.
  it("should allocate only the final object when an explicit nested member starts after byte 255", async () => {
    const prefix = Array.from({ length: 256 }, (_, index) => index).join(",");
    const source = `module Game;
struct Wide { prefix: byte[256]; rows: byte[8]; end: word; }
function sample(): void {
  let wide: Wide = { prefix: [${prefix}], rows: [31,37,41,43,47,53,59,61], end: $a1b2 };
  asm_nop();
}
function main(): void { sample(); }`;
    await withLibraryBuild(source, emptyLibrary, profile, async (artifacts) => {
      expectOwnedBytes(artifacts, 266);
    });
  });

  // Unselected ordinary modules and repeated builds cannot charge cold state or code.
  it("should keep repeated saved-row query artifacts and resources identical with cold modules", async () => {
    const source = `module Game;
import { readSaved } from Library;
function main(): void { c64.vic.setBorderColor(readSaved()); }`;
    const library = `module Library;
struct Saved { rows: byte[8]; raw1: byte; raw2: byte; quality: byte; }
export function readSaved(): byte {
  let saved: Saved = { rows: [0,0,0,0,0,0,0,0], raw1: 0, raw2: 0, quality: 2 };
  return saved.rows[0];
}`;
    const control = await withLibraryBuild(
      source,
      library,
      profile,
      async (artifacts) => artifacts,
    );
    const candidate = `${library}
let candidateState: byte[64];
export function candidate(): byte { return candidateState[0]; }`;
    const extraSources = {
      "cold.blend": `module Cold;
let controlState: byte[17];
export function control(): byte { return controlState[0]; }`,
    };
    let previous: LibraryArtifacts | undefined;
    for (let repetition = 0; repetition < 2; repetition += 1) {
      await withLibraryBuild(
        source,
        candidate,
        profile,
        async (artifacts) => {
          expectLibraryAccounting(artifacts);
          expect(artifacts.prg.length).toBe(control.prg.length);
          expect(artifacts.costs.totals).toEqual(control.costs.totals);
          const resources = (value: LibraryArtifacts) =>
            profileRecords(value.memory.intervals).map(
              ({ kind, resourceClass, start, end, size }) => ({
                kind,
                resourceClass,
                start,
                end,
                size,
              }),
            );
          expect(resources(artifacts)).toEqual(resources(control));
          expect(artifacts.memory.stackDomains).toEqual(control.memory.stackDomains);
          if (previous !== undefined) expectSameLibraryCost(artifacts, previous);
          previous = artifacts;
          const functions = profileRecords(artifacts.debug.functions);
          expect(functions.map((entry) => entry.qualifiedName).sort()).toEqual([
            "src/game.blend::Game.main",
            "src/library.blend::Library.readSaved",
          ]);
        },
        extraSources,
      );
    }
  });
});
