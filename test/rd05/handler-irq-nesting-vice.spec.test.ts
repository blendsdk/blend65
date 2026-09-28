import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceCpuRegisters, ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const CIA1_ICR = 0xdc0d;
const TEST_CODE = 0xc000;

/** One stopped C64 with its original vector, public entries, and owned checkpoints. */
interface Machine {
  readonly monitor: ViceMonitor;
  readonly original: number;
  readonly entryCpu: ViceCpuRegisters;
  readonly restore: number;
  readonly callerReturn: number;
  readonly entries: (name: string) => readonly number[];
  readonly checkpoint: (address: number) => Promise<void>;
  readonly resume: () => Promise<number>;
}

/** Locate one startup label in the exact generation returned by the build. */
function startup(labels: Map<string, number>, name: string): number {
  const suffix = `_${Buffer.from(name).toString("hex")}`;
  const matches = [...labels].filter(([label]) => label.endsWith(suffix));
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Resolve every published machine entry of one source function. */
function functionEntries(
  labels: Map<string, number>,
  debug: Record<string, unknown>,
  name: string,
): number[] {
  const functions = profileRecords(debug.functions).filter(
    (record) => record.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants.length, name).toBeGreaterThan(0);
  return variants.map((variant) => {
    if (typeof variant.label !== "string") throw new Error(`Missing entry label for ${name}`);
    const address = labels.get(variant.label);
    if (address === undefined) throw new Error(`Missing assembled entry for ${name}`);
    return address;
  });
}

/** Read the currently installed C64 KERNAL CINV handler word. */
async function cinv(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x0314, 0x0315);
  return bytes[0]! | (bytes[1]! << 8);
}

/** Read one byte without acknowledging a device interrupt. */
async function ioByte(monitor: ViceMonitor, address: number): Promise<number> {
  return (await monitor.readIo(address, address))[0]!;
}

