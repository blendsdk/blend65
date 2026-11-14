import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const cases = [
  // Replacing both callable bytes with raw memory destroys the finite target proof.
  {
    name: "should reject a call after a direct raw word write",
    declarations: "let callback: fn(): byte;",
    body: "callback = &chosen; pokew(&callback, peekw($0330)); poke($C000, callback());",
    outcome: "failure",
  },
  // Overwriting even one callable byte destroys the finite target proof.
  {
    name: "should reject a call after a direct raw byte write",
    declarations: "let callback: fn(): byte;",
    body: "callback = &chosen; poke(&callback, 0); poke($C000, callback());",
    outcome: "failure",
  },
  // Callable fields retain the same raw-mutation boundary as standalone storage.
  {
    name: "should reject a call after a raw word write to its field",
    declarations: "struct Box { cb: fn(): byte; } let box: Box;",
    body: "box.cb = &chosen; pokew(&box.cb, peekw($0330)); poke($C000, box.cb());",
    outcome: "failure",
  },
  // A word beginning in the preceding byte overlaps the callable's first byte.
  {
    name: "should reject a call after a raw word write crosses into its field",
    declarations: "struct Box { prefix: byte; cb: fn(): byte; } let box: Box;",
    body: "box.prefix = 0; box.cb = &chosen; pokew(&box.prefix, peekw($0330)); poke($C000, box.cb());",
    outcome: "failure",
  },
  // A disjoint byte field write preserves the callable's finite target proof.
  {
    name: "should accept a call after a disjoint raw byte field write",
    declarations: "struct Box { prefix: byte; cb: fn(): byte; } let box: Box;",
    body: "box.cb = &chosen; poke(&box.prefix, 0); poke($C000, box.cb());",
    outcome: "success",
  },
  // An exact placed address identifies the same callable bytes without address-of.
  {
    name: "should reject a call after a raw word write to its placed address",
    declarations: "place(at: $C100) let callback: fn(): byte;",
    body: "callback = &chosen; pokew($C100, peekw($0330)); poke($C000, callback());",
    outcome: "failure",
  },
  // A later typed assignment establishes a new proof after an earlier raw write.
  {
    name: "should accept a call when a raw write precedes its typed assignment",
    declarations: "let callback: fn(): byte;",
    body: "pokew(&callback, 0); callback = &chosen; poke($C000, callback());",
    outcome: "success",
  },
  // A write to unrelated storage does not erase the callable's typed target.
  {
    name: "should accept a call after a raw word write to unrelated storage",
    declarations: "let callback: fn(): byte; let other: word;",
    body: "callback = &chosen; pokew(&other, peekw($0330)); poke($C000, callback());",
    outcome: "success",
  },
  // A possible overlapping write on either reaching branch invalidates the joined proof.
  {
    name: "should reject a call when one reaching branch overwrites its bytes",
    declarations: "let callback: fn(): byte;",
    body: "callback = &chosen; if (peek($0400) != 0) { pokew(&callback, 0); } poke($C000, callback());",
    outcome: "failure",
  },
  // Direct reassignment restores a finite target after raw mutation erased the old proof.
  {
    name: "should accept a call after direct reassignment repairs its proof",
    declarations: "let callback: fn(): byte;",
    body: "callback = &chosen; pokew(&callback, 0); callback = &chosen; poke($C000, callback());",
    outcome: "success",
  },
  // Raw mutation of non-callable data remains legal without a callable consumer.
  {
    name: "should accept a raw word write to non-callable array storage",
    declarations: "let data: byte[2];",
    body: "data[0] = 1; pokew(&data, peekw($0330)); poke($C000, 7);",
    outcome: "success",
  },
] as const;

describe.each(sourceLibraryProfiles)("raw-write callable invalidation on %s", (profile) => {
  for (const testCase of cases) {
    it(
      testCase.name,
      async () => {
        const source = `module Game;
${testCase.declarations}
function chosen(): byte { return 37; }
function main(): void { ${testCase.body} }
`;
        await withProfileProject(source, profile, async (project) => {
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
