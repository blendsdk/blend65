import { describe, expect, it } from "vitest";
import { buildProfileSource } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/**
 * One extraction written straight to a fixed hardware address, in the shape the low-byte arm is
 * known to fire on: a named word advanced in a loop, with the extracted byte's only use being the
 * adjacent volatile write. Only the operator differs between the two builds.
 */
const extraction = (operator: "lo" | "hi"): string => `module Game; function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,${operator}(value));}
}`;

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
  const lines = assembly.split("\n").map((line) => line.split(";")[0]?.trim() ?? "");
  const operand = (line: string, opcode: string): string | undefined => {
    const match = new RegExp(`^${opcode}(?:\\+[12])? (\\$[0-9a-f]+)$`, "i").exec(line);
    return match?.[1];
  };
  const mentions = new Map<string, number>();
  for (const line of lines)
    for (const address of line.match(/\$[0-9a-f]+/gi) ?? [])
      mentions.set(address, (mentions.get(address) ?? 0) + 1);
  const found: string[] = [];
  for (const [index, line] of lines.entries()) {
    const stored = operand(line, "sta");
    if (stored === undefined || mentions.get(stored) !== 2) continue;
    if (operand(lines[index + 1] ?? "", "lda") === stored) found.push(stored);
  }
  return found;
}

describe("high-byte fixed-write forwarding", () => {
  it("should write an extracted high byte without staging it through a home", async () => {
    const built = await buildProfileSource(extraction("hi"), target, "none");

    expect(
      stagingHomes(built.assembly),
      "the extracted high byte is still staged through an anonymous home",
    ).toEqual([]);
    // The forwarded high-byte form is instruction-for-instruction the low-byte form with the other
    // byte of the same word loaded, so the two payloads have to agree exactly. Pinned as well as
    // described, because a move count alone could be satisfied by an unrelated change.
    expect(built.prg.length - 2).toBe(374);
  }, 180_000);

  it("should leave the low-byte form it is modelled on exactly where it was", async () => {
    const built = await buildProfileSource(extraction("lo"), target, "none");

    expect(stagingHomes(built.assembly)).toEqual([]);
    expect(built.prg.length - 2).toBe(374);
  }, 180_000);
});