/** Run a checked and built source in one owned, sequential VICE child. */
async function inVice(source: string, inspect: (machine: Machine) => Promise<void>): Promise<void> {
  await withProfileProject(source, PROFILE, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected a valid IRQ source");
    expect(checked.profileId).toBe(PROFILE);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete IRQ build");
    const directory = built.generation.directory;
    const artifact = await readFile(join(directory, built.generation.primaryArtifact));
    expect(0x0801 + artifact.length - 2).toBeLessThan(TEST_CODE);
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
      PROFILE,
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    const { monitor } = started;
    const checkpoints: number[] = [];
    const checkpoint = async (address: number) => {
      checkpoints.push(await monitor.setExecuteCheckpoint(address));
    };
    const resume = async () => {
      const stop = monitor.waitForStop(20_000);
      await monitor.resume();
      return stop;
    };
    try {
      const entry = startup(labels, "startup.entry");
      const restore = startup(labels, "startup.restore");
      await checkpoint(entry);
      expect(await resume()).toBe(entry);
      const entryCpu = await monitor.readCpuRegisters();
      const original = await cinv(monitor);
      const stackByte = async (offset: number) => {
        const address = 0x0100 + ((entryCpu.sp + offset) & 0xff);
        return (await monitor.readMemory(address, address))[0]!;
      };
      const callerReturn = (((await stackByte(1)) | ((await stackByte(2)) << 8)) + 1) & 0xffff;
      const main = functionEntries(labels, debug, "main");
      expect(main).toHaveLength(1);
      await checkpoint(main[0]!);
      await checkpoint(restore);
      await checkpoint(callerReturn);
      expect(await resume()).toBe(main[0]);
      await inspect({
        monitor,
        original,
        entryCpu,
        restore,
        callerReturn,
        entries: (name) => functionEntries(labels, debug, name),
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

/** Leave through the returning startup path with its original vector and stack. */
async function finish(machine: Machine): Promise<void> {
  const { monitor, original, entryCpu, restore, callerReturn, resume } = machine;
  expect(await resume()).toBe(restore);
  expect(await cinv(monitor)).toBe(original);
  expect(await resume()).toBe(callerReturn);
  expect((await monitor.readCpuRegisters()).sp).toBe((entryCpu.sp + 2) & 0xff);
  expect(await cinv(monitor)).toBe(original);
}

/** Main and two nested handlers keep the same helper's live homes independent. */
const nestedStorageSource = `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
function markA(): void { poke($0431, 1); }
function increment(value: byte): byte {
  let saved: byte = value;
  let offset: byte = peek($0401);
  if (value == 77) {
    poke($0420, 1);
    asm_cli(); while (peek($0420) < 2) { asm_nop(); } asm_sei();
  }
  if (value == 17) {
    poke($0420, 3);
    markA();
    asm_cli(); while (peek($0420) < 4) { asm_nop(); } asm_sei();
  }
  saved += offset;
  saved -= offset;
  return saved + 1;
}
interrupt function B(): void {
  poke($0427, peek($dc0d));
  poke($0426, increment(33));
  poke($0420, 4);
}
interrupt function A(): void {
  poke($0428, peek($0428) + 1);
  poke($d019, 1);
  poke($0420, 2);
  setIRQExclusive(&B);
  poke($0425, increment(17));
  restoreIRQ();
}
function main(): void {
  asm_sei();
  poke($0432, peek($dc0d));
  setIRQ(&A);
  poke($0424, increment(77));
  asm_sei(); restoreIRQ();
}`;

/** The monitor configures one CIA1 timer-A interrupt while the CPU is stopped. */
async function armOneCiaIrq(monitor: ViceMonitor): Promise<void> {
  await monitor.writeIo(CIA1_ICR, Uint8Array.of(0x7f));
  await monitor.writeIo(0xdc0e, Uint8Array.of(0));
  await monitor.writeIo(0xdc04, Uint8Array.of(2, 0));
  await monitor.writeIo(CIA1_ICR, Uint8Array.of(0x81));
  await monitor.writeIo(0xdc0e, Uint8Array.of(0x19));
}

/** A source-level probe makes the handler's normalized body status observable. */
function statusSource(exclusive: boolean, initiallyEnabled: boolean): string {
  return `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
function probe(): void { poke($0421, 1); }
function arm(): void { poke($0430, 1); }
interrupt function B(): void { poke($0423, peek($dc0d)); }
interrupt function A(): void {
  setIRQExclusive(&B);
  probe();
  poke($0420, peek($dc0d));
  restoreIRQ();
}
function main(): void {
  asm_sei();
  poke($0422, peek($dc0d));
  ${exclusive ? "setIRQExclusive" : "setIRQ"}(&A);
  ${initiallyEnabled ? "asm_cli();" : ""}
  arm();
  restoreIRQ();
}`;
}

describe.sequential("nested IRQ storage and complete status in pinned VICE", () => {
  it("keeps main, suspended A, and nested B helper state separate and acknowledges each source once", async () => {
    await inVice(nestedStorageSource, async (machine) => {
      const { monitor, original, entries, checkpoint, resume } = machine;
      await monitor.writeMemory(0x0401, Uint8Array.of(9));
      await monitor.writeMemory(0x0420, new Uint8Array(8));
      await monitor.writeMemory(0x0428, Uint8Array.of(0));
      await monitor.writeMemory(0x0431, new Uint8Array(2));
      await monitor.writeIo(CIA1_ICR, Uint8Array.of(0x7f));
      await monitor.writeIo(0xdc0e, Uint8Array.of(0));
      await monitor.writeIo(0xd011, Uint8Array.of((await ioByte(monitor, 0xd011)) & 0x7f));
      await monitor.writeIo(0xd012, Uint8Array.of(0x80));
      const a = entries("A");
      const b = entries("B");
      const helper = entries("increment");
      const markA = entries("markA");
      for (const address of new Set([...a, ...b, ...helper, ...markA, 0xea81, original]))
        await checkpoint(address);
      monitor.takeCheckpointHits();
      const mainHelper = await resume();
      expect(helper).toContain(mainHelper);
      await monitor.writeIo(0xd019, Uint8Array.of(1));
      await monitor.writeIo(0xd01a, Uint8Array.of(1));
      expect(a).toContain(await resume());
      expect((await ioByte(monitor, 0xd019)) & 1).toBe(1);
      expect((await ioByte(monitor, CIA1_ICR)) & 0x81).toBe(0);
      expect(a).toContain(await cinv(monitor));
      const aHelper = await resume();
      expect(helper).toContain(aHelper);
      const suspended = await resume();
      expect(markA).toContain(suspended);
      expect((await monitor.readMemory(0x0420, 0x0420))[0]).toBe(3);
      expect(b).toContain(await cinv(monitor));
      await armOneCiaIrq(monitor);
      const nested = await resume();
      expect(b).toContain(nested);
      expect((await ioByte(monitor, CIA1_ICR)) & 1).toBe(1);
      expect((await ioByte(monitor, 0xd019)) & 1).toBe(0);
      expect(b).toContain(await cinv(monitor));
      const bHelper = await resume();
      expect(helper).toContain(bHelper);
      expect(await resume()).toBe(0xea81);
      expect(await resume()).toBe(original);
      expect(a).toContain(await cinv(monitor));
      expect([...(await monitor.readMemory(0x0420, 0x0427))]).toEqual([
        4, 0, 0, 0, 0, 18, 34, 0x81,
      ]);
      expect((await ioByte(monitor, CIA1_ICR)) & 1).toBe(0);
      expect(await resume()).toBe(0xea81);
      await finish(machine);
      expect((await monitor.readMemory(0x0424, 0x0424))[0]).toBe(78);
      expect((await monitor.readMemory(0x0428, 0x0428))[0]).toBe(1);
    });
  }, 90_000);

  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, false],
    [false, false, true],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ] as const)(
    "restores complete status and registers for %s exclusive entry, decimal mode %s, initially enabled %s",
    async (exclusive, decimal, initiallyEnabled) => {
      await inVice(statusSource(exclusive, initiallyEnabled), async (machine) => {
        const { monitor, original, entries, checkpoint, resume } = machine;
        await monitor.writeIo(0xd01a, Uint8Array.of(0));
        await monitor.writeIo(0xd019, Uint8Array.of(1));
        await monitor.writeIo(CIA1_ICR, Uint8Array.of(0x7f));
        const a = entries("A");
        const b = entries("B");
        const arm = entries("arm");
        const probe = entries("probe");
        expect(a).toHaveLength(1);
        expect(arm).toHaveLength(1);
        for (const address of new Set([
          ...a,
          ...b,
          ...arm,
          ...probe,
          exclusive ? 0xea81 : original,
        ]))
          await checkpoint(address);
        // This function has a source write, leaving room for the three-byte jump patch.
        const originalArm = await monitor.readMemory(arm[0]!, arm[0]! + 2);
        // Test-only 6510 code establishes known registers and D; both patched regions are restored.
        const setup = Uint8Array.of(
          0xa9,
          0x11,
          0xa2,
          0x22,
          0xa0,
          0x33,
          decimal ? 0xf8 : 0xd8,
          ...(initiallyEnabled ? [] : [0x78]),
          0xea,
          0xea,
          0xea,
          0xea,
          0xea,
          0xea,
          0xea,
          0xea,
        );
        const tail = initiallyEnabled
          ? Uint8Array.of(0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0x60)
          : Uint8Array.of(0x58, 0xea, 0xea, 0x60);
        const trampoline = Uint8Array.of(...setup, ...tail);
        const originalRam = await monitor.readMemory(TEST_CODE, TEST_CODE + trampoline.length - 1);
        const beforeOpportunity = TEST_CODE + setup.length;
        const afterIrq = TEST_CODE + trampoline.length - 1;
        try {
          await monitor.writeMemory(TEST_CODE, trampoline);
          await monitor.writeMemory(arm[0]!, Uint8Array.of(0x4c, 0, 0xc0));
          await checkpoint(beforeOpportunity);
          await checkpoint(afterIrq);
          expect(await resume()).toBe(arm[0]);
          expect((await monitor.readCpuRegisters()).p & 4).toBe(initiallyEnabled ? 0 : 4);
          expect(await cinv(monitor)).toBe(a[0]);
          if (!initiallyEnabled) await armOneCiaIrq(monitor);
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(beforeOpportunity);
          const before = await monitor.readCpuRegisters();
          expect({ a: before.a, x: before.x, y: before.y }).toEqual({ a: 0x11, x: 0x22, y: 0x33 });
          expect(before.p & 0x0c).toBe((decimal ? 8 : 0) | (initiallyEnabled ? 0 : 4));
          expect((await ioByte(monitor, CIA1_ICR)) & 1).toBe(initiallyEnabled ? 0 : 1);
          // A pending source cannot enter through the masked interval.
          if (initiallyEnabled) await armOneCiaIrq(monitor);
          expect(await resume()).toBe(a[0]);
          const entry = await monitor.readCpuRegisters();
          expect(entry.p & 0x0c).toBe(decimal ? 0x0c : 0x04);
          expect((await ioByte(monitor, CIA1_ICR)) & 1).toBe(1);
          const body = await resume();
          expect(probe).toContain(body);
          expect((await monitor.readCpuRegisters()).p & 8).toBe(0);
          expect(await cinv(monitor)).toBe(b[0]);
          expect(await resume()).toBe(exclusive ? 0xea81 : original);
          expect(await cinv(monitor)).toBe(a[0]);
          if (!exclusive) expect((await monitor.readCpuRegisters()).p & 0xcf).toBe(entry.p & 0xcf);
          expect(await resume()).toBe(afterIrq);
          const returned = await monitor.readCpuRegisters();
          expect({ a: returned.a, x: returned.x, y: returned.y, sp: returned.sp }).toEqual({
            a: before.a,
            x: before.x,
            y: before.y,
            sp: before.sp,
          });
          expect(returned.p & 0xcf).toBe(before.p & (initiallyEnabled ? 0xff : ~4) & 0xcf);
          expect((await monitor.readMemory(0x0420, 0x0420))[0]).toBe(0x81);
          expect((await ioByte(monitor, CIA1_ICR)) & 1).toBe(0);
          await finish(machine);
        } finally {
          await monitor.writeMemory(arm[0]!, originalArm);
          await monitor.writeMemory(TEST_CODE, originalRam);
        }
      });
    },
    90_000,
  );
});
