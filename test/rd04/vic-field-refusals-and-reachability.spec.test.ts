import { describe, expect } from "vitest";
import {
  RECOMMENDS_ADDING_A_BLOCK_NUMBER,
  RECOMMENDS_A_SCALED_STEP,
  REFERENCE_PROFILE,
  assetBytes,
  build,
  expectActionable,
  expectVisibleRun,
  globalAddress,
  onReferenceProfile,
  refusalTexts,
  windowProgram,
} from "./vic-field-test-support.js";

describe("VIC field refusals, their wording and the bodies that state them", () => {
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

  // A module initializer runs at startup, before the entry function, so a
  // publisher it names genuinely executes even though no function body mentions
  // it. These two routes are the only ways that can happen, which is why each
  // gets its own case. Both assert that the build succeeds, because that is
  // what breaks: the demand on the storage is dropped, the object is placed as
  // if the chip never reads it, and a later check on the field address then
  // refuses the program and blames a placement constraint the source does not
  // contain — "Move 'place(at:)' on this object to an address that satisfies
  // the requirement above", for an address the compiler chose itself. Nothing
  // about this object is the author's doing, so there is nothing for them to
  // move: a legal program refused on a cause that is not true.
  const initializerPublisher = `let buffer: byte[64];
function blk(): byte { return c64.vic.vicSpriteBlock(&buffer); }`;
  const reachedByInitializer: readonly {
    readonly route: string;
    readonly declare: string;
    readonly publish: string;
  }[] = [
    {
      route: "an initializer that takes its address",
      declare: "let f: fn(): byte = &blk;",
      publish: "c64.vic.setSpritePointer(0, f());",
    },
    {
      route: "an initializer that calls it",
      declare: "let b: byte = blk();",
      publish: "c64.vic.setSpritePointer(0, b);",
    },
  ];
  for (const { route, declare, publish } of reachedByInitializer) {
    onReferenceProfile(
      `should give a visible home to a publisher reached by ${route}`,
      async () => {
        const artifacts = await build(
          windowProgram(`${initializerPublisher}\n${declare}`, publish),
          REFERENCE_PROFILE,
        );
        const start = globalAddress(artifacts, "buffer", 64);
        expect(start % 64, "the object must start its own complete sprite block").toBe(0);
        expectVisibleRun(start, 64, "the sprite block an initializer's publisher names");
      },
    );
  }

  // The line between the two answers has to hold inside one program, which
  // neither the cases above nor the unreachable one can show on its own: a
  // publisher an initializer names is live and constrains its object, while one
  // nothing names at all is not and leaves the author's address alone. Widening
  // liveness to every function in such a program would break the second half.
  onReferenceProfile("should constrain only the publisher an initializer names", async () => {
    const artifacts = await build(
      `module Game;
let pad: byte[2400];
${initializerPublisher}
${deadBodyDeclarations}
function never(): void { ${publishFar} }
let b: byte = blk();
function main(): void { pad[0] = 1; far[0] = 2; c64.vic.setSpritePointer(0, b); }`,
      REFERENCE_PROFILE,
    );
    const start = globalAddress(artifacts, "buffer", 64);
    expect(start % 64, "the live publisher's object must start a complete block").toBe(0);
    expectVisibleRun(start, 64, "the sprite block the live publisher names");
    expect(
      globalAddress(artifacts, "far", 64),
      "the unreachable publisher's address is still the author's",
    ).toBe(0x4000);
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
