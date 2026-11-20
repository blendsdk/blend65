import type { OptimizationGoal } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { assembleFor, candidateComparison, indirectTransfer } from "./dispatch-shape-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must not change which dispatch shape a program receives. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/**
 * The public oracle for this behavior can only judge whether a program is accepted. These cases
 * cover what it cannot express: the shape the accepted program is given, and the fact that a
 * dispatch whose candidates never return is lowered the same way whichever route it takes.
 */

/** Whether a candidate reaches its own end or loops forever instead. */
type Candidate = "returns" | "loops forever";

/** The body of one candidate, written so it either reaches its end or never does. */
function candidateBody(candidate: Candidate, mark: number): string {
  return candidate === "returns" ? `poke($C200, ${mark});` : "while (true) { }";
}

/**
 * Two candidates, a pointer that may hold either, a call through it, and then arithmetic whose
 * `adc` consumes processor state the call leaves behind. The arithmetic is what makes the state
 * after the call observable at all.
 */
function dispatchSource(first: Candidate, second: Candidate): string {
  return `module Game;
function firstTarget(): void { ${candidateBody(first, 1)} }
function secondTarget(): void { ${candidateBody(second, 2)} }
function main(): void {
  let hook: fn(): void = &firstTarget;
  if (peek($C000) == 1) { hook = &secondTarget; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`;
}

/** Build one program for this suite's profile and return its assembly. */
async function assemblyOf(source: string, mode: OptimizationGoal): Promise<string> {
  return await assembleFor(source, target, mode);
}

/**
 * The instruction lines of the block that performs the call, from its `jsr` into the dispatch
 * thunk up to the next label. A block whose execution never comes back owns no exit, so there
 * must be nothing between that `jsr` and the label which follows it.
 */
function linesAfterThunkCall(assembly: string): readonly string[] {
  const lines = assembly.split("\n").map((line) => line.trim());
  // Emitted labels are encoded, so the thunk is found by its body — the indirect jump that is
  // the whole block — and then named by the label immediately above it.
  const transfer = lines.findIndex((line) => indirectTransfer.test(line));
  expect(transfer, "the program must contain an indirect transfer").toBeGreaterThan(0);
  const labels = lines.slice(0, transfer).filter((line) => line.endsWith(":"));
  const thunk = labels[labels.length - 1]?.slice(0, -1) ?? "";
  expect(thunk, "the indirect transfer must sit in a labelled block").not.toBe("");

  const call = lines.findIndex((line) => new RegExp(`^jsr(\\+\\d+)?\\s+${thunk}$`, "u").test(line));
  expect(call, "the program must call the dispatch thunk").toBeGreaterThanOrEqual(0);
  const rest = lines.slice(call + 1);
  const nextLabel = rest.findIndex((line) => line.endsWith(":"));
  return (nextLabel === -1 ? rest : rest.slice(0, nextLabel)).filter(
    // An assembler origin directive records where the next block starts; it is placement, not
    // an executed instruction, so it does not count as an exit from this block.
    (line) => line.length > 0 && !line.startsWith("*") && !line.startsWith(";"),
  );
}

const candidateProfiles: readonly (readonly [Candidate, Candidate])[] = [
  ["loops forever", "loops forever"],
  ["returns", "returns"],
  ["returns", "loops forever"],
  ["loops forever", "returns"],
];

describe.each(modes)("the shape of a never-returning pointer dispatch in mode %s", (mode) => {
  it("should end the calling block at the jsr, inventing no edge it cannot take", async () => {
    const assembly = await assemblyOf(dispatchSource("loops forever", "loops forever"), mode);

    expect(
      linesAfterThunkCall(assembly),
      "a block whose dispatch never returns must not be given an exit instruction",
    ).toEqual([]);
  });

  it("should keep the cheap indirect transfer when no candidate returns", async () => {
    const assembly = await assemblyOf(dispatchSource("loops forever", "loops forever"), mode);

    // Accepting this program by abandoning the pointer jump for a chain of address comparisons
    // would cost two compares and two branches per candidate and grow with the candidate count.
    expect(assembly, "the cheap pointer dispatch must survive").toMatch(indirectTransfer);
    expect(assembly, "a published program must not compare candidate addresses").not.toMatch(
      candidateComparison,
    );
  });

  it("should keep emitting the unreachable work written after such a call", async () => {
    const assembly = await assemblyOf(dispatchSource("loops forever", "loops forever"), mode);

    // The statements after the call cannot run, but they are legal source and the comparison
    // chain already emits them. Dropping them here would make the two routes disagree.
    expect(assembly, "the arithmetic written after the call must still be lowered").toMatch(
      /^\s*adc\s+/imu,
    );
  });

  it.each(candidateProfiles)(
    "should match the block's exit to whether a first candidate that %s and a second that %s can return",
    async (first, second) => {
      const expectsExit = !(first === "loops forever" && second === "loops forever");
      const after = linesAfterThunkCall(await assemblyOf(dispatchSource(first, second), mode));

      if (expectsExit) {
        expect(
          after.length,
          "a dispatch that may return must leave the block an ordinary exit",
        ).toBeGreaterThan(0);
      } else {
        expect(after, "a dispatch that cannot return must leave no exit").toEqual([]);
      }
    },
  );
});

describe("a never-returning dispatch is lowered consistently across both routes", () => {
  // The two routes are chosen by argument count, which is incidental detail of the call. The
  // defect this covers was that the count decided whether the program was accepted at all.
  const withArgument = `module Game;
function firstTarget(n: byte): void { while (true) { } }
function secondTarget(n: byte): void { while (true) { } }
function main(): void {
  let hook: fn(byte): void = &firstTarget;
  if (peek($C000) == 1) { hook = &secondTarget; }
  hook(7);
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`;

  it("should take the comparison chain when the call passes an argument", async () => {
    const assembly = await assemblyOf(withArgument, "none");

    // An argument rules the thunk out, so this program legitimately compares candidates. It is
    // here to show the contrast is a route difference and not a difference in acceptance.
    expect(assembly, "a call with an argument takes the comparison chain").toMatch(
      candidateComparison,
    );
  });

  it("should accept both routes for the same never-returning candidates", async () => {
    const zeroArguments = await assemblyOf(
      dispatchSource("loops forever", "loops forever"),
      "none",
    );

    expect(zeroArguments, "the zero-argument program takes the thunk").toMatch(indirectTransfer);
    expect(await assemblyOf(withArgument, "none"), "the one-argument program is accepted").toMatch(
      candidateComparison,
    );
  });
});
