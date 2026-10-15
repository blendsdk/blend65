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

/** Supply unknown ordinals without making a raw address observer in the caller. */
function game(type: string): string {
  return `module Game;
import { query } from Library;
let saved: byte[8] = [11, 23, 37, 41, 59, 61, 79, 83];
let column: ${type};
let other: word;
function main(): void { poke($0400, query(saved, column, other)); }`;
}

const contained = [
  {
    name: "true byte comparison",
    type: "byte",
    body: "if (column < 8) { return rows[column]; } return 0;",
  },
  {
    name: "true word comparison",
    type: "word",
    body: "if (column < 8) { return rows[column]; } return 0;",
  },
  {
    name: "false byte comparison",
    type: "byte",
    body: "if (column >= 8) { return 0; } else { return rows[column]; }",
  },
  {
    name: "false word comparison",
    type: "word",
    body: "if (column >= 8) { return 0; } else { return rows[column]; }",
  },
  {
    name: "byte early-return continuation and fixed shift",
    type: "byte",
    body: "if (column >= 64) { return 0; } return rows[column >> 3];",
  },
  {
    name: "word early-return continuation and fixed shift",
    type: "word",
    body: "if (column >= 64) { return 0; } return rows[column >> 3];",
  },
  {
    name: "value-preserving widening after a byte guard",
    type: "byte",
    body: "if (column < 8) { return rows[word(column)]; } return 0;",
  },
  {
    name: "value-preserving narrowing after a word guard",
    type: "word",
    body: "if (column < 8) { return rows[byte(column)]; } return 0;",
  },
  {
    name: "fixed shift through a value-preserving conversion",
    type: "word",
    body: "if (column >= 64) { return 0; } return rows[byte(column) >> 3];",
  },
  {
    name: "fixed shift of a value-preserving typed local",
    type: "word",
    body: `if (column >= 64) { return 0; }
let ordinal: byte = byte(column);
return rows[ordinal >> 3];`,
  },
  {
    name: "nested reaching guard",
    type: "word",
    body: "if (other < 32) { if (column < 8) { return rows[column]; } } return 0;",
  },
  {
    name: "ordinary byte loop condition",
    type: "byte",
    body: `let answer: byte = 0;
for (; column < 8; column += 1) { answer ^= rows[column]; }
return answer;`,
  },
  {
    name: "ordinary word loop condition",
    type: "word",
    body: `let answer: byte = 0;
for (; column < 8; column += 1) { answer ^= rows[column]; }
return answer;`,
  },
  {
    name: "nested guard in an ordinary loop",
    type: "word",
    body: `let answer: byte = 0;
for (; column < 64; column += 1) {
  if (other < 32) { answer ^= rows[column >> 3]; }
}
return answer;`,
  },
  {
    name: "a bound on both reaching join paths",
    type: "word",
    body: `if (other == 0) {
  if (column >= 8) { return 0; }
} else {
  if (column >= 8) { return 0; }
}
return rows[column];`,
  },
  {
    name: "different sufficient bounds on both reaching join paths",
    type: "word",
    body: `if (other == 0) {
  if (column >= 4) { return 0; }
} else {
  if (column >= 8) { return 0; }
}
return rows[column];`,
  },
  {
    name: "an unrelated returning global mutator",
    type: "byte",
    declarations: `let touched: byte;
function mutate(): byte { touched = 9; return touched; }`,
    body: "if (column < 8) { let ignored: byte = mutate(); return rows[column]; } return 0;",
  },
  {
    name: "a guarded snapshot after the original global is mutated",
    type: "byte",
    declarations: `let shared: byte;
function mutate(): byte { shared = 9; return shared; }`,
    body: `shared = column;
let snapshot: byte = shared;
if (snapshot < 8) { let ignored: byte = mutate(); return rows[snapshot]; }
return 0;`,
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library reaching unsigned guards on %s",
  (profile) => {
    // Every observer stays in its complete array without an added executable or storage cost.
    it.each(contained)("should omit cold storage for $name", async (testCase) => {
      const { type, body } = testCase;
      const declarations = "declarations" in testCase ? testCase.declarations : "";
      const control = `module Library;
${declarations}
export function query(rows: const byte[8], column: ${type}, other: word): byte { ${body} }`;
      const library = `${control}\n${coldDeclarations}`;
      const source = game(type);
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
