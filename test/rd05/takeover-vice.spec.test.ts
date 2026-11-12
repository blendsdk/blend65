import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-takeover-6581", 0, 0, 312, 6581],
  ["c64-pal-prg-takeover-8580", 0, 1, 312, 8580],
  ["c64-ntsc-prg-takeover-6581", 3, 0, 263, 6581],
  ["c64-ntsc-prg-takeover-8580", 3, 1, 263, 8580],
] as const;

const source = `module Game;
let ticks: word = 0;
zeropage {
  pad: byte;
  saved: byte = 7;
}
function main(): void {
  while (ticks < 20000) { ticks = ticks + 1; }
  saved = 9;
  pokew($0420, c64.profile.rasterLines);
  pokew($0422, c64.profile.sidModel);
  poke($0424, c64.profile.hasRawInterrupts ? 1 : 0);
}`;

/** Decode the public label map only to locate checkpoints, never to derive behavior. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Find one public startup symbol by its documented logical name. */
function startupAddress(labels: Map<string, number>, name: string): number {
  const matches = [...labels].filter(([label]) =>
    label.endsWith(`_${Buffer.from(name).toString("hex")}`),
  );
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Read the two processor-port bytes and both raw vectors. */
async function machineState(monitor: ViceMonitor) {
  return {
    ports: [...(await monitor.readMemory(0, 1))],
    rawIrq: [...(await monitor.readMemory(0xfffe, 0xffff))],
    rawNmi: [...(await monitor.readMemory(0xfffa, 0xfffb))],
    cinv: [...(await monitor.readMemory(0x0314, 0x0315))],
    nminv: [...(await monitor.readMemory(0x0318, 0x0319))],
    cia2Direction: [...(await monitor.readIo(0xdd02, 0xdd02))],
  };
}

/** Configure CIA2 Timer A as an NMI source for one observed entry. */
async function armCia2Nmi(monitor: ViceMonitor): Promise<void> {
  await monitor.writeIo(0xdd04, Uint8Array.of(0x00));
  await monitor.writeIo(0xdd05, Uint8Array.of(0x00));
  await monitor.writeIo(0xdd0d, Uint8Array.of(0x81));
  await monitor.writeIo(0xdd0e, Uint8Array.of(0x11));
}

/** Stop the timer and clear its mask so no further NMI can arrive. */
async function disarmCia2Nmi(monitor: ViceMonitor): Promise<void> {
  await monitor.writeIo(0xdd0d, Uint8Array.of(0x7f));
  await monitor.writeIo(0xdd0e, Uint8Array.of(0x00));
}

const rawIrqSource = `module Game;
import { setRawIRQ, restoreRawIRQ } from c64.system;
let ticks: word = 0;
interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  poke($0426, peek($0426) + 1);
}
function finish(): void {
  poke($0424, 1);
}
function main(): void {
  setRawIRQ(&onIRQ);
  while (ticks < 20000) { ticks = ticks + 1; }
  restoreRawIRQ();
  finish();
}`;

describe.sequential("raw IRQ install, entry, restore and return", () => {
  it("should execute the source raw handler and hand the vector back", async () => {
    const profile = "c64-pal-prg-takeover-6581" as const;
    await withProfileProject(rawIrqSource, profile, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built)).toBe("success");
      if (built.kind !== "success") throw new Error("Fresh raw IRQ build failed");
      const artifacts = await readProfileArtifacts(built);
      const labels = addresses(artifacts.labels);
      const debug = profileRecord(artifacts.debug);
      const handler = profileRecords(debug.functions).find(
        (fn) => fn.qualifiedName === "src/game.blend::Game.onIRQ",
      );
      if (!handler) throw new Error("Missing raw handler record");
      const handlerLabel = profileRecords(handler.entryVariants)[0]?.label;
      if (typeof handlerLabel !== "string") throw new Error("Missing raw handler label");
      const handlerAddress = labels.get(handlerLabel);
      if (handlerAddress === undefined) throw new Error("Missing raw handler address");
      const main = profileRecords(debug.functions).find(
        (fn) => fn.qualifiedName === "src/game.blend::Game.main",
      );
      if (!main) throw new Error("Missing main record");
      const mainLabel = profileRecords(main.entryVariants)[0]?.label;
      if (typeof mainLabel !== "string") throw new Error("Missing main label");
      const mainAddress = labels.get(mainLabel);
      if (mainAddress === undefined) throw new Error("Missing main address");
      const irqDefault = startupAddress(labels, "startup.rawIrqDefault");
      const restore = startupAddress(labels, "startup.restore");
      const finish = profileRecords(debug.functions).find(
        (fn) => fn.qualifiedName === "src/game.blend::Game.finish",
      );
      if (!finish) throw new Error("Missing finish record");
      const finishLabel = profileRecords(finish.entryVariants)[0]?.label;
      if (typeof finishLabel !== "string") throw new Error("Missing finish label");
      const finishAddress = labels.get(finishLabel);
      if (finishAddress === undefined) throw new Error("Missing finish address");
      const prgPath = join(built.generation.directory, built.generation.primaryArtifact);
      const started = await startVice(prgPath, 120_000_000, profile);
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const { monitor } = started;
      const checkpoints = new Set<number>();
      const resume = async () => {
        const stopped = monitor.waitForStop(20_000);
        await monitor.resume();
        return stopped;
      };
      const checkpoint = async (address: number) => {
        const id = await monitor.setExecuteCheckpoint(address);
        checkpoints.add(id);
        return id;
      };
      const remove = async (id: number) => {
        await monitor.deleteCheckpoint(id);
        checkpoints.delete(id);
      };
      try {
        const atStartup = await checkpoint(0x080d);
        expect(await resume()).toBe(0x080d);
        const entryCpu = await monitor.readCpuRegisters();
        const stackByte = async (offset: number) => {
          const address = 0x0100 + ((entryCpu.sp + offset) & 0xff);
          return (await monitor.readMemory(address, address))[0]!;
        };
        const callerReturn = (((await stackByte(1)) | ((await stackByte(2)) << 8)) + 1) & 0xffff;
        await remove(atStartup);
        const atMain = await checkpoint(mainAddress);
        const atHandler = await checkpoint(handlerAddress);
        expect(await resume()).toBe(mainAddress);
        await remove(atMain);
        await monitor.writeMemory(0x0426, Uint8Array.of(0));
        expect(await resume()).toBe(handlerAddress);
        const installed = [...(await monitor.readMemory(0xfffe, 0xffff))];
        expect(installed).toEqual([handlerAddress & 0xff, handlerAddress >> 8]);
        await remove(atHandler);
        const atFinish = await checkpoint(finishAddress);
        expect(await resume()).toBe(finishAddress);
        await remove(atFinish);
        // The restore writes the saved default predecessor back before finish runs.
        expect([...(await monitor.readMemory(0xfffe, 0xffff))]).toEqual([
          irqDefault & 0xff,
          irqDefault >> 8,
        ]);
        expect((await monitor.readMemory(0x0426, 0x0426))[0]!).toBeGreaterThanOrEqual(1);
        const atRestore = await checkpoint(restore);
        await checkpoint(callerReturn);
        expect(await resume()).toBe(restore);
        expect([...(await monitor.readMemory(0x0424, 0x0424))]).toEqual([1]);
        expect(await resume()).toBe(callerReturn);
        console.info(
          "Raw IRQ runtime evidence",
          JSON.stringify({
            profile,
            handlerAddress,
            irqDefault,
            installed,
            artifactSha256: createHash("sha256").update(artifacts.prg).digest("hex"),
            identity: started.identity,
          }),
        );
      } finally {
        for (const id of checkpoints) await monitor.deleteCheckpoint(id);
        await stopVice({ child: started.child, monitor });
      }
    });
  }, 120_000);
});

