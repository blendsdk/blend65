import { writeFile } from "node:fs/promises";
import { join } from "node:path";
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

/**
 * The refused wording that sends the author nowhere: `&buffer` already is a
 * constant, symbolic address, so demanding one names nothing they can change.
 */
const UNACTIONABLE = /constant\s+or\s+symbolic/iu;

/**
 * An actionable refusal names a form whose address is settled before layout
 * writes the artifact: a constant, an asset, or module-level stored data. The
 * pattern stays deliberately broad so any honest rewording passes.
 */
const ACTIONABLE = /constant|asset|module|stored|placed|place\(|layout|link/iu;

/** Give an embedded asset file deterministic, recognisable contents. */
function assetBytes(count: number): Buffer {
  return Buffer.from(Array.from({ length: count }, (_unused, index) => (index * 7 + 3) & 0xff));
}

/**
 * Build one program whose unconstrained objects land in the character-ROM
 * window. The uninitialised 2,400-byte pad is written once so it stays live:
 * initialising it would push later data past the window and hide the defect.
 */
function windowProgram(declarations: string, body: string): string {
  return `module Game;
let pad: byte[2400];
${declarations}
function main(): void { pad[0] = 1; ${body} }`;
}

/**
 * Require a successful real build and retain its artifacts before temporary
 * cleanup. Asset files are written beside the module source, which is where an
 * `embed()` path is resolved from.
 */
async function build(
  source: string,
  profile: string,
  assets: Readonly<Record<string, Buffer>> = {},
): Promise<BuildArtifacts> {
  return withProfileProject(source, profile, async (project, root) => {
    for (const [name, bytes] of Object.entries(assets))
      await writeFile(join(root, "src", name), bytes);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected a successful public build");
    return readProfileArtifacts(built);
  });
}

/**
 * Require a refused build and return every placement message, so a case can
 * assert what the author is told without depending on diagnostic ordering.
 */
async function refusalMessages(source: string, profile: string): Promise<string[]> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind).toBe("failure");
    if (built.kind !== "failure") throw new Error("Expected a refused placement");
    const messages = built.diagnostics
      .filter((diagnostic) => diagnostic.code === "E10273")
      .map((diagnostic) => diagnostic.message);
    expect(messages.length, JSON.stringify(built.diagnostics)).toBeGreaterThan(0);
    return messages;
  });
}

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve one named global's final address without confusing it with other globals. */
function globalAddress(artifacts: BuildArtifacts, name: string, byteWidth: number): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  const labelPrefix = `b65_Game_${name}_`;
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return (
      symbol?.kind === "global" &&
      Array.isArray(symbol.labels) &&
      symbol.labels.some(
        (label: unknown) => typeof label === "string" && label.startsWith(labelPrefix),
      )
    );
  });
  expect(matches, `Expected exactly one public global named ${name}`).toHaveLength(1);
  const symbol = record(matches[0]);
  expect(symbol?.byteWidth, `${name} must remain completely allocated`).toBe(byteWidth);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error(`${name} has no public location`);
  const starts = new Set<number>();
  for (const index of indexes) {
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= locations.length
    )
      throw new TypeError(`${name} has an invalid location index`);
    const pieces = record(record(locations[index])?.availability)?.pieces;
    if (!Array.isArray(pieces)) throw new Error(`${name} has no available pieces`);
    for (const piece of pieces) {
      const machine = record(record(piece)?.machine);
      if (typeof machine?.start === "number" && Number.isInteger(machine.start))
        starts.add(machine.start);
    }
  }
  if (starts.size !== 1) throw new Error(`${name} needs one unambiguous machine start`);
  const start = [...starts][0];
  if (start === undefined) throw new Error(`${name} has no integral machine start`);
  return start;
}

/**
 * Require every byte the chip will fetch from this run to be readable: inside
 * the selected bank, and clear of the window where character ROM replaces RAM.
 * A run that fails either test assembles into data the chip cannot see.
 */
