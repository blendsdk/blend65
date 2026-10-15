import path from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecords, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const emptyMain = "module Game; place(at: $2000) function main(): void {}";
const rawMain = "module Game; place(at: $2000) function main(): void { poke($DD00, $A2); }";
const lowStates = Array.from({ length: 16 }, (_, index) => ({
  pra: index & 3,
  ddra: index >> 2,
}));

/** Derive the low bank pins from the CIA output latch and input pull-ups. */
function bankPins(pra: number, ddra: number): number {
  return (pra | (~ddra & 0xff)) & 3;
}

describe.sequential("synthetic CIA2 startup states in native VICE", () => {
  for (const profile of profiles) {
    describe.sequential(profile, () => {
      for (const { pra, ddra } of lowStates) {
        it(`synthetic low latch ${pra}, low directions ${ddra}: bank zero at main and exact cooperative return`, async () => {
          await withProfileProject(emptyMain, profile, async (project) => {
            const built = await buildProject({ project, optimization: "none" });
            if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
            const started = await startVice(
              path.join(built.generation.directory, built.generation.primaryArtifact),
              80_000_000,
              profile,
            );
            if ("kind" in started && started.kind === "unknown")
              throw new Error(`Native runtime unavailable: ${started.reason}`);
            try {
              const monitor = started.monitor;
              const entry = await monitor.setExecuteCheckpoint(0x080d);
              const main = await monitor.setExecuteCheckpoint(0x2000);
              const returned = await monitor.setExecuteCheckpoint(0xe147);
              let stopped = monitor.waitForStop(10_000);
              await monitor.resume();
              expect(await stopped).toBe(0x080d);
              await monitor.deleteCheckpoint(entry);
              const original = await monitor.readCpuRegisters();
              // Monitor initialization is synthetic, with outputs exposing the latch.
              const savedDdRA = [0xa4, 0x58, 0xcc, 0x34][pra]! | ddra;
              const savedPra = 0x80 | pra;
              await monitor.writeIo(0xdd02, Uint8Array.of(0xff));
              await monitor.writeIo(0xdd00, Uint8Array.of(savedPra));
              await monitor.writeIo(0xdd02, Uint8Array.of(savedDdRA));
              expect((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(
                bankPins(savedPra, savedDdRA),
              );
              const praLoad = await monitor.setAccessTracepoint(0xdd00, "load");
              const praStore = await monitor.setAccessTracepoint(0xdd00, "store");
              const ddraLoad = await monitor.setAccessTracepoint(0xdd02, "load");
              const ddraStore = await monitor.setAccessTracepoint(0xdd02, "store");
              monitor.takeCheckpointHits();
              stopped = monitor.waitForStop(10_000);
              await monitor.resume();
              expect(await stopped).toBe(0x2000);
              await monitor.deleteCheckpoint(main);
              const entryHits = monitor.takeCheckpointHits();
              expect
                .soft(entryHits.filter((hit) => hit === praLoad || hit === praStore))
                .toEqual([]);
              expect.soft(entryHits.filter((hit) => hit === ddraLoad)).toHaveLength(1);
              expect.soft(entryHits.filter((hit) => hit === ddraStore)).toHaveLength(1);
              const mainDirections = (await monitor.readIo(0xdd02, 0xdd02))[0]!;
              const mainPins = (await monitor.readIo(0xdd00, 0xdd00))[0]! & 3;
              expect.soft(mainDirections).toBe(savedDdRA & 0xfc);
              expect.soft(mainPins).toBe(bankPins(savedPra, savedDdRA & 0xfc));
              expect.soft(3 - mainPins).toBe(0);
              expect.soft((await monitor.readCpuRegisters()).p & 8).toBe(0);
              monitor.takeCheckpointHits();
              stopped = monitor.waitForStop(10_000);
              await monitor.resume();
              expect(await stopped).toBe(0xe147);
              const returnHits = monitor.takeCheckpointHits();
              expect
                .soft(returnHits.filter((hit) => hit === praLoad || hit === praStore))
                .toEqual([]);
              expect.soft(returnHits.filter((hit) => hit === ddraLoad)).toEqual([]);
              expect.soft(returnHits.filter((hit) => hit === ddraStore)).toHaveLength(1);
              expect.soft((await monitor.readIo(0xdd02, 0xdd02))[0]).toBe(savedDdRA);
              const final = await monitor.readCpuRegisters();
              // The final RTS pulls two SYS return-address bytes before BASIC resumes.
              expect
                .soft({
                  sp: final.sp,
                  p: final.p & 0xcf,
                })
                .toEqual({
                  sp: (original.sp + 2) & 0xff,
                  p: original.p & 0xcf,
                });
              for (const checkpoint of [returned, praLoad, praStore, ddraLoad, ddraStore])
                await monitor.deleteCheckpoint(checkpoint);
              // Observe the hidden low latch only after return-state observations.
              try {
                await monitor.writeIo(0xdd02, Uint8Array.of(savedDdRA | 3));
                expect.soft((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(savedPra & 3);
              } finally {
                await monitor.writeIo(0xdd02, Uint8Array.of(savedDdRA));
              }
            } finally {
              await stopVice(started);
            }
          });
        }, 45_000);
      }

      it("a deliberate source PRA write changes the latent low latch while input directions retain bank zero", async () => {
        await withProfileProject(rawMain, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
          const started = await startVice(
            path.join(built.generation.directory, built.generation.primaryArtifact),
            80_000_000,
            profile,
          );
          if ("kind" in started && started.kind === "unknown")
            throw new Error(`Native runtime unavailable: ${started.reason}`);
          try {
            const monitor = started.monitor;
            const entry = await monitor.setExecuteCheckpoint(0x080d);
            const main = await monitor.setExecuteCheckpoint(0x2000);
            const returned = await monitor.setExecuteCheckpoint(0xe147);
            let stopped = monitor.waitForStop(10_000);
            await monitor.resume();
            expect(await stopped).toBe(0x080d);
            await monitor.deleteCheckpoint(entry);
            const original = await monitor.readCpuRegisters();
            const savedDirections = 0xa7;
            await monitor.writeIo(0xdd02, Uint8Array.of(0xff));
            await monitor.writeIo(0xdd00, Uint8Array.of(0x81));
            await monitor.writeIo(0xdd02, Uint8Array.of(savedDirections));
            const load = await monitor.setAccessTracepoint(0xdd00, "load");
            const store = await monitor.setAccessTracepoint(0xdd00, "store");
            monitor.takeCheckpointHits();
            stopped = monitor.waitForStop(10_000);
            await monitor.resume();
            expect(await stopped).toBe(0x2000);
            await monitor.deleteCheckpoint(main);
            expect
              .soft(monitor.takeCheckpointHits().filter((hit) => hit === load || hit === store))
              .toEqual([]);
            expect.soft((await monitor.readIo(0xdd02, 0xdd02))[0]).toBe(savedDirections & 0xfc);
            // Stop immediately after the source store, before cooperative restoration.
            const artifacts = await readProfileArtifacts(built);
            const intervals = profileRecords(artifacts.memory.intervals);
            const restoreStart = intervals.find(
              (interval) => interval.id === "code.startup.restore",
            );
            if (!restoreStart) throw new Error("Missing public startup restore code interval");
            const beforeRestore = await monitor.setExecuteCheckpoint(Number(restoreStart.start));
            monitor.takeCheckpointHits();
            stopped = monitor.waitForStop(10_000);
            await monitor.resume();
            expect(await stopped).toBe(Number(restoreStart.start));
            const sourceHits = monitor.takeCheckpointHits();
            expect.soft(sourceHits.filter((hit) => hit === load)).toEqual([]);
            expect.soft(sourceHits.filter((hit) => hit === store)).toHaveLength(1);
            const pins = (await monitor.readIo(0xdd00, 0xdd00))[0]! & 3;
            expect.soft((await monitor.readIo(0xdd02, 0xdd02))[0]).toBe(savedDirections & 0xfc);
            expect.soft(pins).toBe(bankPins(0xa2, savedDirections & 0xfc));
            expect.soft(3 - pins).toBe(0);
            await monitor.deleteCheckpoint(beforeRestore);
            monitor.takeCheckpointHits();
            stopped = monitor.waitForStop(10_000);
            await monitor.resume();
            expect(await stopped).toBe(0xe147);
            expect
              .soft(monitor.takeCheckpointHits().filter((hit) => hit === load || hit === store))
              .toEqual([]);
            expect.soft((await monitor.readIo(0xdd02, 0xdd02))[0]).toBe(savedDirections);
            const final = await monitor.readCpuRegisters();
            // The final RTS pulls two SYS return-address bytes before BASIC resumes.
            expect
              .soft({
                sp: final.sp,
                p: final.p & 0xcf,
              })
              .toEqual({
                sp: (original.sp + 2) & 0xff,
                p: original.p & 0xcf,
              });
            for (const checkpoint of [returned, load, store])
              await monitor.deleteCheckpoint(checkpoint);
            try {
              await monitor.writeIo(0xdd02, Uint8Array.of(savedDirections | 3));
              expect.soft((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(2);
            } finally {
              await monitor.writeIo(0xdd02, Uint8Array.of(savedDirections));
            }
          } finally {
            await stopVice(started);
          }
        });
      }, 45_000);
    });
  }
});
