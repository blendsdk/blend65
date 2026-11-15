import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const cases = [
  // A complete constant-index store repairs the exact element bytes.
  {
    name: "should accept a complete constant-index store after a raw write",
    source: `module Game;
let table: (fn(): byte)[1];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  pokew(&table[0], 0);
  table[0] = &chosen;
  poke($C000, table[0]());
}`,
    outcome: "success",
  },
  // A constant-index callable field follows the same element recovery.
  {
    name: "should accept a constant-index callable field store after a raw write",
    source: `module Game;
struct Box { cb: fn(): byte; }
let boxes: Box[1];
function chosen(): byte { return 37; }
function main(): void {
  boxes[0].cb = &chosen;
  pokew(&boxes[0].cb, 0);
  boxes[0].cb = &chosen;
  poke($C000, boxes[0].cb());
}`,
    outcome: "success",
  },
  // An unwritten constant sibling is not covered by the element store.
  {
    name: "should reject a constant-index read of an uninitialized sibling",
    source: `module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  poke($C000, table[1]());
}`,
    outcome: "failure",
  },
  // A raw write without a complete store keeps the element unproved.
  {
    name: "should reject a constant-index read after a raw write without a restore",
    source: `module Game;
let table: (fn(): byte)[1];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  pokew(&table[0], 0);
  poke($C000, table[0]());
}`,
    outcome: "failure",
  },
  // A runtime index remains conservative over every element.
  {
    name: "should reject a runtime-index read of a raw-written element",
    source: `module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  table[1] = &chosen;
  pokew(&table[0], 0);
  poke($C000, table[peek($0400) & 1]());
}`,
    outcome: "failure",
  },
  // A runtime store cannot prove a particular constant element was written.
  {
    name: "should reject a constant-index read after a runtime-index store",
    source: `module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[peek($0400) & 1] = &chosen;
  poke($C000, table[0]());
}`,
    outcome: "failure",
  },
] as const;

describe.each(sourceLibraryProfiles)("constant-index callable recovery on %s", (profile) => {
  for (const testCase of cases) {
    it(
      testCase.name,
      async () => {
        await withProfileProject(testCase.source, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          if (testCase.outcome === "failure") {
            expect(built.kind, JSON.stringify(built.diagnostics)).toBe("failure");
            expect(built.diagnostics).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ code: "E10277", severity: "error" }),
              ]),
            );
          } else {
            expect(
              built.kind,
              built.kind === "failure" ? JSON.stringify(built.diagnostics) : "",
            ).toBe("success");
          }
        });
      },
      120_000,
    );
  }
});