function expectVisibleRun(start: number, bytes: number, what: string): void {
  const end = start + bytes - 1;
  const description = `${what} at $${start.toString(16)}-$${end.toString(16)}`;
  expect(start, description).toBeGreaterThanOrEqual(0);
  expect(end, `${description} must stay inside the VIC bank`).toBeLessThanOrEqual(VIC_BANK_END);
  expect(
    start <= CHARACTER_ROM.end && end >= CHARACTER_ROM.start,
    `${description} would read character ROM instead of the author's data`,
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

/** Run one reference-profile case; the cheap core shapes carry the profile sweep. */
function onReferenceProfile(name: string, body: () => Promise<void>): void {
  it(`${REFERENCE_PROFILE}: ${name}`, body, 120_000);
}

describe("VIC field capabilities on ordinary module storage", () => {
  // The capability exists so the compiler computes the block number. Refusing a
  // plain module array leaves the author hand-rolling the arithmetic, which no
  // one checks for bank residency, the character-ROM window or alignment.
  forEachProfile(
    "should accept an ordinary module array and give its sprite block a visible home",
    async (profile) => {
      const artifacts = await build(
        windowProgram(
          "let buffer: byte[64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        profile,
      );
      const start = globalAddress(artifacts, "buffer", 64);
      expect(start % 64, "the object must start its own complete sprite block").toBe(0);
      expectVisibleRun(start, 64, "the published sprite block");
    },
  );

  // The capability replaces this arithmetic, so it must agree with it exactly. A
  // different block number is a sprite showing the wrong bytes, and any extra
  // instruction is a run-time cost the author was told they would not pay.
  forEachProfile(
    "should emit the same bytes as the hand-rolled block arithmetic",
    async (profile) => {
      const capability = await build(
        windowProgram(
          "let buffer: byte[64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        profile,
      );
      const handRolled = await build(
        windowProgram("let buffer: byte[64];", "c64.vic.setSpritePointer(0, lo(&buffer / 64));"),
        profile,
      );
      expect(capability.prg).toEqual(handRolled.prg);
    },
  );

  // Selecting the second sprite of a sheet by adding to the base block is
  // ordinary style. A demand covering only the base block would let the second
  // one sit in the character-ROM window and display character shapes in silence.
  onReferenceProfile("should expose both blocks when the author adds one to the base", async () => {
    const artifacts = await build(
      windowProgram(
        "let buffer: byte[128];",
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer) + 1);",
      ),
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "buffer", 128);
    expect(start % 64, "the object must start its own complete sprite block").toBe(0);
    expectVisibleRun(start, 64, "the base sprite block");
    expectVisibleRun(start + 64, 64, "the sprite block after the base");
  });

  // The capability still resolves one address here; the addition afterwards is
  // ordinary byte arithmetic the compiler cannot evaluate. Any block of the
  // object may be selected, so losing any of them loses a sprite in silence.
  onReferenceProfile(
    "should expose every block when the displacement is chosen at run time",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let buffer: byte[128];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer) + pad[0]);",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "buffer", 128);
      expectVisibleRun(start, 128, "the whole run-time-selected object");
    },
  );

  // Computing the block in one function and publishing it in another is normal
  // decomposition, not permission to leave the sprite reading character shapes.
  onReferenceProfile("should expose the block a helper's answer publishes", async () => {
    const artifacts = await build(
      windowProgram(
        `let buffer: byte[64];
function blk(): byte { return c64.vic.vicSpriteBlock(&buffer); }`,
        "c64.vic.setSpritePointer(0, blk());",
      ),
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "buffer", 64);
    expect(start % 64, "the object must start its own complete sprite block").toBe(0);
    expectVisibleRun(start, 64, "the sprite block returned by a helper");
  });

  // Only the addressed 64 bytes are fetched. Demanding the whole 256-byte sheet
  // in the bank would refuse a legal program that has a perfectly usable sprite,
  // so the assertion covers the demanded run and leaves the rest unconstrained.
  onReferenceProfile(
    "should expose the demanded run at a static offset inside a larger object",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let sheet: byte[256];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheet[64]));",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "sheet", 256) + 64;
      expect(start % 64, "the addressed element must start a complete sprite block").toBe(0);
      expectVisibleRun(start, 64, "the sprite block at the addressed offset");
    },
  );

  // A struct field is the same shape as an element at a static offset, and an
  // author who groups their sheet into named parts must not lose the sprite.
  onReferenceProfile("should expose the demanded run at a struct field", async () => {
    const artifacts = await build(
      windowProgram(
        `struct Sheet { a: byte[64]; b: byte[64]; }
let s: Sheet;`,
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&s.b));",
      ),
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "s", 128) + 64;
    expect(start % 64, "the addressed field must start a complete sprite block").toBe(0);
    expectVisibleRun(start, 64, "the sprite block at the addressed field");
  });

  // This capability computes one field value from one address resolved before
  // the artifact is written. A run-time index names a different block on every
  // execution, so there is no single value to compute and the refusal is honest.
  // What the author loses is a legal intent refused, so the message must point
  // at the spelling that works instead of naming what they already wrote.
  onReferenceProfile(
    "should refuse a run-time-indexed element and name what the author can change",
    async () => {
      const messages = await refusalMessages(
        windowProgram(
          "let sheets: byte[4][64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheets[pad[0]]));",
        ),
        REFERENCE_PROFILE,
      );
      for (const message of messages) expect(message).not.toMatch(UNACTIONABLE);
      expect(messages.join("\n")).toMatch(ACTIONABLE);
    },
  );

  // Refusing the capability is only acceptable while the author has a spelling
  // that works, so the hand-rolled form must still build. The chip may read any
  // of the four elements, so every one of them has to stay visible.
  onReferenceProfile(
    "should keep every element visible for the hand-rolled run-time-indexed form",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let sheets: byte[4][64];",
          "c64.vic.setSpritePointer(0, lo(&sheets[pad[0]] / 64));",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "sheets", 256);
      expect(start % 64, "every selectable element must start a complete block").toBe(0);
      expectVisibleRun(start, 256, "every run-time-selectable sprite block");
    },
  );

  // An explicit address that already satisfies every requirement is exactly the
  // case the capability is for; refusing it would leave the author no spelling.
  onReferenceProfile(
    "should accept an explicitly placed object whose address already qualifies",
    async () => {
      const artifacts = await build(
        windowProgram(
          "place(at: $2000) let buffer: byte[64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        REFERENCE_PROFILE,
      );
      expect(globalAddress(artifacts, "buffer", 64)).toBe(0x2000);
      expectVisibleRun(0x2000, 64, "the explicitly placed sprite block");
    },
  );

  // These three refusals are the point of the capability: an author who uses it
  // cannot end up with a sprite the chip will not display. Each message has to
  // name the requirement that failed, or the author cannot act on it.
  const refusedPlacements: readonly { readonly address: string; readonly named: RegExp }[] = [
    { address: "$1000", named: /character[-\s]?ROM/iu },
    { address: "$4000", named: /bank/iu },
    { address: "$2010", named: /64[-\s]?byte align/iu },
  ];
  for (const { address, named } of refusedPlacements) {
    onReferenceProfile(`should refuse an explicit sprite address at ${address}`, async () => {
      const messages = await refusalMessages(
        windowProgram(
          `place(at: ${address}) let buffer: byte[64];`,
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        REFERENCE_PROFILE,
      );
      expect(messages.join("\n")).toMatch(named);
    });
  }

  // An address held in a word is only known while the program runs, so the
  // refusal is right. Telling the author it needs a constant or symbolic address
  // is not: they wrote one, and the message names nothing they can change.
  onReferenceProfile(
    "should refuse an unresolvable address with an actionable message",
    async () => {
      const messages = await refusalMessages(
        windowProgram(
          "let buffer: byte[64];",
          "let a: word = &buffer; c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(a));",
        ),
        REFERENCE_PROFILE,
      );
      for (const message of messages) expect(message).not.toMatch(UNACTIONABLE);
      expect(messages.join("\n")).toMatch(ACTIONABLE);
    },
  );

  // A one-byte offset cannot start a sprite block at any placement, and the
  // author's fix is an aligned offset, so the message must say which rule broke.
  onReferenceProfile("should refuse a one-byte offset and name the alignment", async () => {
    const messages = await refusalMessages(
      windowProgram(
        "let sheet: byte[256];",
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheet[1]));",
      ),
      REFERENCE_PROFILE,
    );
    expect(messages.join("\n")).toMatch(/64[-\s]?byte align/iu);
  });

  // A constant address compiles today and must keep compiling: widening the
  // capability to ordinary storage may not cost an author their working program.
  onReferenceProfile("should still accept a constant address", async () => {
    await build(
      windowProgram("", "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock($2000));"),
      REFERENCE_PROFILE,
    );
  });

  // An embedded asset compiles today, placed automatically and placed by the
  // author. Widening the capability to ordinary storage may not cost either
  // author their working program, so both forms must still build.
  for (const placement of ["", "place(at: $2000) "] as const) {
    const described = placement === "" ? "an automatically placed" : "an explicitly placed";
    onReferenceProfile(`should still accept ${described} asset`, async () => {
      await build(
        windowProgram(
          `${placement}const SPRITES: byte[] = embed("sprites.bin");`,
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));",
        ),
        REFERENCE_PROFILE,
        { "sprites.bin": assetBytes(64) },
      );
    });
  }

  // Taking an address for ordinary processor work claims nothing about the video
  // chip. Pulling such data into the bank would spend the scarcest 16 KiB in the
  // machine on bytes no video chip will ever read. Landing inside the window
  // where the chip reads character ROM instead is what proves nothing was
  // demanded of this object: one the chip's requirement governed could not be
  // there at all.
  onReferenceProfile("should leave an ordinary processor address out of the bank", async () => {
    const artifacts = await build(
      windowProgram("let buffer: byte[64];", "poke(&buffer, 1);"),
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "buffer", 64);
    const where = `$${start.toString(16)}`;
    expect(
      start,
      `${where} must stay where the live pad pushes an unconstrained object`,
    ).toBeGreaterThanOrEqual(CHARACTER_ROM.start);
    expect(start + 63, `${where} must not be pulled into chip-visible RAM`).toBeLessThanOrEqual(
      CHARACTER_ROM.end,
    );
  });

  // One object can serve both the processor and the chip. The chip's requirement
  // governs the shared address, and the program must still build.
  onReferenceProfile("should accept one address used for the processor and the chip", async () => {
    const artifacts = await build(
      windowProgram(
        "let buffer: byte[64];",
        "poke(&buffer, 1); c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
      ),
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "buffer", 64);
    expect(start % 64, "the shared object must start its own complete sprite block").toBe(0);
    expectVisibleRun(start, 64, "the shared sprite block");
  });

  // The sibling video fields have the same reason to exist and the same loss if
  // they refuse ordinary storage: every character cell on screen drawn from
  // character ROM, or a bitmap showing it, with nothing reported.
  const siblingFields: readonly {
    readonly field: string;
    readonly name: string;
    readonly bytes: number;
    readonly alignment: number;
    readonly fetched: number;
  }[] = [
    { field: "vicCharsetSelect", name: "charset", bytes: 2048, alignment: 2048, fetched: 2048 },
    { field: "vicScreenSelect", name: "screen", bytes: 1024, alignment: 1024, fetched: 1000 },
    { field: "vicBitmapSelect", name: "bitmap", bytes: 8192, alignment: 8192, fetched: 8000 },
  ];
  for (const { field, name, bytes, alignment, fetched } of siblingFields) {
    onReferenceProfile(
      `should place an ordinary module array ${field} publishes where the chip can read it`,
      async () => {
        const artifacts = await build(
          windowProgram(`let ${name}: byte[${bytes}];`, `poke($D018, c64.vic.${field}(&${name}));`),
          REFERENCE_PROFILE,
        );
        const start = globalAddress(artifacts, name, bytes);
        expect(start % alignment, `${name} must satisfy its hardware alignment`).toBe(0);
        expectVisibleRun(start, fetched, `the ${name} bytes the chip fetches`);
      },
    );
  }
});
