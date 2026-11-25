import { describe, expect, it } from "vitest";
import type { BindingId } from "../frontend/module-graph-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { alignBlockIndexStorage } from "./block-index-alignment.js";
import { FIRST_SPRITE_BLOCK, provedDemands, provedFor } from "./block-index-test-support.js";
import type { SemanticFunction, SemanticGlobal, SemanticOperation, ValueId } from "./operations.js";

describe("block-index VIC visibility across a parameter", () => {
  // Handing the number to a function is ordinary composition, and the proof
  // continues at the callee's parameter: a value passed as one argument is read
  // where that parameter is read, which is the mirror of following a result
  // back to the call site that receives it.
  it("follows a block number into the parameter it was passed to", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function publish(block: byte): void { c64.vic.setSpritePointer(0, block); }
function main(): void { publish(lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The shape that made this matter: one publication straight into the chip and
  // a second through a helper. Both are measured, so the object only owes the
  // two blocks the chip reads — and both of them, since satisfying the first
  // says nothing about the second.
  it("measures each publication separately when one crosses a call", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[8192];
function publish(block: byte): void { c64.vic.setSpritePointer(1, block); }
function main(): void {
  c64.vic.setSpritePointer(0, lo(&sheet / 64));
  publish(lo(&sheet[4096] / 64));
}`,
        "sheet",
      ),
    ).toEqual({
      align: 64,
      fetched: [
        { offset: 0, bytes: 64 },
        { offset: 4096, bytes: 64 },
      ],
    });
  });

  // The sprite index sits beside the block number in the same call, so entering
  // the callee at the wrong parameter would prove something about a number that
  // decides nothing about placement.
  it("enters the callee at the argument position the number was passed in", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function publish(index: byte, block: byte): void { c64.vic.setSpritePointer(index, block); }
function main(): void { publish(0, lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // Arithmetic on the far side of the boundary names a block of this object just
  // as it does on the near side, so the selector's displacement has to cross
  // with it rather than restart.
  it("carries a displacement applied inside the callee", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[2][64];
function publish(block: byte): void { c64.vic.setSpritePointer(0, block + 1); }
function main(): void { publish(lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 64, bytes: 64 }] });
  });

  // A call made through an address names no function here, so the number is
  // beyond this walk and the honest answer is the one the proof gave before it
  // measured extents at all.
  it("demands the whole object when the number is an indirect call's argument", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function publish(block: byte): void { c64.vic.setSpritePointer(0, block); }
function main(): void { let p: fn(byte): void = &publish; p(lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 9000 }] });
  });

  // An array parameter is a borrow of the caller's object, so writing the number
  // through one puts it in storage whose reads are in a caller this walk is not
  // standing in.
  it("demands the whole object when the number is written through a borrow", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function fill(frames: byte[]): void { frames[0] = lo(&sheet / 64); }
function main(): void { let frames: byte[2]; fill(frames); c64.vic.setSpritePointer(0, frames[0]); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 9000 }] });
  });

  // Once the holding object's address exists, it can be read through that
  // address by an operation this walk does not recognize as a read, in a body it
  // never visits.
  it("demands the whole object when the number is held in an address-taken object", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function publish(frames: byte[]): void { c64.vic.setSpritePointer(0, frames[0]); }
function main(): void { let frames: byte[2]; frames[0] = lo(&sheet / 64); publish(frames); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 9000 }] });
  });

  // A function whose address is taken can be reached by any call accepting its
  // shape, and those calls are where its result arrives. Following them keeps
  // the demand to the block the chip reads.
  it("follows an address-taken function's result into a matching indirect call", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function blockOf(): byte { return lo(&sheet / 64); }
function main(): void { let producer: fn(): byte = &blockOf; c64.vic.setSpritePointer(0, producer()); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The same shape with nothing publishing the number owes nothing. Giving up on
  // the value here instead would state a demand no hardware asked for, and for
  // an object this size that demand has no home at all.
  it("states no demand when an address-taken function's result only reaches the processor", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function blockOf(): byte { return lo(&sheet / 64); }
function main(): void { let producer: fn(): byte = &blockOf; poke($C000, producer()); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Reassigning a scalar parameter writes the callee's own copy, not the
  // caller's object, so those reads are all here and the demand stays narrow.
  it("keeps a narrow demand when a scalar parameter is reassigned", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function publish(block: byte): void {
  block = lo(&sheet / 64);
  c64.vic.setSpritePointer(0, block);
}
function main(): void { publish(0); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // A module initializer is a body too, and the arithmetic in one proves the
  // same alignment. Visibility is a separate question here: the value is read in
  // another body, which this proof does not yet follow.
  it("proves alignment from arithmetic in a module initializer", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
let slot: byte = lo(&buffer / 64);
function main(): void { c64.vic.setSpritePointer(0, slot); }`,
        "buffer",
      ),
    ).toMatchObject({ align: 64 });
  });

  // Choosing the block number on one path of a conditional is ordinary modern
  // code. The chip receives this address whenever that path runs, and a sprite
  // the chip cannot see on some frames is still a sprite it cannot see.
  it("follows a block number chosen on one path of a conditional", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function main(): void {
  c64.vic.setSpritePointer(0, peek($0400) == 0 ? lo(&buffer / 64) : 0);
}`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The same join, reached through a helper on both paths.
  it("follows a conditional between two helper results", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function relay(): byte { return peek($0400) == 0 ? blockOf() : 0; }
function main(): void { c64.vic.setSpritePointer(0, relay()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // Writing a colour does not make the chip read the object whose address was
  // divided to produce the number. Demanding chip-visible storage for it narrows
  // storage the chip never looks at — and for an object larger than the visible
  // interval there is then no legal home at all, so a demand stated here can
  // decide whether the program builds.
  it("leaves an object alone when the chip only receives a number from it", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setBorderColor(blockOf()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // The same call takes a sprite's index beside its block number, and only one
  // of the two says anything about where the chip reads.
  it("distinguishes the block argument from the sprite index beside it", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(lo(&buffer / 64), 128); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Ordinary address arithmetic keeps its home. Narrowing it because of how the
  // author divided a number would be a new restriction on ordinary code, and a
  // helper in the middle does not change that.
  it("leaves a returned block number alone when no hardware consumer receives it", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { poke($C000, blockOf()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: null });
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

    expect(provedDemands(aligned[0])).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
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

    expect(provedDemands(aligned[0])).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
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
    expect(provedDemands(aligned[0])).toEqual({ align: 64, fetched: null });
  });
});
