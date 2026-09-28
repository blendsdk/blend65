import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor, ViceCpuRegisters } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", 0, 0],
  ["c64-pal-prg-kernal-8580", 0, 1],
  ["c64-ntsc-prg-kernal-6581", 3, 0],
  ["c64-ntsc-prg-kernal-8580", 3, 1],
] as const;
type Profile = (typeof profiles)[number][0];
const pal: Profile = profiles[0][0];

/** One stopped VICE run with published entries, its original vector, and owned checkpoints. */
interface Machine {
  readonly monitor: ViceMonitor;
  readonly original: number;
  readonly entryCpu: ViceCpuRegisters;
  readonly restore: number;
  readonly callerReturn: number;
  readonly address: (name: string) => number;
  readonly addresses: (name: string) => readonly number[];
  readonly checkpoint: (address: number) => Promise<void>;
  readonly resume: () => Promise<number>;
}

/** Resolve a logical startup name from the published assembler labels. */
function startup(labels: Map<string, number>, name: string): number {
  const suffix = `_${Buffer.from(name).toString("hex")}`;
  const matches = [...labels].filter(([label]) => label.endsWith(suffix));
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Decode all published entries selected for a source function. */
function functionAddresses(
  labels: Map<string, number>,
  debug: Record<string, unknown>,
  name: string,
): number[] {
  const functions = profileRecords(debug.functions).filter(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants.length, name).toBeGreaterThan(0);
  return variants.map((variant) => {
    const label = variant.label;
    if (typeof label !== "string") throw new Error(`Missing published entry for ${name}`);
    const address = labels.get(label);
    if (address === undefined) throw new Error(`Missing assembled entry for ${name}`);
    return address;
  });
}

/** Require one entry only where source ownership selects exactly one. */
function functionAddress(
  labels: Map<string, number>,
  debug: Record<string, unknown>,
  name: string,
): number {
  const addresses = functionAddresses(labels, debug, name);
  expect(addresses, name).toHaveLength(1);
  return addresses[0]!;
}

/** Read the active CINV word without changing the emulated machine. */
async function cinv(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x0314, 0x0315);
  return bytes[0]! | (bytes[1]! << 8);
}

/** Compile one source and observe only its exact returned generation in one owned VICE child. */
async function inVice(
  source: string,
  profile: Profile,
  inspect: (machine: Machine) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected a valid IRQ source");
    expect(checked.profileId).toBe(profile);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete IRQ build");
    const directory = built.generation.directory;
    const labels = new Map(
      [
        ...(await readFile(join(directory, ".labels"), "utf8")).matchAll(
          /^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu,
        ),
      ].map((match) => [match[1]!, Number.parseInt(match[2]!, 16)]),
    );
    const debug = profileRecord(JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")));
    const started = await startVice(
      join(directory, built.generation.primaryArtifact),
      100_000_000,
      profile,
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    const { monitor } = started;
    const checkpoints: number[] = [];
    const checkpoint = async (address: number) => {
      checkpoints.push(await monitor.setExecuteCheckpoint(address));
    };
    const resume = async () => {
      const stopped = monitor.waitForStop(20_000);
      await monitor.resume();
      return stopped;
    };
    try {
      const entry = startup(labels, "startup.entry");
      const restore = startup(labels, "startup.restore");
      await checkpoint(entry);
      expect(await resume()).toBe(entry);
      const entryCpu = await monitor.readCpuRegisters();
      const original = await cinv(monitor);
      const stackAddress = (offset: number) => 0x0100 + ((entryCpu.sp + offset) & 0xff);
      const low = (await monitor.readMemory(stackAddress(1), stackAddress(1)))[0]!;
      const high = (await monitor.readMemory(stackAddress(2), stackAddress(2)))[0]!;
      const callerReturn = ((low | (high << 8)) + 1) & 0xffff;
      const main = functionAddress(labels, debug, "main");
      await checkpoint(main);
      await checkpoint(restore);
      await checkpoint(callerReturn);
      expect(await resume()).toBe(main);
      await inspect({
        monitor,
        original,
        entryCpu,
        restore,
        callerReturn,
        address: (name) => functionAddress(labels, debug, name),
        addresses: (name) => functionAddresses(labels, debug, name),
        checkpoint,
        resume,
      });
    } finally {
      try {
        for (const id of checkpoints) await monitor.deleteCheckpoint(id);
      } finally {
        await stopVice({ child: started.child, monitor });
      }
    }
  });
}

/** Finish through the normal return and prove that the caller's status and stack survive. */
async function finish(machine: Machine): Promise<void> {
  const { monitor, original, restore, callerReturn, entryCpu, resume } = machine;
  expect(await resume()).toBe(restore);
  expect(await cinv(monitor)).toBe(original);
  expect(await resume()).toBe(callerReturn);
  const exitCpu = await monitor.readCpuRegisters();
  expect(exitCpu.p & 0x0c).toBe(entryCpu.p & 0x0c);
  expect(exitCpu.sp).toBe((entryCpu.sp + 2) & 0xff);
  expect(await cinv(monitor)).toBe(original);
}

