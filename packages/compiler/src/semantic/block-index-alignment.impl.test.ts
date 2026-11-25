import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import type { BindingId } from "../frontend/module-graph-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { alignBlockIndexStorage } from "./block-index-alignment.js";
import { buildSemanticProgram } from "./lower.js";
import type { SemanticFunction, SemanticGlobal, SemanticOperation, ValueId } from "./operations.js";

/** Lower one real source file without host I/O or generated output. */
function lowerSource(text: string) {
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "block-index-alignment",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: source.sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  };
  const analyzed = analyzeProject(snapshot);
  if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
  return buildSemanticProgram(analyzed);
}

/** Find one module object by source name in a completed semantic program. */
function globalNamed(globals: readonly SemanticGlobal[], name: string): SemanticGlobal {
  const global = globals.find((item) => item.name === name);
  if (global === undefined) throw new Error(`Missing global ${name}`);
  return global;
}

describe("block-index alignment inference", () => {
  it("strengthens a module buffer used with division", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("strengthens a module buffer used with a shift", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer >> 6)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("requires 256-byte alignment for hi times four", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, hi(&buffer) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });

  it("leaves a plain low-byte read unaligned", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toBeUndefined();
  });

  it("includes a constant element index in the effective offset", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void { poke($D018, lo(&blocks[1] / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toMatchObject({ align: 64 });
  });

  it("proves a 64-byte-stride runtime element aligned", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  poke($D018, lo(&blocks[index] / 64));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toMatchObject({ align: 64 });
  });

  it("leaves a byte-stride runtime element untouched", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[128];
function main(): void {
  let index: byte = peek($0400);
  poke($D018, lo(&buffer[index] / 64));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toBeUndefined();
  });

  it("accepts an aligned field offset", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte[64]; image: byte[64]; }
let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({ align: 64 });
  });

  it("preserves a field offset that root alignment cannot express", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toBeUndefined();
  });

  it("keeps an explicitly aligned address", () => {
    const lowered = lowerSource(
      `module Game;
place(at: $0B80) let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({
      at: 0x0b80,
      align: 1,
    });
  });

  it("preserves an explicitly misaligned address", () => {
    const lowered = lowerSource(
      `module Game;
place(at: $0B50) let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({
      at: 0x0b50,
      align: 1,
    });
  });

  it("recognizes the commuted hi times four expression", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, 4 * hi(&buffer)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });

  it("uses the explicit effective address for a nonzero field offset", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
place(at: $0B3F) let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({
      at: 0x0b3f,
      align: 1,
    });
  });

  it("does not treat a value-changing conversion as the full address", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, hi(word(byte(&buffer))) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toBeUndefined();
  });

  it("resolves converted constant divisors and indices", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  poke($D018, lo(&blocks[word(1)] / word(64)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toMatchObject({ align: 64 });
  });

  it("recognizes a commuted complete hi/lo selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, 4 * hi(&buffer) + (lo(&buffer) >> 6));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("requires only 64-byte alignment for a complete hi/lo selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, hi(&buffer) * 4 + (lo(&buffer) >> 6));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("recognizes a widening-wrapped complete selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, lo(word(hi(&buffer) * 4) + word(lo(&buffer) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("recognizes widening inside each complete-selector half", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, lo(word(hi(&buffer)) * 4 + (word(lo(&buffer)) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("aligns a field at a 64-byte offset through a complete selector", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte[64]; image: byte[64]; }
let frame: Frame;
function main(): void {
  poke($D018, lo(word(hi(&frame.image) * 4) + word(lo(&frame.image) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({ align: 64 });
  });

  it("uses the strongest demand across several uses", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); poke($D019, hi(&buffer) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });
});

/**
 * The region that keeps an object inside the chip's bank and clear of the window
 * where it reads character ROM instead of the RAM underneath.
 */
const VISIBLE_TO_THE_CHIP = "c64.vic.bank0-ram";

/** Resolve the placement a lowered program proved for one module object. */
function placementOf(source: string, name: string) {
  const lowered = lowerSource(source);
  expect(lowered.kind).toBe("complete");
  if (lowered.kind !== "complete") throw new Error("Expected a complete lowering");
  return globalNamed(lowered.program.globals, name).placement;
}

describe("block-index VIC visibility across a call", () => {
  // The baseline the cases below are measured against: the chip provably receives
  // the block number, so the compiler owes it a home the chip can actually fetch.
  it("demands visible storage for a block number published directly", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // Computing the block number in a helper and publishing the result is ordinary
  // style. A function boundary is not a reason for the sprite to vanish.
  it("follows a block number a helper hands back", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setSpritePointer(0, blockOf()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // One helper passing another helper's answer on is the same question asked
  // twice, so the proof resumes at each call site rather than at the first.
  it("follows a block number through a second helper", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function inner(): byte { return lo(&buffer / 64); }
function outer(): byte { return inner(); }
function main(): void { c64.vic.setSpritePointer(0, outer()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // The caller may name the returned value before publishing it, which puts a
  // store and a load between the return and the chip.
  it("follows a returned block number held in a local first", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { let block: byte = blockOf(); c64.vic.setSpritePointer(0, block); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // One hardware call site is enough, and the other caller is not a reason to
  // decide otherwise: a sprite the chip cannot see is wrong on the frames the
  // hardware path runs. The reverse is the cheaper direction to be wrong in,
  // though it is not free — an object larger than the visible interval has no
  // home that satisfies the demand, so an unnecessary one can cost a build.
  it("demands visible storage when any call site publishes to the chip", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { poke($C000, blockOf()); c64.vic.setSpritePointer(0, blockOf()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // Choosing the block number on one path of a conditional is ordinary modern
  // code. The chip receives this address whenever that path runs, and a sprite
  // the chip cannot see on some frames is still a sprite it cannot see.
  it("follows a block number chosen on one path of a conditional", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function main(): void {
  c64.vic.setSpritePointer(0, peek($0400) == 0 ? lo(&buffer / 64) : 0);
}`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // The same join, reached through a helper on both paths.
  it("follows a conditional between two helper results", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function relay(): byte { return peek($0400) == 0 ? blockOf() : 0; }
function main(): void { c64.vic.setSpritePointer(0, relay()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  // Writing a colour does not make the chip read the object whose address was
  // divided to produce the number. Demanding chip-visible storage for it narrows
  // storage the chip never looks at — and for an object larger than the visible
  // interval there is then no legal home at all, so a demand stated here can
  // decide whether the program builds.
  it("leaves an object alone when the chip only receives a number from it", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setBorderColor(blockOf()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: null });
  });

  // The same call takes a sprite's index beside its block number, and only one
  // of the two says anything about where the chip reads.
  it("distinguishes the block argument from the sprite index beside it", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(lo(&buffer / 64), 128); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: null });
  });

  // Ordinary address arithmetic keeps its home. Narrowing it because of how the
  // author divided a number would be a new restriction on ordinary code, and a
  // helper in the middle does not change that.
  it("leaves a returned block number alone when no hardware consumer receives it", () => {
    expect(
      placementOf(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { poke($C000, blockOf()); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64, region: null });
  });
});

/**
 * Two facts about the walk that no source program can express.
 *
 * A value identity is unique only inside the body that defines it, and a call
 * cycle is refused before lowering, so both shapes reach the pass only from
 * inside the compiler. Both are built here directly, because being wrong about
 * either returns the same answer — that nothing reaches the chip — and that
 * answer is the one that leaves a sprite reading character ROM.
 */

/** Position every synthetic operation shares; this pass never reads a span. */
const anywhere: SourceSpan = { sourceId: "src/game.blend", start: 0, end: 1 };

/** One synthetic declaration identity, distinguished only by where it starts. */
function identity(start: number): BindingId {
  return {
    sourceId: "src/game.blend",
    span: { sourceId: "src/game.blend", start, end: start + 1 },
  };
}

const bufferType: SemanticType = {
  kind: "array",
  element: { kind: "scalar", name: "byte" },
  length: 64,
  size: 64,
};
const word: SemanticType = { kind: "scalar", name: "word" };
const byte: SemanticType = { kind: "scalar", name: "byte" };
const wordFacts = { width: 16, signed: false, wrap: true } as const;
const byteFacts = { width: 8, signed: false, wrap: true } as const;
const bufferIdentity = identity(10);

/** A 64-byte module array with no stated placement, which the pass may strengthen. */
const syntheticBuffer: SemanticGlobal = {
  id: bufferIdentity,
  name: "buffer",
  storage: "module",
  type: bufferType,
  initialBytes: null,
  runtimeInitialBytes: null,
  entry: null,
  blocks: [],
  source: anywhere,
};

/** The four operations that divide the buffer's address into a block number. */
function blockNumber(prefix: string): readonly SemanticOperation[] {
  return [
    {
      kind: "place-address",
      result: `${prefix}0`,
      place: { root: bufferIdentity, rootType: bufferType, path: [] },
      type: word,
      integer: wordFacts,
      span: anywhere,
    },
    {
      kind: "constant",
      result: `${prefix}1`,
      value: 64n,
      type: word,
      integer: wordFacts,
      span: anywhere,
    },
    {
      kind: "binary",
      result: `${prefix}2`,
      operator: "/",
      left: `${prefix}0`,
      right: `${prefix}1`,
      type: word,
      integer: wordFacts,
      span: anywhere,
    },
    {
      kind: "unary",
      result: `${prefix}3`,
      operator: "lo",
      operand: `${prefix}2`,
      type: byte,
      integer: byteFacts,
      span: anywhere,
    },
  ];
}

/** Call one function and keep its result. */
function callOf(callee: BindingId, result: ValueId): SemanticOperation {
  return { kind: "call", result, callee, arguments: [], type: byte, span: anywhere };
}

/** Hand one value to the video chip as a sprite block number. */
function publish(block: ValueId, slot: ValueId): readonly SemanticOperation[] {
  return [
    { kind: "constant", result: slot, value: 0n, type: byte, integer: byteFacts, span: anywhere },
    {
      kind: "platform",
      result: null,
      capability: "c64.vic.setSpritePointer",
      arguments: [slot, block],
      type: { kind: "scalar", name: "void" },
      effect: "volatile-write",
      span: anywhere,
    },
  ];
}

/** One single-block function body that returns the named value. */
function syntheticFunction(
  id: BindingId,
  operations: readonly SemanticOperation[],
  returned: ValueId | null,
): SemanticFunction {
  return syntheticBody(id, [{ operations, returned }]);
}

/** One function body whose blocks each end in their own return. */
function syntheticBody(
  id: BindingId,
  paths: readonly {
    readonly operations: readonly SemanticOperation[];
    readonly returned: ValueId | null;
  }[],
): SemanticFunction {
  return {
    id,
    parameters: [],
    result: paths.every((path) => path.returned === null) ? { kind: "scalar", name: "void" } : byte,
    entry: "b0",
    blocks: paths.map((path, index) => ({
      id: `b${index}`,
      operations: path.operations,
      terminator: { kind: "return", value: path.returned },
    })),
    source: anywhere,
  };
}

describe("block-index VIC visibility on shapes only the compiler can build", () => {
  it("keeps each body's value identities apart", () => {
    // Every body here names its first value `v0`, which the operation contract
    // permits: identities are unique within a body, not across the program. A
    // walk that pooled them would stop at the second body and conclude that the
    // chip receives nothing.
    const compute = identity(20);
    const relay = identity(30);
    const main = identity(40);
    const aligned = alignBlockIndexStorage(
      [
        syntheticFunction(compute, blockNumber("v"), "v3"),
        syntheticFunction(relay, [callOf(compute, "v0")], "v0"),
        syntheticFunction(main, [callOf(relay, "v0"), ...publish("v0", "v1")], null),
      ],
      [syntheticBuffer],
    );

    expect(aligned[0]?.placement).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  it("answers a call cycle instead of following it forever", () => {
    // Direct and mutual recursion are refused before lowering, so this shape can
    // only arrive from inside the compiler. The proof still has to terminate: the
    // helper's answer does reach the chip through the entry's call site, and the
    // cycle between the two helpers must not be walked a second time.
    const compute = identity(20);
    const relay = identity(30);
    const main = identity(40);
    const aligned = alignBlockIndexStorage(
      [
        syntheticFunction(compute, [...blockNumber("v"), callOf(relay, "v4")], "v3"),
        syntheticFunction(relay, [callOf(compute, "r0")], "r0"),
        syntheticFunction(main, [callOf(relay, "m0"), ...publish("m0", "m1")], null),
      ],
      [syntheticBuffer],
    );

    expect(aligned[0]?.placement).toMatchObject({ align: 64, region: VISIBLE_TO_THE_CHIP });
  });

  it("stops walking a call cycle that publishes nothing", () => {
    // The case above succeeds before the cycle closes, because an answer of
    // `reaches the chip` is final the moment it is found. With nothing to find,
    // the walk has to exhaust the cycle instead: each helper hands the other's
    // answer back, so the value travels round the loop and arrives where it has
    // already been. Remembering that is the only reason this returns at all.
    const compute = identity(20);
    const relay = identity(30);
    const main = identity(40);
    const aligned = alignBlockIndexStorage(
      [
        syntheticBody(compute, [
          { operations: blockNumber("v"), returned: "v3" },
          { operations: [callOf(relay, "v4")], returned: "v4" },
        ]),
        syntheticFunction(relay, [callOf(compute, "r0")], "r0"),
        syntheticFunction(main, [callOf(relay, "m0")], null),
      ],
      [syntheticBuffer],
    );

    // The alignment the shape itself proves still applies; only visibility needs
    // a consumer, and no consumer is reachable here.
    expect(aligned[0]?.placement).toMatchObject({ align: 64, region: null });
  });
});
