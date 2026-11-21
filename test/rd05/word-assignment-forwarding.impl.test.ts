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

    // Five such moves were emitted before this work and one remains. The four that went are the
    // two assignments' pairs; the survivor stages the high byte for the hardware write, which is
    // a separate concern. The count is pinned rather than the addresses, which move freely.
    expect(
      memoryToMemoryMoves(assembly).length,
      `arithmetic results are still being moved: ${memoryToMemoryMoves(assembly).join(", ")}`,
    ).toBe(1);
  }, 180_000);
});
