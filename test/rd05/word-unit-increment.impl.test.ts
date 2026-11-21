import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/**
 * Reduce the listing to its instruction stream alone.
 *
 * Comments, blank lines, assembler directives and labels are all dropped, because the increment
 * form deliberately spans a block boundary: the branch that skips the high byte is a terminator,
 * so a label necessarily sits between it and the instruction it skips. Reading adjacency over the
 * instructions alone is what lets the three-instruction shape be recognized at all.
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
 * Count the two ways a two-byte variable can be advanced by one.
 *
 * The general chain seeds a carry and adds an immediate one to each half in turn. The expert form
 * increments the low byte in place and touches the high byte only when the low one wrapped, which
 * the branch decides. Both are counted so a control can state which it expects rather than merely
 * asserting a size, and the increment pair is matched only when the second address is one above
 * the first, so an unrelated pair of increments cannot be mistaken for a word step.
 */
function unitStepForms(assembly: string): { readonly chains: number; readonly pairs: number } {
  const text = lines(assembly);
  let chains = 0;
  let pairs = 0;
  for (const [index, line] of text.entries()) {
    if (line === "clc" && /^adc #\$01$/i.test(text[index + 1] ?? "")) chains += 1;
    const low = operandOf(line, "inc");
    if (low === undefined) continue;
    if (!/^bne /i.test(text[index + 1] ?? "")) continue;
    if (operandOf(text[index + 2] ?? "", "inc") === low + 1) pairs += 1;
  }
  return { chains, pairs };
}

describe("word unit increment", () => {
  it("should advance a loop counter with the expert increment form", async () => {
    // The counter is above the range a cheaper representation could claim, so the earlier work
    // already advances it in place. What remains is the selection: a unit step of a two-byte
    // variable is an increment with a carry branch, not a full addition chain.
    const counted = `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 1000; i += 1) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(counted, target, "none");

    expect(unitStepForms(assembly), "the counter is still advanced by an addition chain").toEqual({
      chains: 0,
      pairs: 1,
    });
  }, 180_000);

  it("should keep the addition chain where the step is not the end of its block", async () => {
    // The increment form leaves the processor flags depending on whether the low byte wrapped,
    // which the addition chain never does. Admitting it therefore needs the flags to be dead, and
    // the proof used here is positional: the step must close its block, and that block must leave
    // by an unconditional edge. A step with ordinary work after it keeps the chain.
    const trailing = `module Game;
place(at: $C000) let sink: word;
function main(): void {
  let value: word = 1000;
  while (peek($D012) != 251) { }
  value = value + 1;
  sink = value;
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(trailing, target, "none");

    expect(
      unitStepForms(assembly),
      "a step with work after it was given the increment form anyway",
    ).toEqual({ chains: 1, pairs: 0 });
  }, 180_000);

  it("should leave a step by more than one alone", async () => {
    // Only a unit step is an increment. A larger constant keeps its low-byte addition, and
    // compacting its high half is a separate change with its own proof.
    const larger = `module Game;
function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 1000; i += 2) { acc = acc + 3; }
  poke($D000, lo(acc));
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(larger, target, "none");

    expect(unitStepForms(assembly).pairs, "a step by two was treated as an increment").toBe(0);
  }, 180_000);
});
