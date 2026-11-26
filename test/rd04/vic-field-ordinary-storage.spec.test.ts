import { describe, expect } from "vitest";
import {
  CHARACTER_ROM,
  REFERENCE_PROFILE,
  assetBytes,
  build,
  expectVisibleRun,
  forEachProfile,
  globalAddress,
  onReferenceProfile,
  windowProgram,
} from "./vic-field-test-support.js";

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

  // A charset needs nothing from the compiler beyond alignment and a reachable
  // run, and a partial charset is legal, so ordinary storage is enough. Refusing
  // it would leave every character cell on screen drawn from character ROM
  // instead of the author's own shapes, with nothing reported.
  onReferenceProfile(
    "should place an ordinary module array vicCharsetSelect publishes where the chip can read it",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let charset: byte[2048];",
          "poke($D018, c64.vic.vicCharsetSelect(&charset));",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "charset", 2048);
      expect(start % 2048, "a charset must satisfy its hardware alignment").toBe(0);
      expectVisibleRun(start, 2048, "the charset bytes the chip fetches");
    },
  );

  // An object larger than the field's footprint is what separates the two ways
  // this can go wrong, because only the first 2,048 bytes are ever fetched.
  // Under-state the footprint and the later characters come from outside the
  // chip's reach, so text on screen is partly garbage with nothing reported.
  // Over-state it and a legal 4 KiB object is refused over bytes the chip never
  // reads, which costs the author their build. The bytes past the footprint
  // carry no requirement, so nothing here asserts anything about them.
  onReferenceProfile(
    "should read only the character-memory footprint from an object larger than it",
    async () => {
      const artifacts = await build(
        `module Game;
let filler: byte[11000];
let charset: byte[4096];
function main(): void { filler[0] = 1; poke($D018, c64.vic.vicCharsetSelect(&charset)); }`,
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "charset", 4096);
      expect(start % 2048, "a charset must satisfy its hardware alignment").toBe(0);
      expectVisibleRun(start, 2048, "the charset bytes the chip fetches");
    },
  );
});
