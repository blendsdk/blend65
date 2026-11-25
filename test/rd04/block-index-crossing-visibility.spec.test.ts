import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The chip fetches only inside its own 16 KiB bank. */
const VIC_BANK_END = 0x3fff;

/** In this window the chip reads character ROM instead of the RAM underneath. */
const CHARACTER_ROM = { start: 0x1000, end: 0x1fff } as const;

/** Expensive shapes need only one representative of the cooperative profile family. */
const REFERENCE_PROFILE = "c64-pal-prg-kernal-6581";

/** This object cannot fit wholly inside either uninterrupted visible RAM interval. */
const LARGE_BUFFER_BYTES = 9000;

/** Require a successful real build and retain its artifacts before temporary cleanup. */
async function build(source: string, profile: string): Promise<BuildArtifacts> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected a successful public build");
    return readProfileArtifacts(built);
  });
}

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve the complete buffer's final address without confusing it with other globals. */
function bufferAddress(artifacts: BuildArtifacts, byteWidth = 64): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return (
      symbol?.kind === "global" &&
      Array.isArray(symbol.labels) &&
      symbol.labels.some(
        (label: unknown) => typeof label === "string" && label.startsWith("b65_Game_buffer_"),
      )
    );
  });
  expect(matches, "Expected exactly one public buffer global").toHaveLength(1);
  const symbol = record(matches[0]);
  expect(symbol?.byteWidth, "The complete buffer must remain allocated").toBe(byteWidth);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error("The buffer has no public location");
  const starts = new Set<number>();
  for (const index of indexes) {
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= locations.length
    )
      throw new TypeError("The buffer has an invalid location index");
    const pieces = record(record(locations[index])?.availability)?.pieces;
    if (!Array.isArray(pieces)) throw new Error("The buffer has no available pieces");
    for (const piece of pieces) {
      const machine = record(record(piece)?.machine);
      if (typeof machine?.start === "number" && Number.isInteger(machine.start))
        starts.add(machine.start);
    }
  }
  if (starts.size !== 1) throw new Error("The buffer needs one unambiguous machine start");
  const start = [...starts][0];
  if (start === undefined) throw new Error("The buffer has no integral machine start");
  return start;
}

/**
 * Uninitialised live storage puts an unconstrained buffer in the character-ROM
 * window. Initialising the pad would move it past that window and hide the defect.
 */
function pushedIntoTheWindow(
  use: string,
  helpers = "",
  globals = "",
  buffer = "let buffer: byte[64];",
): string {
  return `module Game;
let pad: byte[2400];
${buffer}
${globals}
${helpers}
function main(): void { pad[0] = 1; ${use} }`;
}

/** Require the block actually selected by the byte-valued pointer to expose the object's RAM. */
function expectVisibleBlock(artifacts: BuildArtifacts, byteWidth = 64, offset = 0): void {
  const start = bufferAddress(artifacts, byteWidth);
  const fetched = ((Math.floor(start / 64) + offset / 64) % 256) * 64;
  expect(start % 64, "The object's address must select its own complete sprite block").toBe(0);
  expect(fetched, "The published byte must not wrap to unrelated RAM in the VIC bank").toBe(
    start + offset,
  );
  const end = fetched + 63;
  const description = `fetched bytes $${fetched.toString(16)}-$${end.toString(16)}`;
  expect(fetched, description).toBeGreaterThanOrEqual(0);
  expect(end, `${description} must stay inside the VIC bank`).toBeLessThanOrEqual(VIC_BANK_END);
  expect(
    fetched <= CHARACTER_ROM.end && end >= CHARACTER_ROM.start,
    `${description} would display character shapes instead of the sprite`,
  ).toBe(false);
}

/** Give each cooperative profile an independent case with time for real assembly. */
function forEachProfile(
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
): void {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
}

/** Each source shape publishes one block while exercising a different language boundary. */
type VisibilityCase = {
  readonly name: string;
  readonly use: string;
  readonly helpers: string;
  readonly globals?: string;
  readonly buffer?: string;
  readonly byteWidth?: number;
  readonly offset?: number;
};

