import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** Reduce the listing to its instruction stream, so adjacency can be read across block labels. */
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
 * Describe how a two-byte variable is stepped by a constant larger than one.
 *
 * Both halves of the general chain do real arithmetic: the low byte is added to or subtracted
 * from, and so is the high byte, with the carry threaded between them. The selected form keeps the
 * low byte's arithmetic — a constant above one cannot be an increment — and replaces the high
 * byte's with a single conditional step, because adding a byte-sized constant can only ever move
 * the high byte by one.
 *
 * Reported as the two shapes, so a control can say which it expects rather than only asserting a
 * size. The conditional form is matched only when the high byte named is one above the low byte the
 * arithmetic wrote, which is what separates a genuine word step from an unrelated neighbour.
 */
function constantStepForms(
  assembly: string,
  amount: string,
): { readonly chains: number; readonly conditional: number } {
  const text = lines(assembly);
  const operand = (line: string, opcode: string): number | undefined => {
    const hex = new RegExp(`^${opcode}(?:\\+[12])? \\$([0-9a-f]+)$`, "i").exec(line)?.[1];
    return hex === undefined ? undefined : Number.parseInt(hex, 16);
  };
  let chains = 0;
  let conditional = 0;
  for (const [index, line] of text.entries()) {
    if (!/^(clc|sec)$/.test(line)) continue;
    if (!new RegExp(`^(adc|sbc) #\\$${amount}$`, "i").test(text[index + 1] ?? "")) continue;
    // The high half either does its own arithmetic, which is the chain, or is stepped under a
    // carry test, which is the selected form.
    const written = operand(text[index + 2] ?? "", "sta");
    if (written === undefined) continue;
    const branch = text[index + 3] ?? "";
    if (/^(bcc|bcs) /i.test(branch)) {
      const stepped = text
        .slice(index + 4, index + 6)
        .find((candidate) => /^(inc|dec) /i.test(candidate));
      if (stepped !== undefined && operand(stepped, "(?:inc|dec)") === written + 1)
        conditional += 1;
      continue;
    }
    if (/^(adc|sbc) #\$00$/i.test(text[index + 4] ?? "")) chains += 1;
  }
  return { chains, conditional };
}

/** A position moved either way under a condition, so each arm closes its own block. */
const bidirectional = (step: string): string => `module Game;
function main(): void {
  let x: word = 1000;
  let rising: boolean = true;
  while (true) {
    while (peek($D012) != 251) { }
    if (rising) { x = x + ${step}; } else { x = x - ${step}; }
    if (x >= 2960) { rising = false; }
    if (x <= 240) { rising = true; }
    poke($D000, lo(x));
    poke($D010, hi(x));
  }
}
`;

describe("word constant step above one", () => {
  it("should step the high byte conditionally instead of adding to it", async () => {
    const { assembly } = await buildProfileSource(bidirectional("3"), target, "none");

    expect(
      constantStepForms(assembly, "03"),
      "a step by three still threads the carry into a second addition",
    ).toEqual({ chains: 0, conditional: 2 });
  }, 180_000);

  it("should test the carry the low byte's own arithmetic produced", async () => {
    // The form is only correct if the branch reads the carry out of the low half, and in the right
    // sense: skip the high step when an addition did not carry, or when a subtraction did not
    // borrow. The opposite sense would move the high byte on two hundred and fifty-five steps in
    // every two hundred and fifty-six instead of one.
    const text = lines((await buildProfileSource(bidirectional("3"), target, "none")).assembly);
    const senses = text.flatMap((line, index) =>
      /^(clc|sec)$/.test(line) && /^(adc|sbc) #\$03$/i.test(text[index + 1] ?? "")
        ? [`${line}/${text[index + 3]?.split(" ")[0] ?? "?"}`]
        : [],
    );

    expect([...senses].sort()).toEqual(["clc/bcc", "sec/bcs"]);
  }, 180_000);

  it("should keep the whole chain where the step is not the end of its block", async () => {
    const trailing = `module Game;
place(at: $C000) let sink: word;
function main(): void {
  let value: word = 1000;
  while (peek($D012) != 251) { }
  value = value + 3;
  sink = value;
  while (true) { }
}
`;
    const { assembly } = await buildProfileSource(trailing, target, "none");

    expect(
      constantStepForms(assembly, "03"),
      "a step with work after it was given the conditional form anyway",
    ).toEqual({ chains: 1, conditional: 0 });
  }, 180_000);

  it("should leave a step wider than one byte alone", async () => {
    // A constant above a byte can move the high byte by more than one, so the conditional step
    // cannot express it and the whole chain has to remain.
    const { assembly } = await buildProfileSource(bidirectional("257"), target, "none");

    expect(constantStepForms(assembly, "01").conditional, "a word-wide step was compacted").toBe(0);
  }, 180_000);
});