/** A nested exclusive handler exposes both function-value equality outcomes at runtime. */
const selectedSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
function plusOne(value: byte): byte { return value + 1; }
function plusTwo(value: byte): byte { return value + 2; }
function evaluate(value: byte): byte {
  let action: fn(byte): byte = peek($0401) == 0 ? &plusOne : &plusTwo;
  if (word(action) == word(&plusOne)) { poke($0420, 11); }
  else { poke($0420, 12); }
  return action(value);
}
interrupt function B(): void {
  poke($0421, evaluate(17));
  poke($0423, peek($dc0d));
}
interrupt function C(): void {
  poke($0421, evaluate(33));
  poke($0423, peek($dc0d));
}
interrupt function A(): void {
  if (peek($0400) == 0) { setIRQExclusive(&B); }
  else { setIRQExclusive(&C); }
  asm_cli(); while (peek($0420) == 0) { asm_nop(); } asm_sei();
  restoreIRQ();
}
function main(): void {
  setIRQ(&A);
  asm_cli(); while (peek($0420) == 0) { asm_nop(); } asm_sei();
  restoreIRQ();
}`;

/** B chains to A, while A's temporary C installation leaves its older link intact. */
const chainSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function C(): void { poke($0426, peek($0426) + 1); }
interrupt function A(): void {
  poke($0421, peek($0421) + 1);
  pokew($0422, peekw($0314));
  setIRQExclusive(&C);
  restoreIRQ();
  pokew($0424, peekw($0314));
}
interrupt function B(): void { poke($0420, peek($0420) + 1); }
function main(): void {
  setIRQ(&A); setIRQ(&B);
  asm_cli();
  while (peek($0421) == 0) { asm_nop(); }
  asm_sei();
  restoreIRQ(); restoreIRQ();
}`;

/** Two A entries reuse one helper site, with B calling it while A's link is live. */
const repeatedSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
function installB(): void { setIRQExclusive(&B); }
interrupt function A(): void {
  poke($0420, peek($0420) + 1);
  if (peek($0400) == 1) { pokew($043a, peekw($0314)); }
  else { pokew($0432, peekw($0314)); }
  installB();
  if (peek($0400) == 2) {
    asm_cli(); while (peek($0421) == 0) { asm_nop(); } asm_sei();
    pokew($043c, peekw($0314));
  }
  restoreIRQ();
  if (peek($0400) == 1) { pokew($0430, peekw($0314)); }
  else { pokew($0434, peekw($0314)); }
}
interrupt function B(): void {
  poke($0421, peek($0421) + 1);
  pokew($0436, peekw($0314));
  installB();
  pokew($043e, peekw($0314));
  restoreIRQ();
  pokew($0438, peekw($0314));
  poke($0423, peek($dc0d));
}
function main(): void {
  setIRQ(&A); poke($0400, 1);
  asm_cli(); while (peek($0420) == 0) { asm_nop(); } asm_sei();
  restoreIRQ();
  setIRQ(&A); poke($0400, 2);
  asm_cli(); while (peek($0420) < 2) { asm_nop(); } asm_sei();
  restoreIRQ();
}`;

/** One temporary install must restore its predecessor under every selected machine profile. */
const profileSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function B(): void { poke($0426, peek($0426) + 1); }
interrupt function A(): void {
  poke($0420, peek($0420) + 1);
  pokew($0422, peekw($0314));
  setIRQExclusive(&B);
  restoreIRQ();
  pokew($0424, peekw($0314));
}
function main(): void {
  setIRQ(&A);
  asm_cli(); while (peek($0420) == 0) { asm_nop(); } asm_sei();
  restoreIRQ();
}`;

