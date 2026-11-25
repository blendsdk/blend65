import { describe, expect, it } from "vitest";
import { FIRST_SPRITE_BLOCK, provedFor } from "./block-index-test-support.js";

describe("block-index VIC visibility across a call", () => {
  // The baseline the cases below are measured against: the chip provably receives
  // the block number, so the compiler owes it a home the chip can actually fetch.
  it("demands visible storage for a block number published directly", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // Computing the block number in a helper and publishing the result is ordinary
  // style. A function boundary is not a reason for the sprite to vanish.
  it("follows a block number a helper hands back", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setSpritePointer(0, blockOf()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // One helper passing another helper's answer on is the same question asked
  // twice, so the proof resumes at each call site rather than at the first.
  it("follows a block number through a second helper", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function inner(): byte { return lo(&buffer / 64); }
function outer(): byte { return inner(); }
function main(): void { c64.vic.setSpritePointer(0, outer()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The caller may name the returned value before publishing it, which puts a
  // store and a load between the return and the chip.
  it("follows a returned block number held in a local first", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { let block: byte = blockOf(); c64.vic.setSpritePointer(0, block); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // One hardware call site is enough, and the other caller is not a reason to
  // decide otherwise: a sprite the chip cannot see is wrong on the frames the
  // hardware path runs. The reverse is the cheaper direction to be wrong in,
  // though it is not free — an object larger than the visible interval has no
  // home that satisfies the demand, so an unnecessary one can cost a build.
  it("demands visible storage when any call site publishes to the chip", () => {
    expect(
      provedFor(
        `module Game;
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { poke($C000, blockOf()); c64.vic.setSpritePointer(0, blockOf()); }`,
        "buffer",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The chip fetches one sprite image. Nothing else in a 9,000-byte sheet is
  // read by the hardware, so the demand names those bytes rather than the
  // object: a sheet larger than the window the chip can reach still has a home.
  it("demands only the fetched bytes of a large object", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The addressed element decides which bytes are fetched, so the run sits where
  // the author pointed rather than at the object's first byte.
  it("demands the addressed element rather than the object's first block", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, lo(&sheet[4096] / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 4096, bytes: 64 }] });
  });

  // Two sprites published from one sheet are two runs the chip reads. Satisfying
  // one says nothing about the other, and the bytes between them are still
  // ordinary storage, so the gap is kept rather than filled in.
  it("accumulates a run for every published sprite", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void {
  c64.vic.setSpritePointer(0, lo(&sheet / 64));
  c64.vic.setSpritePointer(1, lo(&sheet[4096] / 64));
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

  // Runs that meet describe one longer run, which is worth saying once rather
  // than twice. Nothing about the requirement changes.
  it("merges two fetched runs that meet", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void {
  c64.vic.setSpritePointer(0, lo(&sheet / 64));
  c64.vic.setSpritePointer(1, lo(&sheet[64] / 64));
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 128 }] });
  });

  // An index read at run time proves alignment for every element and names
  // none of them, so the chip may fetch any one. Shrinking the run to the
  // element the static prefix happens to name would leave the rest where the
  // chip cannot see them, which is the one way this proof must not be wrong.
  it("widens the fetched run to the object when a runtime index selects the block", () => {
    expect(
      provedFor(
        `module Game;
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[index] / 64));
}`,
        "blocks",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 128 }] });
  });

  // An index choosing between two sheets names two blocks, not the sixteen
  // kilobytes between and around them. Demanding the whole root object here
  // would refuse a program whose two fetched runs fit the visible area easily.
  it("demands one run per element a runtime index can choose", () => {
    expect(
      provedFor(
        `module Game;
let sheets: byte[2][8192];
function main(): void {
  let which: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&sheets[which] / 64));
}`,
        "sheets",
      ),
    ).toEqual({
      align: 64,
      fetched: [
        { offset: 0, bytes: 64 },
        { offset: 8192, bytes: 64 },
      ],
    });
  });

  // When the elements are adjacent blocks the runs meet, so the same rule that
  // keeps two sheets apart collapses a block array into one span.
  it("collapses adjacent elements into one run", () => {
    expect(
      provedFor(
        `module Game;
let blocks: byte[3][64];
function main(): void {
  let which: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[which] / 64));
}`,
        "blocks",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 192 }] });
  });

  // Past the point where listing elements stops being cheaper than the span
  // they cover, the span is demanded instead. The answer is the same shape the
  // hardware needs; only the way of saying it changes.
  it("demands the whole object once the elements outnumber the bound", () => {
    expect(
      provedFor(
        `module Game;
let sheets: byte[128][128];
function main(): void {
  let which: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&sheets[which] / 64));
}`,
        "sheets",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 16384 }] });
  });

  // `hi(address / 64)` is a value in `0..3`. It selects a block in the first
  // 256 bytes of the bank, not one inside the object whose address produced it,
  // so following it would claim a provenance the number does not carry.
  it("drops provenance through an operator that changes the selector", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function blockOf(): byte { return hi(&sheet / 64); }
function main(): void { c64.vic.setSpritePointer(0, blockOf()); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Naming a later frame by adding to the base block number is how an author
  // avoids writing the byte offset out. The chip reads that frame, so the run
  // moves with it rather than disappearing.
  it("follows a constant displacement to the block it names", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, lo(&sheet / 64) + 1); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 64, bytes: 64 }] });
  });

  // Publishing the base and a displaced frame demands both runs. Satisfying one
  // says nothing about the other, and this is the shape where a demand covering
  // only the first leaves the second wherever the object happened to land.
  it("demands the base and the displaced run together", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[8192];
function main(): void {
  c64.vic.setSpritePointer(0, lo(&sheet / 64));
  c64.vic.setSpritePointer(1, lo(&sheet / 64) + 64);
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

  // A displacement past the object's own end names bytes belonging to whatever
  // is placed there, which this object cannot be asked to keep reachable.
  it("ignores a displacement that leaves the object", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[128];
function main(): void { c64.vic.setSpritePointer(0, lo(&sheet / 64) + 8); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // A displacement decided at run time names a block nothing here can identify,
  // so every block of the object has to be reachable.
  it("widens the demand when the displacement is read at run time", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[128];
function main(): void {
  let frame: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&sheet / 64) + frame);
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 128 }] });
  });

  // Complementing a block number names a different block, so the chip reading
  // through it never reads this object.
  it("drops provenance through a complemented selector", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, ~lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Complementing it twice restores the original number exactly, so the chip
  // does read this object after all. A walk that stopped at the first operator
  // it would not follow would never see the one that undoes it, and the sprite
  // would be left wherever the object happened to land.
  it("restores provenance when a complement is undone", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, ~(~lo(&sheet / 64))); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // The same, with the two operators separated by a helper boundary and a named
  // local, because the arithmetic has to travel with the value rather than with
  // the expression it was written in.
  it("restores provenance when the complement is undone across a call", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function inverted(): byte { return ~lo(&sheet / 64); }
function main(): void {
  let held: byte = inverted();
  c64.vic.setSpritePointer(0, ~held);
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // A complemented selector rises as the block number falls, so it names no
  // fixed part of this object however large the object is. Worth stating on one
  // big enough that the complement's own constant would land inside it: the
  // reason to refuse is the direction of the arithmetic, not the distance.
  it("drops provenance through a complement that lands inside the object", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[18000];
function main(): void { c64.vic.setSpritePointer(0, ~lo(&sheet / 64)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Complement, displace, complement again: the displacement survives the pair
  // but its sign does not, so this names the block one *before* the base, which
  // falls outside the object and demands nothing of it.
  it("tracks a displacement through a complemented pair", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, ~(~lo(&sheet / 64) + 1)); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Taking the high byte discards the selector rather than displacing or
  // negating it, and a second `hi` yields zero instead of the original, so
  // nothing downstream can bring it back.
  it("does not restore provenance through a second high-byte read", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, hi(word(hi(&sheet / 64)))); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // Multiplying a block number names an unrelated block, exactly as taking its
  // high byte does, so it carries no provenance either.
  it("drops provenance through a scaled selector", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void { c64.vic.setSpritePointer(0, lo(&sheet / 64) * 3); }`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // The chip receives the constant, so nothing about this object is fetched.
  // Only the reads between the two stores could have seen the block number.
  it("stops at a value this body provably replaces", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void {
  let block: byte = lo(&sheet / 64);
  poke($C000, block);
  block = 0;
  c64.vic.setSpritePointer(0, block);
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: null });
  });

  // A replacement reached on one path only replaces nothing: the other path
  // still hands the block number to the chip.
  it("keeps the demand when a replacement is conditional", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
function main(): void {
  let block: byte = lo(&sheet / 64);
  if (peek($0400) == 0) { block = 0; }
  c64.vic.setSpritePointer(0, block);
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: FIRST_SPRITE_BLOCK });
  });

  // A module variable is storage any other function and any interrupt can read,
  // and this proof follows neither. So the replacement is not trusted here, and
  // the demand covers the whole object rather than one block: a reader this
  // walk never visits could publish any block of it, and guessing otherwise is
  // what leaves a sprite unreadable.
  it("demands the whole object when the block number reaches module storage", () => {
    expect(
      provedFor(
        `module Game;
let sheet: byte[9000];
let slot: byte;
function main(): void {
  slot = lo(&sheet / 64);
  poke($C000, slot);
  slot = 0;
  c64.vic.setSpritePointer(0, slot);
}`,
        "sheet",
      ),
    ).toEqual({ align: 64, fetched: [{ offset: 0, bytes: 9000 }] });
  });
});
