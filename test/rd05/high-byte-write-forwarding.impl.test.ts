import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";
const OPTIMIZATIONS = ["none", "balanced", "speed", "size"] as const;
/** Sprite 1 Y position: an ordinary writable register, written once by this fixture. */
const ANCHOR = "$d005";

/**
 * One extraction written straight to a fixed hardware address, in the shape the low-byte arm is
 * known to fire on: a named word advanced in a loop, with the extracted byte's only use being the
 * adjacent volatile write. Only the operator differs between the two builds.
 */
const extraction = (operator: "lo" | "hi"): string => `module Game; function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,${operator}(value));}
}`;

/** Strip comments and labels so instruction adjacency can be read directly. */
function lines(assembly: string): readonly string[] {
  return assembly.split("\n").map((line) => line.split(";")[0]?.trim() ?? "");
}

/** Read an absolute operand off one instruction, ignoring the assembler's width suffix. */
function operandOf(line: string, opcode: string): string | undefined {
  return new RegExp(`^${opcode}(?:\\+[12])? (\\$[0-9a-f]+)$`, "i").exec(line)?.[1];
}

/**
 * Find every address that exists only to hold a value on its way back to the accumulator.
 *
 * This is the anonymous home the forwarding exists to remove: the accumulator already holds the
 * extracted byte, so storing and loading it back costs two absolute instructions and a byte of
 * resident RAM to arrive where it started. A staging home is recognized by being stored and
 * immediately reloaded *and* by appearing exactly twice in the whole listing — once written, once
 * read. A real variable's home is named more often than that, which is what keeps this from also
 * reporting an ordinary variable that happens to be read right after it is written. Reported as
 * the addresses themselves, so a failure names what survived.
 */
function stagingHomes(assembly: string): readonly string[] {
  const text = lines(assembly);
  const mentions = new Map<string, number>();
  for (const line of text)
    for (const address of line.match(/\$[0-9a-f]+/gi) ?? [])
      mentions.set(address, (mentions.get(address) ?? 0) + 1);
  const found: string[] = [];
  for (const [index, line] of text.entries()) {
    const stored = operandOf(line, "sta");
    if (stored === undefined || mentions.get(stored) !== 2) continue;
    if (operandOf(text[index + 1] ?? "", "lda") === stored) found.push(stored);
  }
  return found;
}

/**
 * Recover the address the fixed write is fed from.
 *
 * The write has to be immediately preceded by the load that supplies it, which is the whole point
 * of the forwarding; anything else is a failure rather than a value to report.
 */
function sourceOfFixedWrite(assembly: string): number {
  const text = lines(assembly);
  const writes = text.flatMap((line, index) => (operandOf(line, "sta") === ANCHOR ? [index] : []));
  expect(writes, "exactly one fixed write to the anchor").toHaveLength(1);
  const load = operandOf(text[writes[0]! - 1] ?? "", "lda");
  if (load === undefined)
    throw new Error("The fixed write is not immediately preceded by a direct load");
  return Number.parseInt(load.slice(1), 16);
}

describe("high-byte fixed-write forwarding", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`should write an extracted high byte without staging it, at ${optimization}`, async () => {
      const built = await buildProfileSource(extraction("hi"), target, optimization);

      expect(
        stagingHomes(built.assembly),
        "the extracted high byte is still staged through an anonymous home",
      ).toEqual([]);
      // The forwarded high-byte form is instruction-for-instruction the low-byte form with the
      // other byte of the same word loaded, so the two payloads have to agree exactly. Pinned as
      // well as described, because a move count alone could be satisfied by an unrelated change.
      expect(built.prg.length - 2).toBe(374);
    }, 180_000);
  }

  it("should leave the low-byte form it is modelled on exactly where it was", async () => {
    for (const optimization of OPTIMIZATIONS) {
      const built = await buildProfileSource(extraction("lo"), target, optimization);

      expect(stagingHomes(built.assembly)).toEqual([]);
      expect(built.prg.length - 2).toBe(374);
    }
  }, 180_000);

  it("should feed the write from the high half of the word, not the low one", async () => {
    // Everything above holds just as well of a forwarding that delivered the wrong half, because
    // the two forms differ by a single operand and nothing else — same instructions, same size.
    // The halves are told apart here by that operand alone: the high one has to sit one byte
    // further up the same word, so this fails if the wrong byte is ever delivered.
    const [high, low] = await Promise.all([
      buildProfileSource(extraction("hi"), target, "none"),
      buildProfileSource(extraction("lo"), target, "none"),
    ]);

    expect(
      sourceOfFixedWrite(high.assembly) - sourceOfFixedWrite(low.assembly),
      "the forwarded write is not fed from the word's high byte",
    ).toBe(1);
  }, 180_000);
});
