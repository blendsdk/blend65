import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", 0, 0],
  ["c64-pal-prg-kernal-8580", 0, 1],
  ["c64-ntsc-prg-kernal-6581", 3, 0],
  ["c64-ntsc-prg-kernal-8580", 3, 1],
] as const;

/** A nonreturning program keeps all device transitions visible to the monitor. */
const source = `module Game;
import { setIRQExclusive } from c64.system;
interrupt function onIrq(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  poke($0440, pending);
}
function handoffPoint(): void { poke($0430, 1); }
function afterHandoff(): void { poke($0431, 1); }
function stoppedPoint(): void { poke($0432, 1); }
function runningPoint(): void { poke($0433, 1); }
function loadedPoint(): void { poke($0434, 1); }
function donePoint(): void { poke($0435, 1); }
function main(): void {
  asm_php(); asm_sei();
  handoffPoint();
  let wait: byte = 80;
  while (wait != 0) { asm_nop(); wait -= 1; }
  setIRQExclusive(&onIrq);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let oldPending: byte = c64.cia1.readAndClearPendingSources();
  poke($0420, oldPending);
  if ((oldPending & c64.cia1.sourceTimerA) != 0) { poke($0421, 1); }
  asm_plp();
  afterHandoff();
  asm_sei();
  c64.cia1.configureTimerA(0);
  c64.cia1.configureTimerB(0);
  c64.cia1.writeTimerALatch($1234);
  c64.cia1.writeTimerBLatch($2345);
  stoppedPoint();
  c64.cia1.configureTimerA(c64.cia1.timerStart);
  c64.cia1.configureTimerB(c64.cia1.timerStart);
  c64.cia1.writeTimerALatch($e000);
  c64.cia1.writeTimerBLatch($d000);
  runningPoint();
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
  c64.cia1.configureTimerB(c64.cia1.timerLoad | c64.cia1.timerStart);
  loadedPoint();
  c64.cia1.configureTimerA(0);
  c64.cia1.configureTimerB(0);
  c64.cia1.writeTimerALatch(2);
  c64.cia1.writeTimerBLatch(2);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);
  c64.cia1.configureTimerA(c64.cia1.timerStart | c64.cia1.timerOneShot | c64.cia1.timerLoad);
  c64.cia1.configureTimerB(c64.cia1.timerStart | c64.cia1.timerOneShot | c64.cia1.timerLoad);
  asm_nop(); asm_nop(); asm_nop(); asm_nop();
  c64.cia1.configureTimerA(0);
  c64.cia1.configureTimerB(0);
  let bothPending: byte = c64.cia1.readAndClearPendingSources();
  poke($0422, bothPending);
  if ((bothPending & c64.cia1.sourceTimerA) != 0) { poke($0423, 1); }
  if ((bothPending & c64.cia1.sourceTimerB) != 0) { poke($0424, 1); }
  poke($0425, c64.cia1.readAndClearPendingSources());
  donePoint();
  while (true) { asm_nop(); }
}`;

/** Resolve one public function entry from the successful generation's debug record. */
function functionAddress(
  labels: Map<string, number>,
  debug: Record<string, unknown>,
  name: string,
): number {
  const functions = profileRecords(debug.functions).filter(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants, name).toHaveLength(1);
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new Error(`Missing published entry for ${name}`);
  const address = labels.get(label);
  if (address === undefined) throw new Error(`Missing assembled entry for ${name}`);
  return address;
}

/** Read a timer pair while the emulated CPU is stopped. */
async function stoppedCounter(monitor: ViceMonitor, lowAddress: number): Promise<number> {
  const bytes = await monitor.readIo(lowAddress, lowAddress + 1);
  return bytes[0]! | (bytes[1]! << 8);
}

/** Read the KERNAL's active IRQ vector without changing the emulated machine. */
async function cinv(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x0314, 0x0315);
  return bytes[0]! | (bytes[1]! << 8);
}

