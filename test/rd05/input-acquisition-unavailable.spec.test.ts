import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";

const CIA1 = 0xdc00;
const CIA1_CRA = CIA1 + 0x0e;
const NMINV = 0x0318;
const PBON = 0x02;

/** Each timer-output conflict must independently select the unavailable path. */
const controlConfigurations = [
  { name: "CRA only", bytes: [PBON, 0] },
  { name: "CRB only", bytes: [0, PBON] },
  { name: "both controls", bytes: [PBON, PBON] },
] as const;

/** Repeat the installed API through ordinary helper and loop calls without source substitution. */
function callerSource(initialI: boolean): string {
  return `module Game;
import { readInputSnapshot, InputSnapshot, SnapshotQuality } from c64.input;
let saved: InputSnapshot;
function before(): void { }
function after(): void { }
function acquire(): void {
    saved = { rows: [85, 85, 85, 85, 85, 85, 85, 85], joystick1: 86,
              joystick2: 87, quality: SnapshotQuality.COMPLETE };
    before();
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

describe("installed input acquisition with timer-driven PB pins", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const initialI of [false, true]) {
      // An unavailable attempt returns zero placeholders and performs only the two control reads.
      it(`should retain the unavailable helper-loop contract with I=${Number(initialI)} on ${profile}`, async () => {
        const source = callerSource(initialI);
        await withProfileProject(source, profile, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected installed input acquisition");
          const artifacts = await readProfileArtifacts(built);
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
            // Disable timer IRQ production while stopped, outside every measured call interval.
            await monitor.writeIo(CIA1 + 0x0d, Uint8Array.of(0x7f));
            await monitor.writeIo(CIA1_CRA, Uint8Array.of(0, 0));
            const checkpoints = new Map<number, string>();
            try {
              for (let offset = 0; offset < 16; offset += 1) {
                for (const operation of ["load", "store"] as const) {
                  const id = await monitor.setAccessTracepoint(CIA1 + offset, operation);
                  checkpoints.set(id, `${operation}:CIA1.${offset}`);
                }
              }
              for (const address of [NMINV, NMINV + 1]) {
                const id = await monitor.setAccessTracepoint(address, "store");
                checkpoints.set(id, `store:NMINV.${address - NMINV}`);
              }
              for (const configuration of controlConfigurations) {
                await stopAt(beforeAddress);
                // PBON remains configured even with stopped timers; no snapshot bytes are patched.
                await monitor.writeIo(CIA1_CRA, Uint8Array.from(configuration.bytes));
                await monitor.writeIo(CIA1 + 2, Uint8Array.of(0xa5, 0x5a));
                const predecessor = [...(await monitor.readMemory(NMINV, NMINV + 1))];
                const original = await monitor.readCpuRegisters();
                expect(original.p & 0x04, configuration.name).toBe(initialI ? 0x04 : 0);
                monitor.takeCheckpointHits();
                await stopAt(afterAddress);
                const trace = monitor.takeCheckpointHits().flatMap((id) => {
                  const name = checkpoints.get(id);
                  return name === undefined ? [] : [name];
                });
                expect(trace, configuration.name).toEqual(["load:CIA1.14", "load:CIA1.15"]);
                expect(
                  [...(await monitor.readMemory(savedAddress, savedAddress + 10))],
                  configuration.name,
                ).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
                expect([...(await monitor.readIo(CIA1 + 2, CIA1 + 3))], configuration.name).toEqual(
                  [0xa5, 0x5a],
                );
                expect(
                  [...(await monitor.readIo(CIA1_CRA, CIA1_CRA + 1))],
                  configuration.name,
                ).toEqual(configuration.bytes);
                expect(
                  [...(await monitor.readMemory(NMINV, NMINV + 1))],
                  configuration.name,
                ).toEqual(predecessor);
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
