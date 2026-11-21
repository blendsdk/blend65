import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/**
 * Non-regression controls for computing a whole-word assignment in place.
 *
 * The public oracle judges the emitted shape and the computed values. These cases cover what it
 * cannot: that a variable a loop advances is left alone, and that an ordinary variable updated
 * inside a loop is not. The first was learned by measurement — taking a loop counter made a
 * saved-input program grow from 701 bytes to 2,018, because the counter's own narrowing to a
 * single byte no longer applied. That program's size is pinned elsewhere and is the primary
 * guard; these cases pin the same decision on sources small enough to read.
 */

/** One counted loop whose index is a word, which is the shape another selection owns. */
const countedLoop = `module Game;
function main(): void {
  let rows: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i: word = 0; i < 8; i += 1) { rows[i] = peek($C110 + i); }
  poke($D000, rows[3]);
  while (true) { }
}
`;

/** The same nested, so an inner index is also set up from an outer one. */
const nestedCountedLoop = `module Game;
function main(): void {
  let rows: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let column: word = 0; column < 8; column += 1) {
    for (let other: word = column + 1; other < 8; other += 1) { rows[other] = peek($C110 + column); }
  }
  poke($D000, rows[3]);
  while (true) { }
}
`;

/** The memory-mapped register window; traffic with either end inside it is ordinary. */
const HARDWARE_FIRST = 0xd000;
const HARDWARE_LAST = 0xdfff;

/**
 * Adjacent load-then-store pairs that move one ordinary memory home into another.
 *
 * A move between two plain homes is the shape this work removes, so counting those is how the
 * decision becomes observable. Both the forced zero-page and the forced absolute spellings are
 * matched, because the serializer emits a width suffix whenever the mode and the address
 * disagree, and missing one would undercount silently.
 */
function memoryToMemoryMoves(assembly: string): readonly string[] {
  const lines = assembly.split("\n").map((line) => line.trim());
  const moves: string[] = [];
  for (const [index, line] of lines.entries()) {
    const load = /^lda(?:\+[12])? \$([0-9a-f]{2,4})$/u.exec(line);
    const store = /^sta(?:\+[12])? \$([0-9a-f]{2,4})$/u.exec(lines[index + 1] ?? "");
    if (load === null || store === null) continue;
    const [from, to] = [load[1]!, store[1]!];
    if (from === to) continue;
    const hardware = (address: string): boolean => {
      const value = Number.parseInt(address, 16);
      return value >= HARDWARE_FIRST && value <= HARDWARE_LAST;
    };
    if ([from, to].some(hardware)) continue;
    moves.push(`lda $${from} / sta $${to}`);
  }
  return moves;
}

