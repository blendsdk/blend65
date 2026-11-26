import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";

/** The one selected target these guard witnesses are built for. */
const target = "c64-pal-prg-kernal-6581";

/** The emitted text of one routine, up to the next routine or the end. */
function routineText(assembly: string, name: string): string {
  const start = assembly.indexOf(`; routine "Game.${name}"`);
  expect(start, `routine ${name}`).toBeGreaterThanOrEqual(0);
  const next = assembly.indexOf("; routine ", start + 1);
  return assembly.slice(start, next < 0 ? undefined : next);
}

/** Every operand stored to by an ordinary `sta` in one routine, in order. */
function storedOperands(text: string): string[] {
  return [...text.matchAll(/^\s+sta\S*\s+(.+?)\s*$/gmu)].map((match) => match[1]!);
}

describe("guards on reusing an index byte and forwarding a word update", () => {
  it("keeps separate index and value reads when an interrupt handler is installed", async () => {
    // A handler could write the counter between the two reads, so a single
    // read is no longer the same as two. The program must keep both loads.
    const source = `module Game;
import { setNMI, restoreNMI } from c64.system;
let data: byte[8];
let pulse: byte = 0;
interrupt function handler(): void { pulse = 1; }
function scan(seed: word): void { for (let i: word = seed; i < 8; i += 1) { data[i] = byte(i); } }
function main(): void { setNMI(&handler); scan(0); restoreNMI(); }
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const scan = routineText(artifacts.assembly, "scan");
    expect(scan, "no transfer of a single read into Y").not.toMatch(/^\s+tay\s*$/mu);
    expect(scan, "the index is loaded into Y on its own").toMatch(/^\s+ldy\s/mu);
  }, 180_000);

  it("stages a module word computed from a different module word", async () => {
    // Only the destination itself or a constant may feed a forwarded module
    // update; any other operand keeps the scratch copy.
    const source = `module Game;
let total: word = 0;
let other: word = 5;
function touch(): void { total = other + 1; }
function main(): void { touch(); }
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const touch = routineText(artifacts.assembly, "touch");
    // The startup restore block can follow the body in the same section; only
    // the stores before this routine's own return belong to the update.
    const stores = storedOperands(touch.slice(0, touch.search(/^\s+rts\s*$/mu)));
    expect(stores, "two scratch stores, then the two destination stores").toHaveLength(4);
    expect(stores.slice(2).every((operand) => operand.startsWith("b65_Game_total"))).toBe(true);
  }, 180_000);

  it("never steps a module word with an increment instruction", async () => {
    // An update that closes a loop body would select the in-place increment
    // for a private home. A module word keeps ordinary stores: an increment
    // writes the old value back first and writes the high byte only on carry.
    const source = `module Game;
let total: word = 0;
function main(): void {
  for (let k: byte = 0; k < 10; k += 1) { total += 1; }
}
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const main = routineText(artifacts.assembly, "main");
    expect(main, "no read-modify-write of the module word").not.toMatch(
      /^\s+(inc|dec)\S*\s+b65_Game_total/mu,
    );
    const totalStores = storedOperands(main).filter((operand) =>
      operand.startsWith("b65_Game_total"),
    );
    expect(totalStores, "both bytes stored once, low then high").toHaveLength(2);
    expect(totalStores[1], "high byte second").toMatch(/\+\s*\$0001$/u);
  }, 180_000);
});
