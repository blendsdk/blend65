import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { deriveFixedLoopFacts, fixedLoopValueBounds } from "../semantic/fixed-loop-facts.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { selectClosedObjectStorage, validObjectStorageBundle } from "./selection.js";

const SOURCE = `module Game;
struct Packet { values: byte[4]; }
function make(): Packet {
  let result: Packet = { values: [1,2,3,4] };
  return result;
}
function consume(source: const Packet): byte { return source.values[0]; }
function main(): void {
  let received: Packet = make();
  poke($C000, consume(received));
}`;

/** Install the sealed recipes in the packet shape consumed by machine validation. */
function bundle(selections: ReturnType<typeof selectClosedObjectStorage>) {
  return new Map([...selections].map(([fn, storage]) => [fn, { storage }] as const));
}

describe("restricted canonical object selection", () => {
  it("should bind the seal to its derivation scope and reject a Closed map as object-only", () => {
    const input = effectFixture(SOURCE, "none", false);
    const loops = deriveFixedLoopFacts(input.checked.program, input.checked.loopNesting);
    const objects = deriveClosedObjectFacts(
      input.checked.program,
      input.checked.profile.storage,
      fixedLoopValueBounds(input.checked.program, loops),
    );
    const closed = selectClosedObjectStorage(objects);
    const restricted = selectClosedObjectStorage(objects, true);
    expect(closed.size).toBeGreaterThan(0);
    expect(restricted.size).toBeGreaterThan(0);
    expect(validObjectStorageBundle(bundle(closed), true, "closed")).toBe(true);
    expect(validObjectStorageBundle(bundle(closed), true, "canonical-object")).toBe(false);
    expect(validObjectStorageBundle(bundle(restricted), true, "canonical-object")).toBe(true);
    expect(validObjectStorageBundle(bundle(restricted), true, "closed")).toBe(false);
  });
});
