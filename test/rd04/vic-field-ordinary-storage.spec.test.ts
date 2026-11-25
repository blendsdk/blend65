import { describe, expect } from "vitest";
import {
  CHARACTER_ROM,
  RECOMMENDS_ADDING_A_BLOCK_NUMBER,
  RECOMMENDS_A_SCALED_STEP,
  REFERENCE_PROFILE,
  assetBytes,
  build,
  expectActionable,
  expectVisibleRun,
  forEachProfile,
  globalAddress,
  onReferenceProfile,
  refusalTexts,
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

  // This capability computes one field value from one address resolved before
  // the artifact is written. A run-time index names a different block on every
  // execution, so there is no single value to compute and the refusal is honest.
  // What the author loses is a legal intent refused, so the message must point
  // at the spelling that works instead of naming what they already wrote.
  onReferenceProfile(
    "should refuse a run-time-indexed element and name what the author can change",
    async () => {
      const texts = await refusalTexts(
        windowProgram(
          "let sheets: byte[4][64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheets[pad[0]]));",
        ),
        REFERENCE_PROFILE,
      );
      expectActionable(texts);
      const told = texts.join("\n");
      expect(told, "the working spelling adds a block number").toMatch(
        RECOMMENDS_ADDING_A_BLOCK_NUMBER,
      );
      // One block per element, so the step is the index itself. Advice that
      // scales it here would skip past three quarters of the sheet.
      expect(told, "a one-block element needs no multiplied step").not.toMatch(
        RECOMMENDS_A_SCALED_STEP,
      );
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

  // This is the spelling the refusal points the author at, so it has to work:
  // the capability resolves one address and the run-time choice is added to the
  // block number afterwards. Any element may be selected, so every one of them
  // must stay readable.
  onReferenceProfile(
    "should keep every element visible when the run-time choice is added to the block number",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let sheets: byte[4][64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheets[0]) + pad[0]);",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "sheets", 256);
      expect(start % 64, "every selectable element must start a complete block").toBe(0);
      expectVisibleRun(start, 256, "every block the added choice can select");
    },
  );

  // A wide element spans two blocks, so the advice must scale the step. A
  // developer who follows advice that does not gets the second half of the
  // previous frame instead of the frame they asked for, with nothing reported.
  onReferenceProfile(
    "should refuse a run-time-indexed wide element and scale the advice",
    async () => {
      const texts = await refusalTexts(
        windowProgram(
          "let sheets: byte[4][128];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheets[pad[0]]));",
        ),
        REFERENCE_PROFILE,
      );
      expectActionable(texts);
      expect(texts.join("\n"), "a two-block element needs the step multiplied by two").toMatch(
        RECOMMENDS_A_SCALED_STEP,
      );
    },
  );

  // The scaled spelling is what that refusal recommends, so it has to build and
  // to keep every frame readable. If it did not, the advice would be naming
  // something that does not work, which is worse than refusing at all.
  onReferenceProfile(
    "should keep every wide element visible when the scaled choice is added",
    async () => {
      const artifacts = await build(
        windowProgram(
          "let sheets: byte[4][128];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheets[0]) + pad[0] * byte(2));",
        ),
        REFERENCE_PROFILE,
      );
      const start = globalAddress(artifacts, "sheets", 512);
      expect(start % 64, "every selectable element must start a complete block").toBe(0);
      expectVisibleRun(start, 512, "every block the scaled choice can select");
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
  // name the bound that actually failed, and only that one. Both of the first
  // two addresses break a video rule, so a message listing every rule would
  // read as correct for either of them while telling the author nothing about
  // which one they hit. The patterns therefore tie the offending address to its
  // own cause, and reject the other cause attached to that same address; `;`
  // and `.` bound each clause so a general restatement elsewhere in the text
  // cannot satisfy them.
  const refusedPlacements: readonly {
    readonly address: string;
    readonly names: RegExp;
    readonly rejects?: RegExp;
  }[] = [
    {
      address: "$1000",
      names: /\$0*1000\b[^.;]*character[-\s]?ROM/iu,
      rejects: /\$0*1000\b[^.;]*outside/iu,
    },
    {
      address: "$4000",
      names: /\$0*4000\b[^.;]*\bbank\b/iu,
      rejects: /\$0*4000\b[^.;]*character[-\s]?ROM/iu,
    },
    { address: "$2010", names: /64[-\s]?byte align/iu },
  ];
  for (const { address, names, rejects } of refusedPlacements) {
    onReferenceProfile(`should refuse an explicit sprite address at ${address}`, async () => {
      const texts = await refusalTexts(
        windowProgram(
          `place(at: ${address}) let buffer: byte[64];`,
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        REFERENCE_PROFILE,
      );
      const told = texts.join("\n");
      expect(told, `${address} must be blamed on the bound it actually breaks`).toMatch(names);
      if (rejects !== undefined)
        expect(told, `${address} must not be blamed on the other bound`).not.toMatch(rejects);
      expectActionable(texts);
    });
  }

  // $2000 satisfies every rule the chip has: in the bank, clear of the window,
  // 64-byte aligned. What is wrong is that another object is already there, so
  // the explicit constraint is the thing to change. Blaming the address instead
  // costs the author an afternoon moving a sprite that was already in exactly
  // the right place.
  onReferenceProfile("should refuse an occupied address without blaming it", async () => {
    const texts = await refusalTexts(
      `module Game;
place(at: $2000) let other: byte[64];
place(at: $2000) let buffer: byte[64];
function main(): void { other[0] = 1; c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer)); }`,
      REFERENCE_PROFILE,
    );
    const told = texts.join("\n");
    expect(told, "the explicit constraint is what the author can change").toMatch(
      /explicit[^.;]*constraint|change or remove/iu,
    );
    expect(told, "a qualifying address must not be blamed for the conflict").not.toMatch(
      /\$0*2000\b[^.;]*(?:does not|doesn't|fails|cannot|character[-\s]?ROM|outside|align)/iu,
    );
    expectActionable(texts);
  });

  // $0100 is the other way a fixed address the chip is happy with can still be
  // refused: inside the bank, far from the window, 64-byte aligned, but below
  // the start of the range a loaded program may occupy. That is the rule that
  // refuses it, so the explicit constraint is again the thing to change.
  // Blaming the chip's requirement sends the author moving a sprite around the
  // video bank to satisfy a rule it already satisfied, while the rule that
  // actually stopped them is never named.
  onReferenceProfile(
    "should refuse an address below the resident window without blaming it",
    async () => {
      const texts = await refusalTexts(
        windowProgram(
          "place(at: $0100) let buffer: byte[64];",
          "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&buffer));",
        ),
        REFERENCE_PROFILE,
      );
      const told = texts.join("\n");
      expect(told, "the explicit constraint is what the author can change").toMatch(
        /explicit[^.;]*constraint|change or remove/iu,
      );
      expect(
        told,
        "a qualifying address must not be blamed for the chip's requirement",
      ).not.toMatch(
        /\$0*100\b[^.;]*(?:does not|doesn't|fails|cannot|character[-\s]?ROM|outside|align)/iu,
      );
      expectActionable(texts);
    },
  );

  // Nothing can enter `later`: it is never called and its address is never
  // taken, so the chip is never handed anything. Stating the field's
  // requirement from a body that cannot run refuses a legal program over a
  // sprite it never publishes, and tells the author to move data for a function
  // they deleted the last call to.
  const deadBodyDeclarations = "place(at: $4000) let far: byte[64];";
  const publishFar = "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&far));";
  onReferenceProfile("should ignore a field requirement in an unreachable body", async () => {
    const artifacts = await build(
      `module Game;
let pad: byte[2400];
${deadBodyDeclarations}
function later(): void { ${publishFar} }
function main(): void { pad[0] = 1; far[0] = 2; }`,
      REFERENCE_PROFILE,
    );
    expect(globalAddress(artifacts, "far", 64), "the author's address is still theirs").toBe(
      0x4000,
    );
  });

  // The live partner is the point of the pair: the same requirement from code
  // that does run is right to refuse, so the acceptance above cannot be met by
  // dropping the requirement altogether.
  onReferenceProfile("should refuse the same field requirement from a live body", async () => {
    const texts = await refusalTexts(
      windowProgram(deadBodyDeclarations, `far[0] = 2; ${publishFar}`),
      REFERENCE_PROFILE,
    );
    expect(texts.join("\n"), "$4000 must be blamed on the bank it is outside").toMatch(
      /\$0*4000\b[^.;]*\bbank\b/iu,
    );
    expectActionable(texts);
  });

  // An address held in a word is only known while the program runs, so the
  // refusal is right. Telling the author it needs a constant or symbolic address
  // is not: they wrote one, and the message names nothing they can change.
  onReferenceProfile(
    "should refuse an unresolvable address with an actionable message",
    async () => {
      const texts = await refusalTexts(
        windowProgram(
          "let buffer: byte[64];",
          "let a: word = &buffer; c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(a));",
        ),
        REFERENCE_PROFILE,
      );
      expectActionable(texts);
    },
  );

  // A one-byte offset cannot start a sprite block at any placement, and the
  // author's fix is an aligned offset, so the message must say which rule broke.
  onReferenceProfile("should refuse a one-byte offset and name the alignment", async () => {
    const texts = await refusalTexts(
      windowProgram(
        "let sheet: byte[256];",
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&sheet[1]));",
      ),
      REFERENCE_PROFILE,
    );
    expect(texts.join("\n")).toMatch(/64[-\s]?byte align/iu);
  });

  // A zero-page home is chosen by an allocator that knows nothing of video
  // alignment, and the author never wrote that address, so neither of them can
  // be held to the chip's requirement. The refusal has to say which storage is
  // the problem, or the author cannot see what to move.
  onReferenceProfile("should refuse a zero-page home and name the storage", async () => {
    const texts = await refusalTexts(
      windowProgram(
        "zeropage { b: byte[64]; }",
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&b));",
      ),
      REFERENCE_PROFILE,
    );
    expect(texts.join("\n")).toMatch(/zero[-\s]?page/iu);
    expectActionable(texts);
  });

  // Checking only the base address is what let this build in silence: $0FC0 is
  // a legal sprite block, and the block after it starts at $1000, the first byte
  // the chip reads from character ROM. The displaced block is fetched too, so it
  // has to be checked too.
  onReferenceProfile("should refuse a displaced block that leaves the readable area", async () => {
    const texts = await refusalTexts(
      windowProgram(
        "place(at: $0FC0) let b: byte[128];",
        "c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&b) + 1);",
      ),
      REFERENCE_PROFILE,
    );
    expect(texts.join("\n")).toMatch(/character[-\s]?ROM/iu);
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

  // An animated sheet addressed at one of its own frames is the commonest shape
  // there is, and both index forms are refused. The refusal may not tell this
  // author that the compiler cannot attribute the address to one object, nor to
  // pass `&` straight to the field: they did exactly that, on an asset, which is
  // the form the advice itself recommends. It has to name the spelling that
  // works — address the asset and add the frame's block number — or an author
  // holding a working program is sent in a circle.
  for (const index of ["peek($0400)", "64"] as const) {
    const described = index === "64" ? "a literal" : "a run-time";
    onReferenceProfile(
      `should refuse ${described} index into an asset with usable advice`,
      async () => {
        const texts = await refusalTexts(
          `module Game;
const SPRITES: byte[128] = embed("sprites.bin");
function main(): void { c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES[${index}])); }`,
          REFERENCE_PROFILE,
          { "sprites.bin": assetBytes(128) },
        );
        expectActionable(texts);
        expect(texts.join("\n"), "the working spelling adds a block number").toMatch(
          RECOMMENDS_ADDING_A_BLOCK_NUMBER,
        );
      },
    );
  }

  // The spelling those two refusals recommend has to work, or the advice is a
  // guess that costs the author another attempt.
  onReferenceProfile("should accept an asset's block number with a frame added", async () => {
    await build(
      `module Game;
const SPRITES: byte[128] = embed("sprites.bin");
function main(): void { c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES) + 1); }`,
      REFERENCE_PROFILE,
      { "sprites.bin": assetBytes(128) },
    );
  });

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

  // These two fields refuse ordinary storage on purpose. The machinery each one
  // needs is carried only for an embedded asset: a screen matrix ends in the
  // eight sprite-pointer bytes the chip fetches, and a bitmap reads 8,000 bytes
  // regardless of how short the declaration is. Accepting module storage would
  // leave those eight bytes owned by nobody and thousands of fetched bytes
  // reserved by nobody — losses no message would ever report, which is why
  // refusing beats accepting here. What the author loses is a legal intent
  // refused, so the refusal must name the spellings that do work.
  const withdrawnFields: readonly { readonly field: string; readonly declaration: string }[] = [
    { field: "vicScreenSelect", declaration: "let screen: byte[1024];" },
    { field: "vicBitmapSelect", declaration: "let bitmap: byte[8192];" },
  ];
  for (const { field, declaration } of withdrawnFields) {
    const name = declaration.slice("let ".length, declaration.indexOf(":"));
    onReferenceProfile(
      `should refuse ${field} on ordinary module storage and name the spellings that work`,
      async () => {
        const texts = await refusalTexts(
          windowProgram(declaration, `poke($D018, c64.vic.${field}(&${name}));`),
          REFERENCE_PROFILE,
        );
        expectActionable(texts);
        const told = texts.join("\n");
        expect(told, "an embedded asset is one working spelling").toMatch(/embed|asset/iu);
        expect(told, "a constant address is the other").toMatch(/constant|address itself/iu);
      },
    );
  }
});
