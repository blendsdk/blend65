import { describe, expect, it } from "vitest";
import { profileRecords } from "./profile-fixture.js";
import {
  expectSameLibraryCost,
  libraryEntry,
  libraryGlobalIntervals,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const coldDeclarations = `let coldFlag: byte;
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }`;

/** Keep the caller's ordinal and unrelated comparison input independently unknown. */
function game(type: string, extent: number): string {
  return `module Game;
import { query } from Library;
let saved: byte[${extent}];
let column: ${type};
let other: word;
function main(): void { poke($0400, query(saved, column, other)); }`;
}

const contained = [
  {
    name: "a guarded byte plus a constant reaching the last element",
    type: "byte",
    body: "if (column < 5) { return rows[column + 3]; } return 0;",
  },
  {
    name: "a constant plus a guarded byte reaching the last element",
    type: "byte",
    body: "if (column < 5) { return rows[3 + column]; } return 0;",
  },
  {
    name: "a guarded word plus a constant reaching the last element",
    type: "word",
    body: "if (column < 5) { return rows[column + 3]; } return 0;",
  },
  {
    name: "a constant plus a guarded word reaching the last element",
    type: "word",
    body: "if (column < 5) { return rows[3 + column]; } return 0;",
  },
  {
    name: "the false arm of a byte upper-bound comparison",
    type: "byte",
    body: "if (column >= 5) { return 0; } else { return rows[column + 3]; }",
  },
  {
    name: "a word early-return guard before a constant-first sum",
    type: "word",
    body: "if (column >= 5) { return 0; } return rows[3 + column];",
  },
  {
    name: "a literal zero after a guarded byte",
    type: "byte",
    body: "if (column < 8) { return rows[column + 0]; } return 0;",
  },
  {
    name: "a literal zero before a guarded word",
    type: "word",
    body: "if (column < 8) { return rows[0 + column]; } return 0;",
  },
  {
    name: "a non-wrapping byte intermediate",
    type: "byte",
    body: `if (column < 7) {
  let ordinal: byte = column + 1;
  return rows[ordinal];
}
return 0;`,
  },
  {
    name: "a non-wrapping word intermediate",
    type: "word",
    body: `if (column < 7) {
  let ordinal: word = 1 + column;
  return rows[ordinal];
}
return 0;`,
  },
  {
    name: "direct byte addition promoted across the byte boundary",
    type: "byte",
    extent: 258,
    body: "if (column < 255) { return rows[column + 3]; } return 0;",
  },
  {
    name: "constant-first direct byte addition promoted across the byte boundary",
    type: "byte",
    extent: 258,
    body: "if (column < 255) { return rows[3 + column]; } return 0;",
  },
  {
    name: "a byte intermediate whose maximum exactly fits its width",
    type: "byte",
    extent: 256,
    body: `if (column < 255) {
  let ordinal: byte = column + 1;
  return rows[ordinal];
}
return 0;`,
  },
  {
    name: "both offset accesses under one sufficient guard",
    type: "word",
    body: "if (column < 5) { return rows[column + 3] ^ rows[2 + column]; } return 0;",
  },
  {
    name: "a sufficient guard on every reaching join path",
    type: "word",
    body: `if (other == 0) {
  if (column >= 4) { return 0; }
} else {
  if (column >= 5) { return 0; }
}
return rows[column + 3];`,
  },
  {
    name: "an immutable snapshot after the original global changes",
    type: "byte",
    declarations: `let shared: byte;
function mutate(): byte { shared = 9; return shared; }`,
    body: `shared = column;
let snapshot: byte = shared;
if (snapshot < 5) {
  let ignored: byte = mutate();
  return rows[snapshot + 3];
}
return 0;`,
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library reaching unsigned constant offsets on %s",
  (profile) => {
    // A reaching unsigned bound and a non-wrapping constant offset keep every access inside its complete array.
    it.each(contained)("should omit cold storage for $name", async (testCase) => {
      const { type, body } = testCase;
      const extent = "extent" in testCase ? testCase.extent : 8;
      const declarations = "declarations" in testCase ? testCase.declarations : "";
      const control = `module Library;
${declarations}
export function query(rows: const byte[${extent}], column: ${type}, other: word): byte { ${body} }`;
      const library = `${control}\n${coldDeclarations}`;
      const source = game(type, extent);
      await withLibraryBuild(source, library, profile, async (artifacts) => {
        expect(libraryGlobalIntervals(artifacts, library, "coldFlag").intervals).toEqual([]);
        expect(
          profileRecords(artifacts.debug.functions).filter(
            (entry) => entry.qualifiedName === "src/library.blend::Library.acquire",
          ),
        ).toEqual([]);
        libraryEntry(artifacts, "src/library.blend::Library.query");
        await withLibraryBuild(source, control, profile, async (reference) => {
          expectSameLibraryCost(artifacts, reference);
        });
      });
    });
  },
);
