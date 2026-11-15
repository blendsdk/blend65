import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const cases = [
  // A helper's raw write invalidates a later callable read in its caller.
  {
    name: "should reject a call after a helper raw word write to the callable",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&callback, 0); }
function main(): void { callback = &chosen; corrupt(); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // A helper must observe the caller's earlier invalidation.
  {
    name: "should reject a call from a helper after the caller raw word write",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function useIt(): byte { return callback(); }
function main(): void { callback = &chosen; pokew(&callback, 0); poke($C000, useIt()); }`,
    outcome: "failure",
  },
  // Two borrowed parameters can refer to the same callable bytes.
  {
    name: "should reject a call through a second borrowed parameter of the same object",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corruptAndRead(p: Box, q: Box): void { pokew(&p.cb, 0); poke($C000, q.cb()); }
function main(): void { box.cb = &chosen; corruptAndRead(box, box); }`,
    outcome: "failure",
  },
  // A borrowed raw write remains visible after the helper returns.
  {
    name: "should reject a call after a helper raw word write through a borrowed parameter",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corruptBox(p: Box): void { pokew(&p.cb, 0); }
function main(): void { box.cb = &chosen; corruptBox(box); poke($C000, box.cb()); }`,
    outcome: "failure",
  },
  // A borrowed object can alias the global storage that a helper overwrites.
  {
    name: "should reject a borrowed read after a helper raw write to the same global",
    source: `module Game;
struct Box { cb: fn(): byte; }
let shared: Box;
function chosen(): byte { return 37; }
function corruptGlobalReadParam(p: Box): void { pokew(&shared.cb, 0); poke($C000, p.cb()); }
function main(): void { shared.cb = &chosen; corruptGlobalReadParam(shared); }`,
    outcome: "failure",
  },
  // Overwriting a borrowed alias invalidates a read through the global name.
  {
    name: "should reject a global read after a helper raw write through the aliasing parameter",
    source: `module Game;
struct Box { cb: fn(): byte; }
let shared: Box;
function chosen(): byte { return 37; }
function corruptParamReadGlobal(p: Box): void { pokew(&p.cb, 0); poke($C000, shared.cb()); }
function main(): void { shared.cb = &chosen; corruptParamReadGlobal(shared); }`,
    outcome: "failure",
  },
  // Forwarding a borrowed object does not hide the inner helper's raw write.
  {
    name: "should reject a call after a forwarded borrowed raw word write",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function inner(x: Box): void { pokew(&x.cb, 0); }
function outer(y: Box): void { inner(y); }
function main(): void { box.cb = &chosen; outer(box); poke($C000, box.cb()); }`,
    outcome: "failure",
  },
  // Aliasing survives forwarding both borrowed parameters through another helper.
  {
    name: "should reject a borrowed read when forwarded parameters receive the same object",
    source: `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function inner(x: Box, y: Box): void { pokew(&x.cb, 0); poke($C000, y.cb()); }
function outer(a: Box, b: Box): void { inner(a, b); }
function main(): void { box.cb = &chosen; outer(box, box); }`,
    outcome: "failure",
  },
  // A raw write invalidates the callable across multiple direct call boundaries.
  {
    name: "should reject a call after a transitive helper raw word write",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function deepest(): void { pokew(&callback, 0); }
function middle(): void { deepest(); }
function main(): void { callback = &chosen; middle(); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // A known indirect target carries the same raw-write effect as a direct call.
  {
    name: "should reject a call after a finite indirect call to a raw-writing helper",
    source: `module Game;
let callback: fn(): byte;
let action: fn(): void;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&callback, 0); }
function main(): void { callback = &chosen; action = &corrupt; action(); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // Startup initialization can invalidate an earlier callable initializer.
  {
    name: "should reject a call after an un-restored startup initializer kill",
    source: `module Game;
let callback: fn(): byte = &chosen;
let marker: byte = corruptStartup();
function chosen(): byte { return 37; }
function corruptStartup(): byte { pokew(&callback, 0); return 0; }
function main(): void { poke($C000, callback()); }`,
    outcome: "failure",
  },
  // An unconditional typed assignment in a helper restores the callable proof.
  {
    name: "should accept a call after a helper definitely restores the callable",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function repair(): void { callback = &chosen; }
function main(): void { pokew(&callback, 0); repair(); poke($C000, callback()); }`,
    outcome: "success",
  },
  // Placed callable storage can be restored by the same typed assignment.
  {
    name: "should accept a call after a helper restores a placed callable",
    source: `module Game;
place(at: $C100) let callback: fn(): byte;
function chosen(): byte { return 37; }
function repair(): void { callback = &chosen; }
function main(): void { pokew(&callback, 0); repair(); poke($C000, callback()); }`,
    outcome: "success",
  },
  // Restoration on only one possible route cannot prove the later call safe.
  {
    name: "should reject a call when a helper restores the callable only on one route",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function maybeRepair(): void { if (peek($0400) != 0) { callback = &chosen; } }
function main(): void { pokew(&callback, 0); maybeRepair(); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // A later raw write removes the proof established earlier in the helper.
  {
    name: "should reject a call when a helper restores and then corrupts the callable",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function repairThenCorrupt(): void { callback = &chosen; pokew(&callback, 0); }
function main(): void { pokew(&callback, 0); repairThenCorrupt(); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // A final typed assignment repairs the helper's earlier raw corruption.
  {
    name: "should accept a call when a helper corrupts and then restores the callable",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function corruptThenRepair(): void { pokew(&callback, 0); callback = &chosen; }
function main(): void { callback = &chosen; corruptThenRepair(); poke($C000, callback()); }`,
    outcome: "success",
  },
  // A byte write to a preceding field does not overlap the callable field.
  {
    name: "should accept a call after a disjoint raw byte field write",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; poke(&box.prefix, 0); poke($C000, box.cb()); }`,
    outcome: "success",
  },
  // A bounded dynamic byte write remains inside the sibling array.
  {
    name: "should accept a call after a checked dynamic write inside a sibling array",
    source: `module Game;
struct Box { data: byte[2]; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; poke(&box.data[peek($0400) & 1], 0); poke($C000, box.cb()); }`,
    outcome: "success",
  },
  // Corrupting one object does not invalidate a distinct object's callable.
  {
    name: "should accept a distinct object call after a raw write to another object",
    source: `module Game;
struct Box { cb: fn(): byte; }
let left: Box;
let right: Box;
function chosen(): byte { return 37; }
function inspect(p: Box): void { poke($C000, p.cb()); }
function main(): void { left.cb = &chosen; right.cb = &chosen; inspect(left); inspect(right); pokew(&left.cb, 0); poke($C000, right.cb()); }`,
    outcome: "success",
  },
  // An unknown destination can overlap the callable's storage.
  {
    name: "should reject a call after an unresolvable raw destination",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; poke(peekw($0330), 0); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // Unknown raw writes remain legal when no later callable read needs proof.
  {
    name: "should accept an unresolvable raw write with no later callable read",
    source: `module Game;
function main(): void { poke(peekw($0330), 0); poke($C000, 7); }`,
    outcome: "success",
  },
  // A borrowed word write can cross into an adjacent placed callable.
  {
    name: "should reject a call when a borrowed word write crosses an adjacent placed callable",
    source: `module Game;
struct Prefix { value: byte; }
place(at: $C100) let prefix: Prefix;
place(at: $C101) let callback: fn(): byte;
function chosen(): byte { return 37; }
function zap(p: Prefix): void { pokew(&p.value, 0); }
function main(): void { callback = &chosen; zap(prefix); poke($C000, callback()); }`,
    outcome: "failure",
  },
  // Borrowing does not broaden a byte write beyond its disjoint prefix field.
  {
    name: "should accept a borrowed byte write to a disjoint prefix field",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corruptPrefix(p: Box): void { poke(&p.prefix, 0); }
function main(): void { box.cb = &chosen; corruptPrefix(box); poke($C000, box.cb()); }`,
    outcome: "success",
  },
  // A helper's raw write to unrelated storage preserves the callable proof.
  {
    name: "should accept a call after a helper raw write to unrelated storage",
    source: `module Game;
let callback: fn(): byte;
let other: word;
function chosen(): byte { return 37; }
function touchOther(): void { pokew(&other, 0); }
function main(): void { callback = &chosen; other = 0; touchOther(); poke($C000, callback()); }`,
    outcome: "success",
  },
] as const;

describe.each(sourceLibraryProfiles)(
  "interprocedural raw-write callable invalidation on %s",
  (profile) => {
    for (const testCase of cases) {
      it(
        testCase.name,
        async () => {
          await withProfileProject(testCase.source, profile, async (project) => {
            const built = await buildProject({ project, optimization: "none" });
            if (testCase.outcome === "failure") {
              expect(built.kind, JSON.stringify(built.diagnostics)).toBe("failure");
              expect(built.diagnostics, JSON.stringify(built.diagnostics)).toEqual(
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
  },
);
