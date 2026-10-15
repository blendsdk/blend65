import { describe, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const coldDeclarations = `let coldFlag: byte;
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }`;

/** Keep the ordinal and unrelated comparison value independently unknown. */
function game(type: string): string {
  return `module Game;
import { query } from Library;
let saved: byte[8] = [11, 23, 37, 41, 59, 61, 79, 83];
let column: ${type};
let other: word;
function main(): void { poke($0400, query(saved, column, other)); }`;
}

const uncontained = [
  {
    name: "a direct write after the guard",
    type: "byte",
    body: "if (column < 8) { column = byte(other); return rows[column]; } return 0;",
  },
  {
    name: "a returning helper that mutates the guarded global",
    type: "byte",
    declarations: `let shared: byte;
function mutate(): byte { shared = 9; return shared; }`,
    body: `shared = column;
if (shared < 8) { let ignored: byte = mutate(); return rows[shared]; }
return 0;`,
  },
  {
    name: "a write through the guarded binding's address",
    type: "byte",
    body: "if (column < 8) { poke(&column, 9); return rows[column]; } return 0;",
  },
  {
    name: "a returning helper given the guarded binding's address",
    type: "byte",
    declarations: "function mutate(address: word): byte { poke(address, 9); return 0; }",
    body: "if (column < 8) { let ignored: byte = mutate(&column); return rows[column]; } return 0;",
  },
  {
    name: "one unbounded reaching join path",
    type: "word",
    body: `if (other == 0) { if (column >= 8) { return 0; } }
return rows[column];`,
  },
  {
    name: "a guard that follows the access",
    type: "word",
    body: "let answer: byte = rows[column]; if (column >= 8) { return 0; } return answer;",
  },
  {
    name: "a guard on a different binding",
    type: "word",
    body: "if (other < 8) { return rows[column]; } return 0;",
  },
  {
    name: "the out-of-bounds arm of a comparison",
    type: "word",
    body: "if (column >= 8) { return rows[column]; } return 0;",
  },
  {
    name: "a signed byte upper bound",
    type: "sbyte",
    body: "if (column < 8) { return rows[column]; } return 0;",
  },
  {
    name: "a signed word upper bound",
    type: "sword",
    body: "if (column < 8) { return rows[column]; } return 0;",
  },
  {
    name: "a possibly truncating conversion despite a small final shift",
    type: "word",
    body: "if (column < 512) { return rows[byte(column) >> 6]; } return 0;",
  },
  {
    name: "a possibly sign-changing conversion",
    type: "byte",
    body: "if (column < 200) { return rows[sbyte(column) >> 5]; } return 0;",
  },
  {
    name: "a possibly truncating conversion before the access",
    type: "word",
    body: "if (column < 512) { return rows[byte(column)]; } return 0;",
  },
  {
    name: "a possibly sign-changing conversion before the access",
    type: "byte",
    body: "if (column < 200) { return rows[sbyte(column)]; } return 0;",
  },
  {
    name: "an extent without a reaching guard",
    type: "byte",
    body: "return rows[column];",
  },
  {
    name: "a guard admitting the first out-of-bounds element",
    type: "word",
    body: "if (column < 9) { return rows[column]; } return 0;",
  },
  {
    name: "a shifted bound admitting the first out-of-bounds element",
    type: "word",
    body: "if (column < 65) { return rows[column >> 3]; } return 0;",
  },
  {
    name: "a later volatile value with the same expression spelling",
    type: "byte",
    body: "if (peek($DC00) < 8) { return rows[peek($DC00)]; } return 0;",
  },
  {
    name: "a guarded raw read address",
    type: "word",
    body: "if (column < 8) { return peek(column); } return 0;",
  },
  {
    name: "a guarded raw write address",
    type: "word",
    body: "if (column < 8) { poke(column, rows[0]); } return rows[0];",
  },
  {
    name: "a raw unknown write between the guard and access",
    type: "byte",
    body: "if (column < 8) { poke(other, 9); return rows[column]; } return 0;",
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library guarded ordinal conservative fallback on %s",
  (profile) => {
    // A stale, incomplete, signed, or raw-address fact cannot certify the complete object.
    it.each(uncontained)("should retain cold storage for $name", async (testCase) => {
      const { type, body } = testCase;
      const declarations = "declarations" in testCase ? testCase.declarations : "";
      const library = `module Library;
${coldDeclarations}
${declarations}
export function query(rows: const byte[8], column: ${type}, other: word): byte { ${body} }`;
      await withLibraryBuild(game(type), library, profile, async (artifacts) => {
        libraryGlobalAddress(artifacts, library, "coldFlag", 1);
        expectLibraryAccounting(artifacts);
      });
    });
  },
);
