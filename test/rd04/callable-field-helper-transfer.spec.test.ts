import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const cases = [
  // A helper that stores a direct callable source makes the global field definite.
  {
    name: "should accept a global callable field stored by a helper",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
  // The same definite store through a borrowed parameter transfers to the actual.
  {
    name: "should accept a borrowed callable field stored by a helper",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function prepare(value: Box): void { value.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { box.cb = &other; prepare(box); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
  // A helper may initialize a borrowed aggregate whose field was not set first.
  {
    name: "should accept an uninitialized borrowed aggregate initialized by a helper",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(value: Box): void { value.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(box); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
  // A sibling non-callable field store does not block the callable field.
  {
    name: "should accept a callable field when a sibling field is also stored",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.prefix = 0; box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
  // A raw write through the borrowed field before the read destroys the proof.
  {
    name: "should reject a raw write through the borrowed field before the read",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function corrupt(value: Box): void { pokew(&value.cb, 0); }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); corrupt(box); poke($C000, invoke(box)); }`,
    outcome: "failure",
  },
  // A helper that stores and then corrupts the field leaves a kill.
  {
    name: "should reject a helper that stores and then corrupts the field",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; pokew(&box.cb, 0); }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "failure",
  },
  // A corruption followed by a definite store is repaired.
  {
    name: "should accept a helper that corrupts and then stores the field",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { pokew(&box.cb, 0); box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
  // A store on only one route is not a definite assignment.
  {
    name: "should reject a conditional callable-field store",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { if (peek($0400) != 0) { box.cb = &chosen; } }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "failure",
  },
  // An indexed store keeps the whole aggregate conservative.
  {
    name: "should reject an indexed store to the aggregate before the callable read",
    source: `module Game;
struct Box { callbacks: (fn(): byte)[2]; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; box.callbacks[peek($0400) & 1] = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "failure",
  },
  // A callable value copied from another field is not a direct source store.
  {
    name: "should reject a callable field copied from a non-source value",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
let other: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = other.cb; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { other.cb = &chosen; prepare(); poke($C000, invoke(box)); }`,
    outcome: "failure",
  },
  // A corrupted aggregate copy never restores the callable provenance.
  {
    name: "should reject a corrupted aggregate copy after a helper raw write",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&box.cb, 0); }
function main(): void { box.cb = &chosen; corrupt(); let copy: Box = box; poke($C000, copy.cb()); }`,
    outcome: "failure",
  },
  // A raw write to a disjoint field does not invalidate the callable field.
  {
    name: "should accept a helper raw write to a disjoint field",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; poke(&box.prefix, 0); }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`,
    outcome: "success",
  },
] as const;

describe.each(sourceLibraryProfiles)("callable-field helper transfer on %s", (profile) => {
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
