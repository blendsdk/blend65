import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const base = `module Game;
let callbacks: (fn(): byte)[2] = [&chosen, &chosen];
let other: byte[2];
function chosen(): byte { return 37; }`;

const cases = [
  {
    name: "should accept a bounded local index with an unrelated raw kill",
    source: `${base}
function main(): void {
  poke(&other, 0);
  let index: byte = peek($0400) & 1;
  poke($C000, callbacks[index]());
}`,
    outcome: "success",
  },
  {
    name: "should reject an unbounded local index with an unrelated raw kill",
    source: `${base}
function main(): void {
  poke(&other, 0);
  let index: byte = peek($0400);
  poke($C000, callbacks[index]());
}`,
    outcome: "failure",
  },
  {
    name: "should accept an inline masked index with an unrelated raw kill",
    source: `${base}
function main(): void {
  poke(&other, 0);
  poke($C000, callbacks[peek($0400) & 1]());
}`,
    outcome: "success",
  },
  {
    name: "should not bound an earlier read from a later masked store",
    source: `${base}
function main(): void {
  poke(&other, 0);
  let index: byte = peek($0400);
  poke($C000, callbacks[index]());
  index = peek($0400) & 1;
}`,
    outcome: "failure",
  },
] as const;

describe.each(sourceLibraryProfiles)("bounded local callable index on %s", (profile) => {
  for (const testCase of cases) {
    it(
      testCase.name,
      async () => {
        await withProfileProject(testCase.source, profile, async (project) => {
          const built = await buildProject({
            project,
            optimization: "none",
            boundsCheck: false,
          });
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
