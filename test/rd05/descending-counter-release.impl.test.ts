import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** Reduce the listing to its instruction stream, so adjacency reads across block labels. */
function lines(assembly: string): readonly string[] {
  return assembly
    .split("\n")
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter(
      (line) =>
        line !== "" && !line.endsWith(":") && !line.startsWith("*") && !line.startsWith("!"),
    );
}

/**
 * Describe how a descending word counter's update is compiled.
 *
 * A counter the loop still protects keeps a narrower representation, so its update is computed in a
 * scratch pair and copied back: the full subtraction chain. A released counter is updated in place,
 * and a unit step in place is the processor's own decrement.
 *
 * Reported as both facts rather than one, because "has a decrement somewhere" and "has no
 * subtraction chain left" fail in different directions and a single verdict would hide which.
 */
function counterForm(assembly: string): { readonly decrements: number; readonly chains: number } {
  const text = lines(assembly);
  return {
    decrements: text.filter((line) => /^dec(\+[12])? \$/i.test(line)).length,
    chains: text.filter(
      (line, index) => line === "sec" && /^sbc #\$01$/i.test(text[index + 1] ?? ""),
    ).length,
  };
}

/**
 * Report whether a subtraction of the given constant writes back the address it read.
 *
 * For a step larger than one there is no decrement to look for: both the protected and the released
 * forms subtract an immediate. What separates them is where the result goes — a protected counter
 * copies through a scratch pair, so the store names a different address from the load, while a
 * released one writes the counter itself. Reading the two operands is therefore the only way to tell
 * these apart, and a size alone would not.
 */
function stepsInPlace(assembly: string, immediate: string): boolean {
  const text = lines(assembly);
  const address = (line: string | undefined): string | undefined =>
    /^(lda|sta)(\+[12])? \$([0-9a-f]+)$/i.exec(line ?? "")?.[3];
  return text.some((line, index) => {
    if (line !== "sec") return false;
    if (!new RegExp(`^sbc #\\$${immediate}$`, "i").test(text[index + 1] ?? "")) return false;
    const read = address(text[index - 1]);
    const wrote = address(text[index + 2]);
    return read !== undefined && read === wrote;
  });
}

/** The most common countdown idiom, parameterized by where it starts and how far it steps. */
const countdown = (from: string, step: string): string => `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = ${from}; i > 0; i -= ${step}) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;

describe("a descending word counter", () => {
  it("should step down in place with the expert decrement form", async () => {
    // The idiom this exists for. Previously the counter was excluded from in-place forwarding
    // because its test supplies no extent, so it kept a scratch pair and the full chain.
    const { assembly } = await buildProfileSource(countdown("1000", "1"), target, "none");

    expect(counterForm(assembly), "the countdown is still a subtraction chain").toEqual({
      decrements: 2,
      chains: 0,
    });
  }, 180_000);

  it("should reach the same form through a while loop", async () => {
    // The two loop forms place their exit test in different blocks, and the recognizer reads both.
    const source = `module Game;
function main(): void {
  let acc: word = 0;
  let i: word = 1000;
  while (i > 0) { acc = acc + 3; i = i - 1; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(source, target, "none");

    expect(counterForm(assembly).chains, "the while countdown kept its chain").toBe(0);
  }, 180_000);

  it("should still protect a small countdown, exactly as it protects a small count up", async () => {
    // What releases a counter is having no cheaper representation to lose. A countdown from five
    // is inside the bound a narrower representation admits, so it keeps its scratch — and it has
    // to, because that narrowing needs one consistent representation across the whole loop. The
    // asymmetry this change removes was in deriving the extent, not in what the extent then buys.
    const { assembly } = await buildProfileSource(countdown("5", "1"), target, "none");

    expect(counterForm(assembly).chains, "a small countdown was released").toBe(1);
  }, 180_000);

  it("should protect a counter that can also grow", async () => {
    // The extent comes from where the counter starts, and that bounds it only while it never
    // increases. A counter that is also added to somewhere can exceed its seed, so it is not
    // recognized at all and keeps its scratch. This is the soundness case: releasing it would
    // hand a narrowing decision an upper bound the counter can exceed.
    const source = `module Game;
function main(): void {
  let acc: word = 0;
  let i: word = 1000;
  while (i > 0) { acc = acc + 3; i = i - 1; if (acc > 60000) { i = i + 2; } }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(source, target, "none");

    expect(counterForm(assembly).chains, "a counter that can grow was released").toBeGreaterThan(0);
  }, 180_000);

  it("should release a countdown stepping by more than one when the step divides the seed", async () => {
    // A larger step keeps its low-byte subtraction and steps the high byte under a borrow test, so
    // the chain proper is still gone. Three divides 999, so the counter lands exactly on zero and
    // the seed really is an upper bound on its values.
    const { assembly } = await buildProfileSource(countdown("999", "3"), target, "none");

    expect(
      { inPlace: stepsInPlace(assembly, "03"), unitChains: counterForm(assembly).chains },
      "a countdown by three that lands on zero was not released",
    ).toEqual({ inPlace: true, unitChains: 0 });
  }, 180_000);

  it("should protect a countdown whose step steps over zero", async () => {
    // Word arithmetic wraps, so a step that does not divide the seed is not bounded by it: counting
    // down from 1000 by three reaches one, passes the test, and lands on 65534 — above the seed, and
    // a loop with no exit. Recording the seed as an extent there would be recording a false bound,
    // so the counter is not recognized and keeps its scratch.
    const { assembly } = await buildProfileSource(countdown("1000", "3"), target, "none");

    expect(stepsInPlace(assembly, "03"), "a step that misses zero was released").toBe(false);
  }, 180_000);

  it("should leave a count up exactly where it was", async () => {
    // The ascending path is untouched by this change, and its own exact-byte controls pin that.
    // Asserted here too, because the recognizer runs on the same walk.
    const source = `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 1000; i += 1) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const { prg } = await buildProfileSource(source, target, "none");

    expect(prg.length - 2, "the ascending counter moved").toBe(404);
  }, 180_000);
});