describe.sequential("four-profile raw takeover execution and normal return", () => {
  it.each(profiles)(
    "should qualify %s through the raw constructor",
    async (profile, vic, sid, rasterLines, sidModel) => {
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built)).toBe("success");
        if (built.kind !== "success") throw new Error("Fresh takeover build failed");
        const artifacts = await readProfileArtifacts(built);
        const prgPath = join(built.generation.directory, built.generation.primaryArtifact);
        const artifactSha256 = createHash("sha256").update(artifacts.prg).digest("hex");
        expect([...artifacts.prg.subarray(0, 14)]).toEqual([
          1, 8, 0x0b, 8, 10, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
        ]);

        const labels = addresses(artifacts.labels);
        const savedHome = profileRecords(artifacts.memory.intervals).find(
          (record) =>
            record.kind === "bss" && Number(record.start) >= 3 && Number(record.start) < 0x100,
        );
        if (savedHome === undefined) throw new Error("Missing zero-page home for saved");
        const savedAddress = Number(savedHome.start);
        const entry = startupAddress(labels, "startup.entry");
        const restore = startupAddress(labels, "startup.restore");
        const irqDefault = startupAddress(labels, "startup.rawIrqDefault");
        const nmiDefault = startupAddress(labels, "startup.rawNmiDefault");
        expect(entry).toBe(0x080d);
        expect(nmiDefault & 0xff).toBe(0x47);
        const debug = profileRecord(artifacts.debug);
        const main = profileRecords(debug.functions).find(
          (fn) => fn.qualifiedName === "src/game.blend::Game.main",
        );
        if (!main) throw new Error("Missing public main function record");
        const variants = profileRecords(main.entryVariants);
        const mainLabel = variants[0]?.label;
        if (typeof mainLabel !== "string") throw new Error("Missing public main entry label");
        const mainAddress = labels.get(mainLabel);
        if (mainAddress === undefined) throw new Error("Missing assembled main address");

        const started = await startVice(prgPath, 120_000_000, profile);
        if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
        const { monitor } = started;
        const checkpoints = new Set<number>();
        try {
          expect(started.identity.executableSha256).toBe(
            "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74",
          );
          const resources: Record<string, unknown> = {};
          for (const name of ["VICIIModel", "SidModel", "CIA1Model", "CIA2Model", "KernalRev"])
            resources[name] = await monitor.readIntegerResource(name);
          expect(resources).toEqual({
            VICIIModel: vic,
            SidModel: sid,
            CIA1Model: 0,
            CIA2Model: 0,
            KernalRev: 3,
          });
          expect(started.identity.roms.map(({ sha256 }) => sha256).sort()).toEqual([
            "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
            "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
            "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
          ]);

          const resume = async () => {
            const stopped = monitor.waitForStop(20_000);
            await monitor.resume();
            return stopped;
          };
          const checkpoint = async (address: number) => {
            const id = await monitor.setExecuteCheckpoint(address);
            checkpoints.add(id);
            return id;
          };
          const remove = async (id: number) => {
            await monitor.deleteCheckpoint(id);
            checkpoints.delete(id);
          };

          const atEntry = await checkpoint(entry);
          expect(await resume()).toBe(entry);
          const entryState = await machineState(monitor);
          const entrySaved = (await monitor.readMemory(savedAddress, savedAddress))[0]!;
          const entryCpu = await monitor.readCpuRegisters();
          const stackByte = async (offset: number) => {
            const address = 0x0100 + ((entryCpu.sp + offset) & 0xff);
            return (await monitor.readMemory(address, address))[0]!;
          };
          const callerReturn = (((await stackByte(1)) | ((await stackByte(2)) << 8)) + 1) & 0xffff;
          await remove(atEntry);

          const atMain = await checkpoint(mainAddress);
          const atIrq = await checkpoint(irqDefault);
          const atNmi = await checkpoint(nmiDefault);
          expect(await resume()).toBe(mainAddress);
          const mainState = await machineState(monitor);
          expect(mainState.ports[0]! & 7).toBe(7);
          expect(mainState.ports[1]! & 7).toBe(5);
          expect(mainState.cia2Direction[0]! & 3).toBe(0);
          expect(mainState.rawIrq).toEqual([irqDefault & 0xff, irqDefault >> 8]);
          expect(mainState.rawNmi).toEqual([nmiDefault & 0xff, nmiDefault >> 8]);
          expect(mainState.cinv).toEqual(entryState.cinv);
          expect(mainState.nminv).toEqual(entryState.nminv);
          await monitor.writeMemory(0xa000, Uint8Array.of(0x5a));
          expect([...(await monitor.readMemory(0xa000, 0xa000))]).toEqual([0x5a]);
          const mainCpu = await monitor.readCpuRegisters();
          expect(mainCpu.p & 8).toBe(0);
          expect((await monitor.readMemory(savedAddress, savedAddress))[0]!).toBe(7);
          await remove(atMain);

          // The stock CIA1 Timer A source must reach the default raw IRQ entry.
          expect(await resume()).toBe(irqDefault);
          await remove(atIrq);

          // A monitor-injected CIA2 timer NMI must reach the default raw NMI entry.
          await armCia2Nmi(monitor);
          expect(await resume()).toBe(nmiDefault);
          const interruptedA = (await monitor.readCpuRegisters()).a;
          const atNmiRti = await checkpoint(nmiDefault + 3);
          await remove(atNmi);
          expect(await resume()).toBe(nmiDefault + 3);
          expect((await monitor.readCpuRegisters()).a).toBe(interruptedA);
          await remove(atNmiRti);
          await disarmCia2Nmi(monitor);

          const atRestore = await checkpoint(restore);
          await checkpoint(callerReturn);
          expect(await resume()).toBe(restore);
          expect((await monitor.readMemory(savedAddress, savedAddress))[0]!).toBe(9);
          await remove(atRestore);
          expect(await resume()).toBe(callerReturn);
          const exitCpu = await monitor.readCpuRegisters();
          const exitState = await machineState(monitor);
          expect(exitState).toEqual(entryState);
          expect((await monitor.readMemory(savedAddress, savedAddress))[0]!).toBe(entrySaved);
          expect(exitCpu.p & 0x0c).toBe(entryCpu.p & 0x0c);
          expect(exitCpu.sp).toBe((entryCpu.sp + 2) & 0xff);
          expect([...(await monitor.readMemory(0x0420, 0x0424))]).toEqual([
            rasterLines & 0xff,
            rasterLines >> 8,
            sidModel & 0xff,
            sidModel >> 8,
            1,
          ]);
          console.info(
            "Takeover runtime evidence",
            JSON.stringify({
              profile,
              artifactSha256,
              identity: started.identity,
              resources,
              entryCpu,
              mainCpu,
              exitCpu,
              entryState,
              mainState,
              exitState,
              stop: callerReturn,
            }),
          );
        } finally {
          for (const id of checkpoints) await monitor.deleteCheckpoint(id);
          await stopVice({ child: started.child, monitor });
        }
      });
    },
    120_000,
  );
});