/** A function boundary must not silently turn a sprite into character-ROM shapes. */
const visibilityCases: readonly VisibilityCase[] = [
  // Passing a block to a normal helper must not make the sprite disappear without a diagnostic.
  {
    name: "should keep a sprite block visible through a helper argument",
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }",
    use: "publish(lo(&buffer / 64));",
  },
  // The sprite index is not a block number; argument order must not select the wrong storage.
  {
    name: "should keep a sprite block visible through the second helper argument",
    helpers: "function publish(i: byte, b: byte): void { c64.vic.setSpritePointer(i, b); }",
    use: "publish(0, lo(&buffer / 64));",
  },
  // A value read through an address is not a read of the parameter's name, so it
  // needs its own case. If this breaks, the object at $1440 leaves the sprite
  // displaying character shapes with nothing reported.
  {
    name: "should keep a sprite block visible when read through a parameter's address",
    helpers:
      "function publish(b: byte): void { let a: word = &b; c64.vic.setSpritePointer(0, peek(a)); }",
    use: "publish(lo(&buffer / 64));",
  },
  // Passing the address onward still reads the value through an address, not the
  // parameter's name, so this needs its own case. If it breaks, the object at
  // $1440 leaves the sprite displaying character shapes with nothing reported.
  {
    name: "should keep a sprite block visible when a parameter's address is passed onward",
    helpers: `function reader(a: word): void { c64.vic.setSpritePointer(0, peek(a)); }
function publish(b: byte): void { reader(&b); }`,
    use: "publish(lo(&buffer / 64));",
  },
  // Selecting the second frame in the caller must not leave that frame reading character shapes.
  {
    name: "should expose the second block when the caller adds the displacement",
    buffer: "let buffer: byte[2][64];",
    byteWidth: 128,
    offset: 64,
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }",
    use: "publish(lo(&buffer / 64) + 1);",
  },
  // Moving frame selection into the helper must not change which 64 bytes the chip can see.
  {
    name: "should expose the second block when the callee adds the displacement",
    buffer: "let buffer: byte[2][64];",
    byteWidth: 128,
    offset: 64,
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, b + 1); }",
    use: "publish(lo(&buffer / 64));",
  },
  // Subtracting one from the second block must not leave the first block
  // displaying character shapes with nothing reported.
  {
    name: "should expose the first block when a callee subtracts from the second block number",
    buffer: "let buffer: byte[128];",
    byteWidth: 128,
    offset: 0,
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, b - 1); }",
    use: "publish(lo(&buffer[64] / 64));",
  },
  // Selecting the earlier block directly must not leave a sprite displaying
  // character shapes with nothing reported.
  {
    name: "should expose the first block when direct arithmetic subtracts from the second block number",
    buffer: "let buffer: byte[128];",
    byteWidth: 128,
    offset: 0,
    helpers: "",
    use: "c64.vic.setSpritePointer(0, lo(&buffer[64] / 64) - 1);",
  },
  // Two complements restore the original byte; splitting them must not hide the sprite's home.
  {
    name: "should keep a sprite block visible when complements straddle the call",
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, ~b); }",
    use: "publish(~lo(&buffer / 64));",
  },
  // An ordinary pass-through abstraction must not cost the developer visible sprite data.
  {
    name: "should keep a sprite block visible through a pass-through helper",
    helpers: `function forward(b: byte): byte { return b; }
function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }`,
    use: "publish(forward(lo(&buffer / 64)));",
  },
  // A CPU-only use of the same helper must not erase the chip-facing call's visible block.
  {
    name: "should preserve visibility when one helper serves both chip and CPU consumers",
    helpers: "function forward(b: byte): byte { return b; }",
    use: `c64.vic.setSpritePointer(0, forward(lo(&buffer / 64)));
poke($C000, forward(lo(&buffer / 64)));`,
  },
  // Using the same helper twice in one expression must not leave the second
  // frame displaying character shapes with nothing reported.
  {
    name: "should expose the second block through two nested calls to the same helper",
    buffer: "let buffer: byte[2][64];",
    byteWidth: 128,
    offset: 64,
    helpers: "function forward(b: byte): byte { return b; }",
    use: "c64.vic.setSpritePointer(0, forward(forward(lo(&buffer / 64)) + 1));",
  },
  // Choosing a local function pointer is normal source code, not permission to lose the sprite.
  {
    name: "should keep a sprite block visible through a local function pointer",
    helpers: "function blockOf(): byte { return lo(&buffer / 64); }",
    use: "let f: fn(): byte = &blockOf; c64.vic.setSpritePointer(0, f());",
  },
  // Keeping the callable at module scope must not make the chip read unrelated character shapes.
  {
    name: "should keep a sprite block visible through a module function pointer",
    globals: "let f: fn(): byte = &blockOf;",
    helpers: "function blockOf(): byte { return lo(&buffer / 64); }",
    use: "c64.vic.setSpritePointer(0, f());",
  },
  // A call made through an address names no particular function here, so the only
  // honest answer is to keep the whole object where the chip can read it. Getting
  // this wrong leaves a sprite displaying character shapes with nothing reported.
  {
    name: "should keep a sprite block visible when passed as an indirect-call argument",
    helpers: "function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }",
    use: "let p: fn(byte): void = &publish; p(lo(&buffer / 64));",
  },
  // Lending a filled array is ordinary API use; the selected sprite must still be visible.
  {
    name: "should keep a caller-filled borrowed array's sprite block visible",
    helpers: "function publish(xs: byte[]): void { c64.vic.setSpritePointer(0, xs[0]); }",
    use: "let frames: byte[2]; frames[0] = lo(&buffer / 64); publish(frames);",
  },
  // Filling caller-owned local storage must not silently publish a character-ROM block.
  {
    name: "should keep a sprite block visible after a callee fills a borrowed local array",
    helpers: "function fill(xs: byte[]): void { xs[0] = lo(&buffer / 64); }",
    use: "let frames: byte[2]; fill(frames); c64.vic.setSpritePointer(0, frames[0]);",
  },
  // Module-owned arrays need the same visible result as local arrays after a borrowed write.
  {
    name: "should keep a sprite block visible after a callee fills a borrowed module array",
    globals: "let frames: byte[2];",
    helpers: "function fill(xs: byte[]): void { xs[0] = lo(&buffer / 64); }",
    use: "fill(frames); c64.vic.setSpritePointer(0, frames[0]);",
  },
  // A helper may stage an argument in an array without making the final sprite unreadable.
  {
    name: "should keep a sprite block visible through a callee-local array lent onward",
    helpers: `function inner(xs: byte[]): void { c64.vic.setSpritePointer(0, xs[0]); }
function publish(b: byte): void { let f: byte[2]; f[0] = b; inner(f); }`,
    use: "publish(lo(&buffer / 64));",
  },
  // Returning a block number inside an array must not leave a sprite displaying
  // character shapes with nothing reported.
  {
    name: "should keep a sprite block visible through a helper-returned aggregate",
    helpers: "function pack(b: byte): byte[1] { return [b]; }",
    use: `let frames: byte[1] = pack(lo(&buffer / 64));
c64.vic.setSpritePointer(0, frames[0]);`,
  },
  // Building the frame array as a literal must not leave a sprite displaying
  // character shapes with nothing reported.
  {
    name: "should keep a sprite block visible through an aggregate literal",
    helpers: "",
    use: `let frames: byte[1] = [lo(&buffer / 64)];
c64.vic.setSpritePointer(0, frames[0]);`,
  },
  // Writing a frame number through a borrowed element's address must not leave
  // a sprite displaying character shapes with nothing reported.
  {
    name: "should keep a sprite block visible after a write through a borrowed element address",
    helpers: "function fill(xs: byte[], b: byte): void { poke(&xs[0], b); }",
    use: `let frames: byte[1] = [0];
fill(frames, lo(&buffer / 64));
c64.vic.setSpritePointer(0, frames[0]);`,
  },
  // Writing a module slot through its own address must not leave a sprite
  // displaying character shapes with nothing reported.
  {
    name: "should keep a sprite block visible after a write through a module slot address",
    globals: "let slot: byte;",
    helpers: "",
    use: "poke(&slot, lo(&buffer / 64)); c64.vic.setSpritePointer(0, slot);",
  },
  // poke($C000, ...) sends a byte somewhere the program chose, while
  // poke($0400 + i, ...) sends it somewhere the compiler cannot name; losing
  // visibility here risks a sprite reading character shapes with nothing reported.
  {
    name: "should keep a sprite block visible when written to a runtime-computed address",
    helpers: "",
    use: "let i: byte = peek($0400); poke($0400 + word(i), lo(&buffer / 64));",
  },
];