describe("whole-word assignment forwarding", () => {
  it("should leave a counted loop's output exactly where it was", async () => {
    // Pinned rather than described: a variable the loop advances has a cheaper representation of
    // its own, and taking it here would both undo that and move these numbers. If a future
    // change starts taking loop indices, this fails with the size it moved to.
    const payloads = {
      none: (await buildProfileSource(countedLoop, target, "none")).prg.length - 2,
      size: (await buildProfileSource(countedLoop, target, "size")).prg.length - 2,
    };

    expect(payloads).toEqual({ none: 796, size: 751 });
  }, 180_000);

  it("should leave a nested counted loop's output exactly where it was", async () => {
    // An inner index initialised from an outer one is the case least like a loop update, so it
    // is the one most easily admitted by mistake. A counter is excluded wherever it is written,
    // because its narrowing needs one consistent representation across the whole loop.
    const payloads = {
      none: (await buildProfileSource(nestedCountedLoop, target, "none")).prg.length - 2,
      size: (await buildProfileSource(nestedCountedLoop, target, "size")).prg.length - 2,
    };

    expect(payloads).toEqual({ none: 869, size: 824 });
  }, 180_000);

  it("should still compute an ordinary position update in place", async () => {
    // The exclusion covers variables a loop advances, not every variable written inside one. A
    // position moved under a condition is exactly what this work improves, so it has to survive
    // — and in both directions, since the two branches lower separately.
    const moved = `module Game;
function main(): void {
  let x: word = 100;
  let rising: boolean = true;
  while (true) {
    while (peek($D012) != 251) { }
    if (rising) { x = x + 2; } else { x = x - 2; }
    if (x >= 296) { rising = false; }
    if (x <= 24) { rising = true; }
    poke($D000, lo(x));
    poke($D010, hi(x));
  }
}
`;
    const { assembly } = await buildProfileSource(moved, target, "none");

    // Five such moves were emitted before this work and none remain. Four were the two
    // assignments' pairs. The fifth staged the extracted high byte on its way to the hardware
    // write, which the high-byte extraction now delivers straight from the word's own home. The
    // count is pinned rather than the addresses, which move freely.
    expect(
      memoryToMemoryMoves(assembly).length,
      `arithmetic results are still being moved: ${memoryToMemoryMoves(assembly).join(", ")}`,
    ).toBe(0);
  }, 180_000);

  it("should compute a counter in place once no cheaper representation can claim it", async () => {
    // The exclusion protects counter narrowing, and narrowing only admits a loop whose exit test
    // compares against a literal of at most eight. Above that there is nothing left to protect,
    // so the counter keeps its declared word home either way and the copy through a scratch is
    // pure loss. Asserted as a move count rather than a size, because the addresses move freely.
    const released = `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 100; i += 1) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const built = await buildProfileSource(released, target, "none");

    expect(
      memoryToMemoryMoves(built.assembly),
      "a counter outside the narrowing range is still being moved through a scratch",
    ).toEqual([]);
    // Pinned as well as counted, so an unrelated regression cannot satisfy the count alone.
    expect(built.prg.length - 2).toBe(416);
  }, 180_000);

  it("should still protect a counter the narrowing range does admit", async () => {
    // The same shape at the threshold rather than above it. This is the direction that caused a
    // fixture to grow from 701 bytes to 2,018, so the two cases are kept side by side: releasing
    // the one above the range must not disturb the one inside it.
    const protected_ = `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 8; i += 1) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const built = await buildProfileSource(protected_, target, "none");

    expect(
      memoryToMemoryMoves(built.assembly).length,
      `the admitted counter lost its scratch: ${memoryToMemoryMoves(built.assembly).join(", ")}`,
    ).toBe(2);
    // Twelve bytes more than the released shape above, which is the saving this slice captures.
    expect(built.prg.length - 2).toBe(428);
  }, 180_000);

  it("should protect a counter shared by an admitted loop and a released one", async () => {
    // The combining rule is why evidence is collected per root rather than per loop: one
    // variable driving two loops has to obey the stricter of the two, because its
    // representation must hold for both. The small loop is what decides it.
    const shared = `module Game;
function main(): void {
  let acc: word = 0;
  let i: word = 0;
  for (i = 0; i < 100; i += 1) { acc = acc + 3; }
  for (i = 0; i < 4; i += 1) { acc = acc + 5; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const built = await buildProfileSource(shared, target, "none");

    expect(
      memoryToMemoryMoves(built.assembly).length,
      "a counter an admitted loop still claims was released by its larger loop",
    ).toBeGreaterThan(0);
  }, 180_000);

  it("should release a do-while counter once it is outside the narrowing range", async () => {
    // The other loop form, which places its exit test in the block carrying the backward branch
    // rather than the block jumped back to. Both have to reach the same decision.
    const latch = `module Game;
function main(): void {
  let acc: word = 0;
  let i: word = 0;
  do { acc = acc + 3; i = i + 1; } while (i < 100);
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const built = await buildProfileSource(latch, target, "none");

    expect(
      memoryToMemoryMoves(built.assembly),
      "a do-while counter outside the narrowing range is still being moved",
    ).toEqual([]);
  }, 180_000);

  it("should protect a counter whose bound it cannot read", async () => {
    // Narrowing reads a literal bound. A bound this walk cannot resolve to a literal proves
    // nothing about whether narrowing applies, so the root keeps its protection.
    const opaque = `module Game;
function main(): void {
  let acc: word = 0;
  let limit: word = peek($C100);
  for (let i: word = 0; i < limit; i += 1) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const built = await buildProfileSource(opaque, target, "none");

    expect(
      memoryToMemoryMoves(built.assembly).length,
      "a counter with an unreadable bound was released",
    ).toBeGreaterThan(0);
  }, 180_000);
});