describe.sequential("handler-owned IRQ execution in pinned VICE", () => {
  it.each([
    [0, 0, "B", 11, 18],
    [1, 1, "C", 12, 35],
  ] as const)(
    "executes source choice %s with equality input %s and its original function outcome",
    async (choice, action, selected, marker, answer) => {
      await inVice(selectedSource, pal, async (machine) => {
        const { monitor, original, address, checkpoint, resume } = machine;
        await monitor.writeMemory(0x0400, Uint8Array.of(choice, action));
        await monitor.writeMemory(0x0420, new Uint8Array(4));
        const a = address("A");
        const b = address("B");
        const c = address("C");
        await checkpoint(a);
        await checkpoint(b);
        await checkpoint(c);
        await checkpoint(original);
        monitor.takeCheckpointHits();
        expect(await resume()).toBe(a);
        expect(await cinv(monitor)).toBe(a);
        expect(await resume()).toBe(address(selected));
        expect(await cinv(monitor)).toBe(address(selected));
        expect(await resume()).toBe(original);
        expect([...(await monitor.readMemory(0x0420, 0x0421))]).toEqual([marker, answer]);
        expect((await monitor.readMemory(0x0423, 0x0423))[0]! & 0x81).toBe(0x81);
        await finish(machine);
      });
    },
    90_000,
  );

  it("visits B, A, and the saved original once while A restores its temporary C", async () => {
    await inVice(chainSource, pal, async (machine) => {
      const { monitor, original, address, checkpoint, resume } = machine;
      await monitor.writeMemory(0x0420, new Uint8Array(7));
      const a = address("A");
      const b = address("B");
      const c = address("C");
      await checkpoint(b);
      await checkpoint(a);
      await checkpoint(c);
      await checkpoint(original);
      expect(await resume()).toBe(b);
      const bCpu = await monitor.readCpuRegisters();
      expect(await cinv(monitor)).toBe(b);
      expect(await resume()).toBe(a);
      const aCpu = await monitor.readCpuRegisters();
      expect(aCpu.p & ~0x10).toBe(bCpu.p & ~0x10);
      expect(await cinv(monitor)).toBe(b);
      expect(await resume()).toBe(original);
      expect((await monitor.readCpuRegisters()).p & ~0x10).toBe(aCpu.p & ~0x10);
      expect([...(await monitor.readMemory(0x0420, 0x0426))]).toEqual([
        1,
        1,
        b & 0xff,
        b >> 8,
        b & 0xff,
        b >> 8,
        0,
      ]);
      await finish(machine);
    });
  }, 90_000);

  it("preserves two A predecessors when nested B reuses A's live helper install site", async () => {
    await inVice(repeatedSource, pal, async (machine) => {
      const { monitor, original, addresses, checkpoint, resume } = machine;
      await monitor.writeMemory(0x0420, new Uint8Array(4));
      await monitor.writeMemory(0x0430, new Uint8Array(16));
      const aEntries = addresses("A");
      const bEntries = addresses("B");
      const helperEntries = addresses("installB");
      for (const entry of new Set([...aEntries, ...bEntries, ...helperEntries, original]))
        await checkpoint(entry);
      const firstA = await resume();
      expect(aEntries).toContain(firstA);
      expect(await cinv(monitor)).toBe(firstA);
      expect(helperEntries).toContain(await resume());
      expect(await cinv(monitor)).toBe(firstA);
      expect(await resume()).toBe(original);
      expect([...(await monitor.readMemory(0x0430, 0x0431))]).toEqual([firstA & 0xff, firstA >> 8]);
      expect([...(await monitor.readMemory(0x043a, 0x043b))]).toEqual([firstA & 0xff, firstA >> 8]);
      const secondA = await resume();
      expect(aEntries).toContain(secondA);
      expect(await cinv(monitor)).toBe(secondA);
      expect(helperEntries).toContain(await resume());
      expect(await cinv(monitor)).toBe(secondA);
      const b = await resume();
      expect(bEntries).toContain(b);
      expect(await cinv(monitor)).toBe(b);
      expect(helperEntries).toContain(await resume());
      expect(await cinv(monitor)).toBe(b);
      expect(await resume()).toBe(original);
      expect([...(await monitor.readMemory(0x0420, 0x0421))]).toEqual([2, 1]);
      expect((await monitor.readMemory(0x0423, 0x0423))[0]! & 0x81).toBe(0x81);
      for (const address of [0x0432, 0x0434])
        expect([...(await monitor.readMemory(address, address + 1))]).toEqual([
          secondA & 0xff,
          secondA >> 8,
        ]);
      for (const address of [0x0436, 0x0438, 0x043c])
        expect([...(await monitor.readMemory(address, address + 1))]).toEqual([b & 0xff, b >> 8]);
      const nestedB = await monitor.readMemory(0x043e, 0x043f);
      expect(bEntries).toContain(nestedB[0]! | (nestedB[1]! << 8));
      await finish(machine);
    });
  }, 90_000);

  it.each(profiles)(
    "restores a temporary install on %s with selected VIC-II and SID resources",
    async (profile, vic, sid) => {
      await inVice(profileSource, profile, async (machine) => {
        const { monitor, original, address, checkpoint, resume } = machine;
        expect(await monitor.readIntegerResource("VICIIModel")).toBe(vic);
        expect(await monitor.readIntegerResource("SidModel")).toBe(sid);
        expect(await monitor.readIntegerResource("CIA1Model")).toBe(0);
        expect(await monitor.readIntegerResource("CIA2Model")).toBe(0);
        expect(await monitor.readIntegerResource("KernalRev")).toBe(3);
        await monitor.writeMemory(0x0420, new Uint8Array(7));
        const a = address("A");
        const b = address("B");
        await checkpoint(a);
        await checkpoint(b);
        await checkpoint(original);
        expect(await resume()).toBe(a);
        expect(await cinv(monitor)).toBe(a);
        expect(await resume()).toBe(original);
        expect([...(await monitor.readMemory(0x0420, 0x0426))]).toEqual([
          1,
          0,
          a & 0xff,
          a >> 8,
          a & 0xff,
          a >> 8,
          0,
        ]);
        await finish(machine);
      });
    },
    90_000,
  );
});
