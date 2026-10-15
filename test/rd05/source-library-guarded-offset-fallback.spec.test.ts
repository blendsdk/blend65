import { describe, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const coldDeclarations = `let coldFlag: byte;
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }`;

/** Dynamic ordinals preserve unchecked runtime uncertainty rather than constant rejection. */
function game(type: string): string {
  return `module Game;
import { query } from Library;
let saved: byte[8];
let column: ${type};
let other: word;
function main(): void { poke($0400, query(saved, column, other)); }`;
}

const uncontained = [
  {
    name: "a guard admitting the first out-of-bounds sum",
    type: "word",
    body: "if (column < 6) { return rows[column + 3]; } return 0;",
  },
  {
    name: "a constant-first sum admitting the first out-of-bounds element",
    type: "byte",
    body: "if (column < 6) { return rows[3 + column]; } return 0;",
  },
  {
    name: "potential wrap in a byte intermediate",
    type: "byte",
    body: `if (column < 8) {
  let ordinal: byte = column + 255;
  return rows[ordinal];
}
return 0;`,
  },
  {
    name: "potential wrap at the selected word width",
    type: "word",
    body: "if (column < 8) { return rows[column + 65535]; } return 0;",
  },
  {
    name: "a signed byte plus a constant",
    type: "sbyte",
    body: "if (column < 5) { return rows[column + 3]; } return 0;",
  },
  {
    name: "a constant plus a signed word",
    type: "sword",
    body: "if (column < 5) { return rows[3 + column]; } return 0;",
  },
  {
    name: "a second variable instead of an exact constant",
    type: "word",
    body: "if (column < 5) { return rows[column + other]; } return 0;",
  },
  {
    name: "two guarded variables outside the constant-offset proof",
    type: "word",
    body: "if (column < 5) { if (other < 4) { return rows[column + other]; } } return 0;",
  },
  {
    name: "a direct mutation between the guard and addition",
    type: "byte",
    body: "if (column < 5) { column = byte(other); return rows[column + 3]; } return 0;",
  },
  {
    name: "a write through the guarded binding's address",
    type: "byte",
    body: "if (column < 5) { poke(&column, 9); return rows[column + 3]; } return 0;",
  },
  {
    name: "a returning call that writes the guarded binding through its address",
    type: "byte",
    declarations: "function mutate(address: word): byte { poke(address, 9); return 0; }",
    body: "if (column < 5) { let ignored: byte = mutate(&column); return rows[column + 3]; } return 0;",
  },
  {
    name: "a global reload after a returning global mutator",
    type: "byte",
    declarations: `let shared: byte;
function mutate(): byte { shared = 9; return shared; }`,
    body: `shared = column;
if (shared < 5) {
  let ignored: byte = mutate();
  return rows[shared + 3];
}
return 0;`,
  },
  {
    name: "one unbounded reaching join path before the addition",
    type: "word",
    body: `if (other == 0) { if (column >= 5) { return 0; } }
return rows[column + 3];`,
  },
  {
    name: "an independent raw observer beside a guarded offset",
    type: "word",
    body: `if (column < 5) {
  let observed: byte = peek(other);
  return rows[column + 3] ^ observed;
}
return 0;`,
  },
  {
    name: "an unknown raw write between the guard and addition",
    type: "byte",
    body: "if (column < 5) { poke(other, 9); return rows[column + 3]; } return 0;",
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library guarded constant-offset conservative fallback on %s",
  (profile) => {
    // An overflowing, stale, signed, incomplete or raw-address fact cannot justify removing cold storage.
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
