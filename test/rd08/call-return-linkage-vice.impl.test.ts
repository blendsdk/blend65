import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { globalAddress, labelAddresses } from "./emitted-routine-support.js";

/** The one selected target this behavior oracle runs on. */
const target = "c64-pal-prg-kernal-6581";

/**
 * One program exercising every call-and-return linkage this oracle covers.
 *
 * Each function has the shape its construction applies to, and `main` drives
 * them with inputs chosen to tell a correct result from a plausible wrong one:
 *
 * - `touch` ends by calling `child`, so its call becomes a jump. It runs 300
 *   times from a loop: a transfer that left its return address behind would
 *   lose two stack bytes per trip and overflow the stack long before the end,
 *   and one that returned to the wrong place would not finish the loop.
 * - `calculate` falls into the multiply helper; 13 * 17 is 221, which a
 *   result taken from the wrong register or the helper's scratch would miss.
 * - `outer` returns the low byte of a word callee's result through a jump. The
 *   callee's word passes 255 to 256 on the way, so the byte delivered is 0
 *   after the third call and 1 after the fourth, never the high byte.
 * - `drop` discards a byte callee's result through a jump; only the callee's
 *   effect on `ticks` remains.
 * - `next` returns a word in A and X without storing its high byte. Its
 *   results for $12FF and $FFFF need the carry into the high byte and the
 *   wrap past it.
 */
const source = `module Game;
let total: word = 0;
let counter: word = 253;
let ticks: byte = 0;
let product: byte = 0;
let lows: byte[4] = [;0];
let words: word[2] = [;0];
function child(): void { total += 1; }
function touch(): void { child(); }
function calculate(a: byte, b: byte): byte { return a * b; }
function bump(): word { counter += 1; return counter; }
function outer(): byte { return byte(bump()); }
function tick(): byte { ticks += 1; return ticks; }
function drop(): void { tick(); }
function next(value: word): word { return value + 1; }
function main(): void {
  for (let k: word = 0; k < 300; k += 1) { touch(); }
  product = calculate(13, 17);
  for (let i: word = 0; i < 4; i += 1) { lows[i] = outer(); }
  drop();
  drop();
  words[0] = next($12FF);
  words[1] = next($FFFF);
}
`;

/** Resolve the address the program returns to once its own code has finished. */
function programReturnAddress(labels: string): number {
  const suffix = Buffer.from("startup.restore").toString("hex");
  const pattern = new RegExp(`^b65_[A-Za-z0-9_]+_${suffix}$`, "u");
  const addresses = new Set(
    [...labelAddresses(labels)]
      .filter(([label]) => pattern.test(label))
      .map(([, address]) => address),
  );
  expect([...addresses], "program return address").toHaveLength(1);
  return [...addresses][0]!;
}

/** The entry address of a source function: the lowest label it owns. */
function functionEntry(labels: string, name: string): number {
  const owned = [...labelAddresses(labels)]
    .filter(([label]) => label.startsWith(`b65_Game_${name}_`))
    .map(([, address]) => address);
  expect(owned.length, `labels of ${name}`).toBeGreaterThan(0);
  return Math.min(...owned);
}

/** The emitted text of one routine, up to the next routine or the end. */
function routineText(assembly: string, name: string): string {
  const start = assembly.indexOf(`; routine "Game.${name}"`);
  expect(start, `routine ${name}`).toBeGreaterThanOrEqual(0);
  const next = assembly.indexOf("; routine ", start + 1);
  return assembly.slice(start, next < 0 ? undefined : next);
}

