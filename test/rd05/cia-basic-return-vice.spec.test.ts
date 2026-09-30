import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", 0, 0],
  ["c64-pal-prg-kernal-8580", 0, 1],
  ["c64-ntsc-prg-kernal-6581", 3, 0],
  ["c64-ntsc-prg-kernal-8580", 3, 1],
] as const;
const source = `module Game;
interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0440, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0441, 1); }
}
function beforeRelease(): void {}
function afterRelease(): void {}
function main(): void {
  asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let initialPending: byte = c64.cia1.readAndClearPendingSources();
  poke($0420, initialPending);
  asm_plp();
  c64.cia1.writeTimerALatch($1234);
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);
  asm_php(); asm_sei();
  beforeRelease();
  let wait: byte = 80;
  while (wait != 0) { asm_nop(); wait -= 1; }
  beforeRelease();
  c64.system.restoreIRQ();
  afterRelease();
  asm_plp();
}`;
const expectedRoms = [
  {
    name: "basic-901226-01.bin",
    bytes: 8192,
    sha256: "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
  },
  {
    name: "chargen-901225-01.bin",
    bytes: 4096,
    sha256: "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
  },
  {
    name: "kernal-901227-03.bin",
    bytes: 8192,
    sha256: "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
  },
];

/** Locate checkpoints through the public assembled symbol map. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Read only stable, meaningful device fields, never pending ICR or running timer counters. */
async function unrelatedState(monitor: ViceMonitor) {
  return {
    ports: [...(await monitor.readMemory(0, 1))],
    cinv: [...(await monitor.readMemory(0x0314, 0x0315))],
    nminv: [...(await monitor.readMemory(0x0318, 0x0319))],
    cia2PortsAndDirections: [...(await monitor.readIo(0xdd00, 0xdd03))],
    cia2Controls: [...(await monitor.readIo(0xdd0e, 0xdd0f))].map((value) => value & 0xef),
  };
}

/** The stock KERNAL clock is a high/middle/low 24-bit counter. */
async function jiffyClock(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x00a0, 0x00a2);
  return (bytes[0]! << 16) | (bytes[1]! << 8) | bytes[2]!;
}

