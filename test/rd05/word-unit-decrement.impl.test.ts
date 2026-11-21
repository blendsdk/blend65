import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/**
 * Reduce the listing to its instruction stream alone.
 *
 * The decrement form deliberately spans two block boundaries — the branch that skips the high byte
 * is a terminator, and the low byte's own decrement sits after the join both paths reach — so
 * labels necessarily appear inside the sequence. Reading adjacency over the instructions alone is
 * what lets the four-instruction shape be recognized at all.
 */
function lines(assembly: string): readonly string[] {
  return assembly
    .split("\n")
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter(
      (line) =>
        line !== "" && !line.endsWith(":") && !line.startsWith("*") && !line.startsWith("!"),
    );
}

/** Read an absolute operand off one instruction, ignoring the assembler's width suffix. */
function operandOf(line: string, opcode: string): number | undefined {
  const text = new RegExp(`^${opcode}(?:\\+[12])? \\$([0-9a-f]+)$`, "i").exec(line)?.[1];
  return text === undefined ? undefined : Number.parseInt(text, 16);
}

/**
 * Count the two ways a two-byte variable can be stepped down by one.
 *
 * The general chain seeds a borrow and subtracts an immediate one from each half in turn. The
 * expert form reads the low byte to test it, decrements the high byte only when that test showed
 * the low byte was about to borrow, and then decrements the low byte on the path both arms reach.
 *
 * The expert form is matched only when all four instructions name the right places: the test reads
 * the same address the final decrement writes, and the conditional decrement is one byte above it.
 * That is what distinguishes a genuine word step from an unrelated pair of decrements, and it is
 * also what would catch the halves being transposed.
 */
function unitStepForms(assembly: string): { readonly chains: number; readonly pairs: number } {
  const text = lines(assembly);
  let chains = 0;
  let pairs = 0;
  for (const [index, line] of text.entries()) {
    if (line === "sec" && /^sbc #\$01$/i.test(text[index + 1] ?? "")) chains += 1;
    const tested = operandOf(line, "lda");
    if (tested === undefined) continue;
    if (!/^bne /i.test(text[index + 1] ?? "")) continue;
    if (operandOf(text[index + 2] ?? "", "dec") !== tested + 1) continue;
    if (operandOf(text[index + 3] ?? "", "dec") !== tested) continue;
    pairs += 1;
  }
  return { chains, pairs };
}

/**
 * A position advanced one way or the other under a condition.
 *
 * This is the shape the step-down selection serves, and it is an ordinary game idiom rather than a
 * contrived fixture: each arm of the branch closes its own block by jumping to the join, which is
 * exactly the positional requirement the selection needs. A descending `for` or `while` counter is
 * deliberately *not* used, because such a counter is still excluded from in-place forwarding before
 * this selection ever sees it.
 */
const bidirectional = (step: string): string => `module Game;
function main(): void {
  let x: word = 100;
  let rising: boolean = true;
  while (true) {
    while (peek($D012) != 251) { }
    if (rising) { x = x + ${step}; } else { x = x - ${step}; }
    if (x >= 296) { rising = false; }
    if (x <= 24) { rising = true; }
    poke($D000, lo(x));
    poke($D010, hi(x));
  }
}
`;

describe("word unit decrement", () => {
  it("should step a position down with the expert decrement form", async () => {
    const { assembly } = await buildProfileSource(bidirectional("1"), target, "none");

    expect(unitStepForms(assembly), "the downward step is still a subtraction chain").toEqual({
      chains: 0,
      pairs: 1,
    });
  }, 180_000);

  it("should reach the low byte's decrement on both paths and the high byte's on neither else", async () => {
    // The form is only correct if the conditional arm is skipped exactly when the low byte was
    // nonzero, and the low decrement runs either way. Asserted on the emitted order rather than on
    // a count, because a count alone would also accept the two decrements being transposed, which
    // would borrow on every step instead of one in two hundred and fifty-six.
    // Anchored on the decrements themselves and then read backwards, so this does not simply
    // re-run the forward scan the other cases use.
    const text = lines((await buildProfileSource(bidirectional("1"), target, "none")).assembly);
    const decrements = text.flatMap((line, index) =>
      operandOf(line, "dec") === undefined ? [] : [index],
    );
    expect(decrements, "the step down should emit exactly two decrements").toHaveLength(2);
    const [high, low] = decrements as [number, number];

    expect({
      adjacent: low === high + 1,
      highIsOneAbove: operandOf(text[high]!, "dec")! === operandOf(text[low]!, "dec")! + 1,
      skippedByBranch: text[high - 1]!.startsWith("bne "),
      testedTheLowByte: operandOf(text[high - 2]!, "lda") === operandOf(text[low]!, "dec"),
    }).toEqual({
      adjacent: true,
      highIsOneAbove: true,
      skippedByBranch: true,
      testedTheLowByte: true,
    });
  }, 180_000);

  it("should keep the subtraction chain where the step is not the end of its block", async () => {
    // The form leaves the accumulator holding the low byte's old value and, going down, the flags
    // describing its new one. Admitting it therefore needs the step to close its block, and a step
    // with ordinary work after it keeps the chain.
    const trailing = `module Game;
place(at: $C000) let sink: word;
function main(): void {
  let value: word = 1000;
  while (peek($D012) != 251) { }
  value = value - 1;
  sink = value;
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(trailing, target, "none");

    expect(
      unitStepForms(assembly).pairs,
      "a step with work after it was given the decrement form anyway",
    ).toBe(0);
  }, 180_000);

  it("should keep the subtraction chain where the step's block does not leave unconditionally", async () => {
    // The second half of the positional proof, covered on its own: the step closes its block, but
    // the block returns rather than jumping onward.
    const returning = `module Game;
place(at: $C000) let sink: word;
function bump(i: word): void {
  poke($D020, lo(i));
  i = i - 1;
}
function main(): void {
  bump(1000);
  sink = 1;
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(returning, target, "none");

    expect(
      unitStepForms(assembly).pairs,
      "a step closing a block that returns was given the decrement form anyway",
    ).toBe(0);
  }, 180_000);

  it("should leave a step by more than one alone", async () => {
    // Only a unit step is a decrement. A larger constant keeps its low-byte subtraction and steps
    // its high byte under a borrow test instead, which is a different form with its own proof.
    const { assembly } = await buildProfileSource(bidirectional("2"), target, "none");

    expect(unitStepForms(assembly).pairs, "a step by two was treated as a decrement").toBe(0);
  }, 180_000);
});