// Serialized: a second emulator instance may not run alongside this one.
describe.sequential("call and return linkage computes what the source says", () => {
  it("delivers every result and leaves the stack where the program found it", async () => {
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "balanced" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete build");
      const artifacts = await readProfileArtifacts(built);

      // The constructions under test, confirmed before anything is executed:
      // a program that kept its calls would compute the same values, and this
      // oracle would then pass while testing none of them.
      for (const name of ["touch", "outer", "drop"]) {
        const text = routineText(artifacts.assembly, name);
        expect(text, `${name} makes no call:\n${text}`).not.toMatch(/^\s+jsr/mu);
        expect(text, `${name} leaves by a jump:\n${text}`).toMatch(/^\s+jmp\S*\s+b65_Game_/mu);
      }
      const calculate = routineText(artifacts.assembly, "calculate");
      expect(calculate, `calculate makes no call:\n${calculate}`).not.toMatch(/^\s+jsr/mu);
      // Only `next`'s own body: the startup restoration may be placed right after it.
      const nextText = routineText(artifacts.assembly, "next");
      const next = nextText.slice(0, nextText.search(/^\s+rts\s*$/mu));
      expect(next, `next stores only its low byte:\n${nextText}`).toMatch(/^\s+tax\s*$/mu);
      expect([...next.matchAll(/^\s+sta\b/gmu)], `next stores once:\n${nextText}`).toHaveLength(1);

      const labels = labelAddresses(artifacts.labels);
      const mainEntry = functionEntry(artifacts.labels, "main");
      const returnAddress = programReturnAddress(artifacts.labels);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const read = async (address: number, length: number) => [
        ...(await started.monitor.readMemory(address, address + length - 1)),
      ];
      try {
        await started.monitor.setExecuteCheckpoint(mainEntry);
        const entered = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await entered).toBe(mainEntry);
        const entry = await started.monitor.readCpuRegisters();

        await started.monitor.setExecuteCheckpoint(returnAddress);
        const finished = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await finished).toBe(returnAddress);
        const exit = await started.monitor.readCpuRegisters();
        expect(exit.sp, "stack pointer back where main found it").toBe(entry.sp);

        expect(await read(globalAddress(labels, "total"), 2), "touch").toEqual([
          300 & 0xff,
          300 >> 8,
        ]);
        expect(await read(globalAddress(labels, "product"), 1), "calculate").toEqual([221]);
        expect(await read(globalAddress(labels, "lows"), 4), "outer").toEqual([254, 255, 0, 1]);
        expect(await read(globalAddress(labels, "counter"), 2), "bump").toEqual([1, 1]);
        expect(await read(globalAddress(labels, "ticks"), 1), "drop").toEqual([2]);
        expect(await read(globalAddress(labels, "words"), 4), "next").toEqual([
          0x00, 0x13, 0x00, 0x00,
        ]);
      } finally {
        await stopVice(started);
      }
    });
  }, 180_000);
  it("keeps the three shapes a review found the first form got wrong", async () => {
    // An anonymous aggregate passed by address must keep every byte it stores;
    // two functions sharing one multiply helper must both still reach it; and a
    // wrapper ending in a call through a function value must keep that call.
    const audited = `module Game;
place(at: $3300) let inputs: byte[3] = [7, 9, 0];
let picked: byte = 0;
let p: byte = 0;
let q: byte = 0;
let total: byte = 0;
function second(values: byte[2]): byte { return values[1]; }
function f(a: byte, b: byte): byte { return a * b; }
function g(a: byte, b: byte): byte { return a * b; }
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function wrap(): byte {
  let hook: fn(): byte = &chosen;
  if (peek($3302) == 1) { hook = &other; }
  return hook();
}
function main(): void {
  picked = second([peek($3300), peek($3301)]);
  p = f(3, 4);
  q = g(5, 6);
  total = wrap() + 3;
}
`;
    await withProfileProject(audited, target, async (project) => {
      const built = await buildProject({ project, optimization: "balanced" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete build");
      const artifacts = await readProfileArtifacts(built);
      const labels = labelAddresses(artifacts.labels);
      const returnAddress = programReturnAddress(artifacts.labels);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        await started.monitor.setExecuteCheckpoint(returnAddress);
        const finished = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await finished).toBe(returnAddress);
        const byte = async (name: string) =>
          (
            await started.monitor.readMemory(
              globalAddress(labels, name),
              globalAddress(labels, name),
            )
          )[0];
        expect(await byte("picked"), "the second element of the passed aggregate").toBe(9);
        expect(await byte("p"), "f through the shared helper").toBe(12);
        expect(await byte("q"), "g through the shared helper").toBe(30);
        expect(await byte("total"), "the dispatched call plus three").toBe(40);
      } finally {
        await stopVice(started);
      }
    });
  }, 180_000);
});