describe.sequential("CIA1 stock service after normal return in real VICE", () => {
  it.each(profiles)(
    "should release a pending game timer and resume KERNAL keyboard service on %s",
    async (profile, vic, sid) => {
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        for (const error of built.diagnostics.filter(({ code }) => code === "E10278"))
          expect.soft(error.primarySpan).toEqual(profileSpan(source, "c64.system.restoreIRQ()"));
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a real returning CIA1 PRG");
        const directory = built.generation.directory;
        const prgPath = join(directory, built.generation.primaryArtifact);
        const prg = await readFile(prgPath);
        expect([...prg.subarray(0, 2)]).toEqual([1, 8]);
        const labels = addresses(await readFile(join(directory, ".labels"), "utf8"));
        const entries = [...labels].filter(([label]) =>
          label.endsWith(`_${Buffer.from("startup.entry").toString("hex")}`),
        );
        expect(entries).toHaveLength(1);
        const entry = entries[0]![1];
        expect(entry).toBe(0x080d);
        const debug = profileRecord(
          JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")),
        );
        /** Resolve one source function through its public entry variant and assembled label. */
        const functionAddress = (name: string) => {
          const fn = profileRecords(debug.functions).find(
            (record) => record.qualifiedName === `src/game.blend::Game.${name}`,
          );
          if (!fn) throw new Error(`Missing public function ${name}`);
          const variants = profileRecords(fn.entryVariants);
          expect(variants).toHaveLength(1);
          const label = variants[0]!.label;
          if (typeof label !== "string") throw new Error(`Missing entry label for ${name}`);
          const address = labels.get(label);
          if (address === undefined) throw new Error(`Missing assembled label for ${name}`);
          return address;
        };
        const started = await startVice(prgPath, 100_000_000, profile);
        if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
        const { monitor } = started;
        const checkpoints = new Set<number>();
        /** Track an owned stopping checkpoint separately from its stopped CPU address. */
        const checkpoint = async (address: number) => {
          const id = await monitor.setExecuteCheckpoint(address);
          checkpoints.add(id);
          return id;
        };
        /** Track an owned non-stopping access checkpoint for later hit filtering and cleanup. */
        const tracepoint = async (address: number, operation: "load" | "store") => {
          const id = await monitor.setAccessTracepoint(address, operation);
          checkpoints.add(id);
          return id;
        };
        /** Delete only this case's checkpoint and remove it from pending cleanup. */
        const remove = async (id: number) => {
          await monitor.deleteCheckpoint(id);
          checkpoints.delete(id);
        };
        /** Arm observation before execution resumes, returning the stopped CPU address. */
        const resume = async () => {
          const stopped = monitor.waitForStop(20_000);
          await monitor.resume();
          return stopped;
        };
        try {
          expect(started.identity.executableSha256).toBe(
            "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74",
          );
          expect(
            started.identity.roms
              .map((rom) => ({ name: basename(rom.path), bytes: rom.bytes, sha256: rom.sha256 }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          ).toEqual(expectedRoms);
          for (const [name, value] of [
            ["VICIIModel", vic],
            ["SidModel", sid],
            ["CIA1Model", 0],
            ["CIA2Model", 0],
            ["KernalRev", 3],
          ] as const)
            expect(await monitor.readIntegerResource(name)).toBe(value);
          const kernal = started.identity.roms.find(
            (rom) => basename(rom.path) === "kernal-901227-03.bin",
          );
          if (!kernal) throw new Error("Missing attested KERNAL image");
          const rom = await readFile(kernal.path);
          // SCNKEY's public jump table, not a guessed private routine address, binds the scan checkpoint.
          const scnkeyOffset = 0xff9f - 0xe000;
          expect(rom[scnkeyOffset]).toBe(0x4c);
          const scnkey = rom[scnkeyOffset + 1]! | (rom[scnkeyOffset + 2]! << 8);
          expect(scnkey).toBeGreaterThanOrEqual(0xe000);
          const entryCheckpoint = await checkpoint(entry);
          expect(await resume()).toBe(entry);
          const entryCpu = await monitor.readCpuRegisters();
          expect(entryCpu.p & 0x04, "stock BASIC caller permits continuing IRQ service").toBe(0);
          const entryState = await unrelatedState(monitor);
          const stack = await monitor.readMemory(0x0100, 0x01ff);
          const callerReturn =
            ((stack[(entryCpu.sp + 1) & 0xff]! | (stack[(entryCpu.sp + 2) & 0xff]! << 8)) + 1) &
            0xffff;
          const returnCheckpoint = await checkpoint(callerReturn);
          const beforeAddress = functionAddress("beforeRelease");
          const afterAddress = functionAddress("afterRelease");
          const beforeCheckpoint = await checkpoint(beforeAddress);
          const afterCheckpoint = await checkpoint(afterAddress);
          const handlerCheckpoint = await checkpoint(functionAddress("onIRQ"));
          await remove(entryCheckpoint);
          expect(await resume()).toBe(beforeAddress);
          expect((await monitor.readCpuRegisters()).p & 0x04).toBe(0x04);
          const todBit = (await monitor.readIo(0xdc0e, 0xdc0e))[0]! & 0x80;
          // Arm only after source SEI. Eighty source NOP iterations exceed this two-cycle one-shot.
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x1f));
          await monitor.writeIo(0xdc0e, Uint8Array.of(todBit));
          await monitor.writeIo(0xdc04, Uint8Array.of(2, 0));
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x81));
          await monitor.writeIo(0xdc0e, Uint8Array.of(todBit | 0x19));
          expect(await resume()).toBe(beforeAddress);
          const beforeCpu = await monitor.readCpuRegisters();
          expect(beforeCpu.p & 0x04).toBe(0x04);
          expect(
            (await monitor.readIo(0xdc0e, 0xdc0e))[0]! & 0x01,
            "old one-shot underflowed",
          ).toBe(0);
          const gameVector = [...(await monitor.readMemory(0x0314, 0x0315))];
          expect(gameVector).not.toEqual(entryState.cinv);
          const handbackTrace = new Map<number, string>();
          for (const address of [0xdc04, 0xdc05, 0xdc0d, 0xdc0e, 0xdc0f]) {
            for (const operation of ["load", "store"] as const)
              handbackTrace.set(
                await tracepoint(address, operation),
                `${operation}:${address.toString(16)}`,
              );
          }
          for (const address of [0x0314, 0x0315])
            handbackTrace.set(await tracepoint(address, "store"), `store:${address.toString(16)}`);
          const unrelatedWrites = new Map<number, number>();
          for (const [start, end] of [
            [0xdd00, 0xdd0f],
            [0xd400, 0xd418],
          ] as const)
            for (let address = start; address <= end; address++)
              unrelatedWrites.set(await tracepoint(address, "store"), address);
          await remove(beforeCheckpoint);
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(afterAddress);
          const releaseHits = monitor.takeCheckpointHits();
          expect(releaseHits.filter((id) => unrelatedWrites.has(id))).toEqual([]);
          expect(releaseHits).not.toContain(handlerCheckpoint);
          expect(
            releaseHits.filter((id) => handbackTrace.has(id)).map((id) => handbackTrace.get(id)),
          ).toEqual([
            "store:dc0d",
            "load:dc0e",
            "store:dc0e",
            "store:dc0f",
            "load:dc0d",
            "store:dc04",
            "store:dc05",
            "store:314",
            "store:315",
            "store:dc0d",
            "load:dc0e",
            "store:dc0e",
          ]);
          const afterCpu = await monitor.readCpuRegisters();
          expect(afterCpu.p & 0xcf).toBe(beforeCpu.p & 0xcf);
          expect(afterCpu.sp).toBe(beforeCpu.sp);
          expect([...(await monitor.readMemory(0x0314, 0x0315))]).toEqual(entryState.cinv);
          expect((await monitor.readIo(0xdc0e, 0xdc0e))[0]! & 0xef).toBe(todBit | 0x01);
          expect((await monitor.readIo(0xdc0f, 0xdc0f))[0]! & 0xef).toBe(0x08);
          for (const id of handbackTrace.keys()) await remove(id);
          await remove(afterCheckpoint);
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(callerReturn);
          // After handback, the ordinary exit restores the captured VIC bank:
          // port latch before direction. No other CIA2 or SID write is allowed.
          expect(
            monitor
              .takeCheckpointHits()
              .filter((id) => unrelatedWrites.has(id))
              .map((id) => unrelatedWrites.get(id)),
          ).toEqual([0xdd00, 0xdd02]);
          const returnCpu = await monitor.readCpuRegisters();
          expect(returnCpu.sp).toBe((entryCpu.sp + 2) & 0xff);
          expect(returnCpu.p & 0x0c).toBe(entryCpu.p & 0x0c);
          expect(await unrelatedState(monitor)).toEqual(entryState);
          for (const id of unrelatedWrites.keys()) await remove(id);
          await remove(returnCheckpoint);
          const returnJiffy = await jiffyClock(monitor);
          await checkpoint(scnkey);
          const columnWrite = await tracepoint(0xdc00, "store");
          const rowRead = await tracepoint(0xdc01, "load");
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(scnkey);
          const firstJiffy = await jiffyClock(monitor);
          expect((firstJiffy - returnJiffy) & 0xffffff).toBeGreaterThan(0);
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(scnkey);
          const scanHits = monitor.takeCheckpointHits();
          expect(scanHits).not.toContain(handlerCheckpoint);
          expect(scanHits).toContain(columnWrite);
          expect(scanHits).toContain(rowRead);
          expect(scanHits.indexOf(columnWrite)).toBeLessThan(scanHits.indexOf(rowRead));
          expect(((await jiffyClock(monitor)) - firstJiffy) & 0xffffff).toBe(1);
        } finally {
          try {
            for (const id of checkpoints) await monitor.deleteCheckpoint(id);
          } finally {
            await stopVice({ child: started.child, monitor });
          }
        }
      });
    },
    120_000,
  );
});