/** Arm a one-shot stock Timer A event only after the source has set the I flag. */
async function armStockTimerA(monitor: ViceMonitor): Promise<void> {
  await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
  await monitor.writeIo(0xdc0e, Uint8Array.of(0));
  await monitor.writeIo(0xdc04, Uint8Array.of(2, 0));
  await monitor.writeIo(0xdc0d, Uint8Array.of(0x81));
  await monitor.writeIo(0xdc0e, Uint8Array.of(0x19));
}

describe.sequential("CIA timer and interrupt effects in pinned VICE", () => {
  it.each(profiles)(
    "observes the masked handoff, latch transfer, and two pending sources on %s",
    async (profile, vic, sid) => {
      await withProfileProject(source, profile, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        if (checked.kind !== "success") throw new Error("Expected a valid CIA source");
        expect(checked.profileId).toBe(profile);
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a complete CIA build");
        const directory = built.generation.directory;
        const labels = new Map(
          [
            ...(await readFile(join(directory, ".labels"), "utf8")).matchAll(
              /^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu,
            ),
          ].map((match) => [match[1]!, Number.parseInt(match[2]!, 16)]),
        );
        const debug = profileRecord(
          JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")),
        );
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
          const stop = monitor.waitForStop(20_000);
          await monitor.resume();
          return stop;
        };
        try {
          expect(started.identity.executableSha256).toBe(
            "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74",
          );
          expect(await monitor.readIntegerResource("VICIIModel")).toBe(vic);
          expect(await monitor.readIntegerResource("SidModel")).toBe(sid);
          expect(await monitor.readIntegerResource("CIA1Model")).toBe(0);
          expect(await monitor.readIntegerResource("CIA2Model")).toBe(0);
          expect(await monitor.readIntegerResource("KernalRev")).toBe(3);

          const main = functionAddress(labels, debug, "main");
          const handoff = functionAddress(labels, debug, "handoffPoint");
          const after = functionAddress(labels, debug, "afterHandoff");
          const stopped = functionAddress(labels, debug, "stoppedPoint");
          const running = functionAddress(labels, debug, "runningPoint");
          const loaded = functionAddress(labels, debug, "loadedPoint");
          const done = functionAddress(labels, debug, "donePoint");
          const handler = functionAddress(labels, debug, "onIrq");
          for (const address of [main, handoff, after, stopped, running, loaded, done, handler])
            await checkpoint(address);

          expect(await resume()).toBe(main);
          await monitor.writeMemory(0x0420, new Uint8Array(6));
          await monitor.writeMemory(0x0430, new Uint8Array(6));
          await monitor.writeMemory(0x0440, Uint8Array.of(0));
          expect(await resume()).toBe(handoff);
          const handoffCpu = await monitor.readCpuRegisters();
          expect(handoffCpu.p & 0x04).toBe(0x04);
          const originalVector = await cinv(monitor);
          const savedStatusAddress = 0x0100 + ((handoffCpu.sp + 3) & 0xff);
          const savedStatus = (
            await monitor.readMemory(savedStatusAddress, savedStatusAddress)
          )[0]!;
          await armStockTimerA(monitor);
          const icrRead = await monitor.setAccessTracepoint(0xdc0d, "load");
          const icrWrite = await monitor.setAccessTracepoint(0xdc0d, "store");
          const vectorLowWrite = await monitor.setAccessTracepoint(0x0314, "store");
          const vectorHighWrite = await monitor.setAccessTracepoint(0x0315, "store");
          checkpoints.push(icrRead, icrWrite, vectorLowWrite, vectorHighWrite);
          monitor.takeCheckpointHits();

          expect(await resume()).toBe(after);
          const handoffHits = monitor.takeCheckpointHits();
          expect(handoffHits.filter((id) => id === vectorLowWrite)).toHaveLength(1);
          expect(handoffHits.filter((id) => id === vectorHighWrite)).toHaveLength(1);
          expect(handoffHits.filter((id) => id === icrWrite)).toHaveLength(1);
          expect(handoffHits.filter((id) => id === icrRead)).toHaveLength(1);
          expect(handoffHits.indexOf(vectorLowWrite)).toBeLessThan(handoffHits.indexOf(icrWrite));
          expect(handoffHits.indexOf(vectorHighWrite)).toBeLessThan(handoffHits.indexOf(icrWrite));
          expect(handoffHits.indexOf(icrWrite)).toBeLessThan(handoffHits.indexOf(icrRead));
          expect(originalVector).not.toBe(handler);
          expect(await cinv(monitor)).toBe(handler);
          expect((await monitor.readMemory(0x0420, 0x0420))[0]! & 0x01).toBe(0x01);
          expect((await monitor.readMemory(0x0421, 0x0421))[0]).toBe(1);
          expect((await monitor.readMemory(0x0440, 0x0440))[0]).toBe(0);
          const restoredCpu = await monitor.readCpuRegisters();
          expect(restoredCpu.p & 0xcf).toBe(savedStatus & 0xcf);
          expect(restoredCpu.sp).toBe((handoffCpu.sp + 1) & 0xff);

          // The monitor supplies non-timer mode bits while the CPU is stopped.
          await monitor.writeIo(0xdc0e, Uint8Array.of(0xc6));
          await monitor.writeIo(0xdc0f, Uint8Array.of(0x86));
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(stopped);
          expect(await stoppedCounter(monitor, 0xdc04)).toBe(0x1234);
          expect(await stoppedCounter(monitor, 0xdc06)).toBe(0x2345);
          expect((await monitor.readIo(0xdc0e, 0xdc0e))[0]).toBe(0xc6);
          expect((await monitor.readIo(0xdc0f, 0xdc0f))[0]).toBe(0x86);

          expect(await resume()).toBe(running);
          const beforeLoad = await stoppedCounter(monitor, 0xdc04);
          expect(beforeLoad >> 8).toBeGreaterThanOrEqual(0x11);
          expect(beforeLoad >> 8).toBeLessThanOrEqual(0x12);
          const bBeforeLoad = await stoppedCounter(monitor, 0xdc06);
          expect(bBeforeLoad >> 8).toBeGreaterThanOrEqual(0x22);
          expect(bBeforeLoad >> 8).toBeLessThanOrEqual(0x23);
          expect((await monitor.readIo(0xdc0e, 0xdc0e))[0]).toBe(0xc7);
          expect((await monitor.readIo(0xdc0f, 0xdc0f))[0]).toBe(0x87);
          expect(await resume()).toBe(loaded);
          const afterLoad = await stoppedCounter(monitor, 0xdc04);
          expect(afterLoad >> 8).toBeGreaterThanOrEqual(0xdf);
          expect(afterLoad >> 8).toBeLessThanOrEqual(0xe0);
          const bAfterLoad = await stoppedCounter(monitor, 0xdc06);
          expect(bAfterLoad >> 8).toBeGreaterThanOrEqual(0xcf);
          expect(bAfterLoad >> 8).toBeLessThanOrEqual(0xd0);
          expect((await monitor.readIo(0xdc0e, 0xdc0e))[0]).toBe(0xc7);
          expect((await monitor.readIo(0xdc0f, 0xdc0f))[0]).toBe(0x87);

          monitor.takeCheckpointHits();
          expect(await resume()).toBe(done);
          const pendingHits = monitor.takeCheckpointHits();
          expect(pendingHits.filter((id) => id === icrRead)).toHaveLength(2);
          expect(pendingHits.filter((id) => id === icrWrite)).toHaveLength(1);
          expect([...(await monitor.readMemory(0x0422, 0x0425))]).toEqual([0x83, 1, 1, 0]);
          expect((await monitor.readMemory(0x0440, 0x0440))[0]).toBe(0);
          expect((await monitor.readIo(0xdc0e, 0xdc0e))[0]! & 0xc6).toBe(0xc6);
          expect((await monitor.readIo(0xdc0f, 0xdc0f))[0]! & 0x86).toBe(0x86);
        } finally {
          try {
            for (const id of checkpoints) await monitor.deleteCheckpoint(id);
          } finally {
            await stopVice({ child: started.child, monitor });
          }
        }
      });
    },
    90_000,
  );
});
