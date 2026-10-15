import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import {
  libraryBytes,
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";

const CIA1 = 0xdc00;
const CIA2 = 0xdd00;
const TIMER_A_LOW = CIA1 + 4;
const CONTROL_A = CIA1 + 0x0e;
const ICR_OFFSET = 0x0d;
const NMINV = 0x0318;

/** START is independent of PBON; either or both PHI2 timers may run during acquisition. */
const timerConfigurations = [
  { name: "timer A", controls: [1, 0] },
  { name: "timer B", controls: [0, 1] },
  { name: "both timers", controls: [1, 1] },
] as const;

/** Exercise installed aggregate returns through an ordinary helper inside a bounded source loop. */
function callerSource(initialI: boolean): string {
  return `module Game;
import { readInputSnapshot, InputSnapshot, SnapshotQuality } from c64.input;
let saved: InputSnapshot;
function probeTick(): void { asm_nop(); }
function before(): void { }
function after(): void { }
function acquire(): void {
    saved = { rows: [85, 85, 85, 85, 85, 85, 85, 85], joystick1: 86,
              joystick2: 87, quality: SnapshotQuality.UNAVAILABLE };
    before();
    probeTick();
    saved = readInputSnapshot();
    after();
}
function main(): void {
    ${initialI ? "asm_sei();" : "asm_cli();"}
    for (let attempt: byte = 0; attempt < 3; attempt += 1) {
        acquire();
    }
}`;
}

/** Decode observations taken while the CPU is stopped, not an atomic read of a running timer. */
function stoppedCounters(bytes: Uint8Array): readonly [number, number] {
  expect(bytes).toHaveLength(4);
  return [bytes[0]! | (bytes[1]! << 8), bytes[2]! | (bytes[3]! << 8)];
}

describe("installed input acquisition with running PHI2 timers", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const initialI of [false, true]) {
      // Scanning must leave running timers configured and must not consume interrupt-source data.
      it(`should preserve running timers through helper loops with I=${Number(initialI)} on ${profile}`, async () => {
        const source = callerSource(initialI);
        await withProfileProject(source, profile, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected installed input acquisition");
          const artifacts = await readProfileArtifacts(built);
          const tickAddress = libraryEntry(artifacts, "src/game.blend::Game.probeTick");
          expect(libraryBytes(artifacts, tickAddress, 1)).toEqual([0xea]);
          const beforeAddress = libraryEntry(artifacts, "src/game.blend::Game.before");
          const afterAddress = libraryEntry(artifacts, "src/game.blend::Game.after");
          const savedAddress = libraryGlobalAddress(
            artifacts,
            source,
            "let saved: InputSnapshot;",
            11,
            "src/game.blend",
          );
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual([0x47, 0xfe]);
            // Mask production outside observation without reading and clearing the ICR latches.
            await monitor.writeIo(CIA1 + ICR_OFFSET, Uint8Array.of(0x7f));
            await monitor.writeIo(CONTROL_A, Uint8Array.of(0, 0));
            const checkpoints = new Map<number, string>();
            try {
              for (const base of [CIA1, CIA2]) {
                for (let offset = 4; offset <= 7; offset += 1) {
                  const id = await monitor.setAccessTracepoint(base + offset, "store");
                  checkpoints.set(id, `timer-write:${base + offset}`);
                }
              }
              for (const address of [CONTROL_A, CONTROL_A + 1]) {
                const id = await monitor.setAccessTracepoint(address, "store");
                checkpoints.set(id, `control-write:${address}`);
              }
              for (const base of [CIA1, CIA2]) {
                for (const operation of ["load", "store"] as const) {
                  const id = await monitor.setAccessTracepoint(base + ICR_OFFSET, operation);
                  checkpoints.set(id, `${operation}:ICR.${base}`);
                }
              }
              for (const configuration of timerConfigurations) {
                await stopAt(beforeAddress);
                // LOAD reloads the latch after a previous running configuration; it reads back clear.
                await monitor.writeIo(CONTROL_A, Uint8Array.of(0, 0));
                await monitor.writeIo(TIMER_A_LOW, Uint8Array.of(0xff, 0xff, 0xff, 0xff));
                await monitor.writeIo(CIA1, Uint8Array.of(0xff, 0xff, 0xa5, 0x5a));
                await monitor.writeIo(
                  CONTROL_A,
                  Uint8Array.from(configuration.controls, (control) => control | 0x10),
                );
                const original = await monitor.readCpuRegisters();
                expect(original.p & 0x04, configuration.name).toBe(initialI ? 0x04 : 0);
                // Ordinary return/call instructions let START settle before the measured NOP.
                await stopAt(tickAddress);
                const initialCounters = stoppedCounters(
                  await monitor.readIo(TIMER_A_LOW, TIMER_A_LOW + 3),
                );
                // The verified NOP supplies a short progress interval outside the scan.
                await stopAt(tickAddress + 1);
                const tickCounters = stoppedCounters(
                  await monitor.readIo(TIMER_A_LOW, TIMER_A_LOW + 3),
                );
                for (let timer = 0; timer < 2; timer += 1) {
                  if (configuration.controls[timer] === 1)
                    expect(tickCounters[timer], configuration.name).not.toBe(
                      initialCounters[timer],
                    );
                  else {
                    expect(initialCounters[timer], configuration.name).toBe(0xffff);
                    expect(tickCounters[timer], configuration.name).toBe(initialCounters[timer]);
                  }
                }
                monitor.takeCheckpointHits();
                await stopAt(afterAddress);
                const traffic = monitor.takeCheckpointHits().flatMap((id) => {
                  const name = checkpoints.get(id);
                  return name === undefined ? [] : [name];
                });
                expect(traffic, configuration.name).toEqual([]);
                expect(
                  [...(await monitor.readMemory(savedAddress, savedAddress + 10))],
                  configuration.name,
                ).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0]);
                expect([...(await monitor.readIo(CIA1 + 2, CIA1 + 3))], configuration.name).toEqual(
                  [0xa5, 0x5a],
                );
                expect(
                  [...(await monitor.readIo(CONTROL_A, CONTROL_A + 1))],
                  configuration.name,
                ).toEqual(configuration.controls);
                const finalCounters = stoppedCounters(
                  await monitor.readIo(TIMER_A_LOW, TIMER_A_LOW + 3),
                );
                for (let timer = 0; timer < 2; timer += 1) {
                  if (configuration.controls[timer] === 0)
                    expect(finalCounters[timer], configuration.name).toBe(initialCounters[timer]);
                }
                const returned = await monitor.readCpuRegisters();
                expect(returned.p & 0x0c, configuration.name).toBe(original.p & 0x0c);
                expect(returned.sp, configuration.name).toBe(original.sp);
              }
            } finally {
              for (const id of checkpoints.keys()) await monitor.deleteCheckpoint(id);
            }
          });
        });
      }, 120_000);
    }
  }
});