describe("block-index visibility across calls and borrowed storage", () => {
  for (const example of visibilityCases) {
    forEachProfile(example.name, async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow(example.use, example.helpers, example.globals, example.buffer),
        profile,
      );
      expectVisibleBlock(artifacts, example.byteWidth, example.offset);
    });
  }

  // Selecting bytes before the object must not relocate its unrelated storage
  // or refuse a legal program with no home in the bank.
  forEachProfile(
    "should leave an object's home untouched when subtraction selects the preceding block",
    async (profile) => {
      const published = await build(
        pushedIntoTheWindow("c64.vic.setSpritePointer(0, lo(&buffer / 64) - 1);"),
        profile,
      );
      const ordinary = await build(
        pushedIntoTheWindow("poke($C000, lo(&buffer / 64) - 1);"),
        profile,
      );
      expect(bufferAddress(published)).toBe(bufferAddress(ordinary));
    },
  );

  // Dispatch tables are a normal way to choose a producer; neither storage duration
  // may leave the sprite reading character shapes with nothing reported.
  for (const scope of ["module", "local"] as const) {
    it(`${REFERENCE_PROFILE}: should keep a sprite block visible through a ${scope} dispatch table`, async () => {
      const table = "let table: (fn(): byte)[2] = [&blockOf, &other];";
      const artifacts = await build(
        pushedIntoTheWindow(
          `${scope === "local" ? table : ""} c64.vic.setSpritePointer(0, table[0]());`,
          `function blockOf(): byte { return lo(&buffer / 64); }
function other(): byte { return 0; }`,
          scope === "module" ? table : "",
        ),
        REFERENCE_PROFILE,
      );
      expectVisibleBlock(artifacts);
    }, 120_000);
  }

  // A CPU-only helper must not impose a chip placement restriction on ordinary data.
  // The large object makes a mistaken whole-object visibility restriction unsatisfiable.
  it(`${REFERENCE_PROFILE}: should leave a large CPU-only argument's home identical to direct arithmetic`, async () => {
    const buffer = `let buffer: byte[${LARGE_BUFFER_BYTES}];`;
    const direct = await build(
      pushedIntoTheWindow("poke($C000, lo(&buffer / 64));", "", "", buffer),
      REFERENCE_PROFILE,
    );
    const throughArgument = await build(
      pushedIntoTheWindow(
        "publish(lo(&buffer / 64));",
        "function publish(b: byte): void { poke($C000, b); }",
        "",
        buffer,
      ),
      REFERENCE_PROFILE,
    );
    expect(bufferAddress(throughArgument, LARGE_BUFFER_BYTES)).toBe(
      bufferAddress(direct, LARGE_BUFFER_BYTES),
    );
  }, 120_000);

  // Calling a producer indirectly still performs ordinary CPU arithmetic when only
  // poke receives its result; otherwise legal large data may be rejected or relocated.
  it(`${REFERENCE_PROFILE}: should leave a large CPU-only indirect result's home identical to direct arithmetic`, async () => {
    const buffer = `let buffer: byte[${LARGE_BUFFER_BYTES}];`;
    const direct = await build(
      pushedIntoTheWindow("poke($C000, lo(&buffer / 64));", "", "", buffer),
      REFERENCE_PROFILE,
    );
    const indirect = await build(
      pushedIntoTheWindow(
        "let f: fn(): byte = &blockOf; poke($C000, f());",
        "function blockOf(): byte { return lo(&buffer / 64); }",
        "",
        buffer,
      ),
      REFERENCE_PROFILE,
    );
    expect(bufferAddress(indirect, LARGE_BUFFER_BYTES)).toBe(
      bufferAddress(direct, LARGE_BUFFER_BYTES),
    );
  }, 120_000);

  // The chip reads one block, not the unused tail. Requiring the entire large
  // object to be visible would reject a program with a perfectly usable sprite.
  it(`${REFERENCE_PROFILE}: should build a large object with only its helper-published block visible`, async () => {
    const artifacts = await build(
      pushedIntoTheWindow(
        "publish(lo(&buffer / 64));",
        "function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }",
        "",
        `let buffer: byte[${LARGE_BUFFER_BYTES}];`,
      ),
      REFERENCE_PROFILE,
    );
    expectVisibleBlock(artifacts, LARGE_BUFFER_BYTES);
  }, 120_000);

  // Selecting one block through nested calls must not refuse a legal large-sheet
  // program with no home in the bank.
  it(`${REFERENCE_PROFILE}: should build a large object published through two nested calls to the same helper`, async () => {
    await build(
      pushedIntoTheWindow(
        "c64.vic.setSpritePointer(0, forward(forward(lo(&buffer / 64)) + 1));",
        "function forward(b: byte): byte { return b; }",
        "",
        `let buffer: byte[${LARGE_BUFFER_BYTES}];`,
      ),
      REFERENCE_PROFILE,
    );
  }, 120_000);

  // An ordinary animation table must neither refuse a legal large-sheet program
  // with no home in the bank nor leave either sprite displaying character shapes
  // with nothing reported.
  it(`${REFERENCE_PROFILE}: should build a large animation sheet with both aggregate-literal blocks visible`, async () => {
    const artifacts = await build(
      pushedIntoTheWindow(
        `let frames: byte[2] = [lo(&buffer / 64), lo(&buffer[64] / 64)];
c64.vic.setSpritePointer(0, frames[0]);
c64.vic.setSpritePointer(1, frames[1]);`,
        "",
        "",
        `let buffer: byte[${LARGE_BUFFER_BYTES}];`,
      ),
      REFERENCE_PROFILE,
    );
    expectVisibleBlock(artifacts, LARGE_BUFFER_BYTES, 0);
    expectVisibleBlock(artifacts, LARGE_BUFFER_BYTES, 64);
  }, 120_000);

  // Without a chip consumer, returning a block number is just arithmetic. A helper
  // must not silently relocate data merely because its result resembles a sprite pointer.
  forEachProfile(
    "should leave a CPU-only returned block number's home untouched",
    async (profile) => {
      const direct = await build(pushedIntoTheWindow("poke($C000, lo(&buffer / 64));"), profile);
      const returned = await build(
        pushedIntoTheWindow(
          "poke($C000, blockOf());",
          "function blockOf(): byte { return lo(&buffer / 64); }",
        ),
        profile,
      );
      expect(bufferAddress(returned)).toBe(bufferAddress(direct));
    },
  );

  // Taking the same CPU-only number as an argument must not change the data's home either.
  forEachProfile("should leave a CPU-only helper argument's home untouched", async (profile) => {
    const direct = await build(pushedIntoTheWindow("poke($C000, lo(&buffer / 64));"), profile);
    const throughArgument = await build(
      pushedIntoTheWindow(
        "publish(lo(&buffer / 64));",
        "function publish(b: byte): void { poke($C000, b); }",
      ),
      profile,
    );
    expect(bufferAddress(throughArgument)).toBe(bufferAddress(direct));
  });

  // An explicit address belongs to the author, even when the chip cannot fetch
  // that RAM. A publishing helper must neither reject nor rewrite that choice.
  forEachProfile(
    "should preserve an explicit unreachable address across a publishing call",
    async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow(
          "publish(lo(&buffer / 64));",
          "function publish(b: byte): void { c64.vic.setSpritePointer(0, b); }",
          "",
          "place(at: $C040) let buffer: byte[64];",
        ),
        profile,
      );
      expect(bufferAddress(artifacts)).toBe(0xc040);
    },
  );
});
